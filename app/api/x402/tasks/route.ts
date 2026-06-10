import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/x402/tasks — Premium Task Data
 *
 * Returns tasks with enriched data: bid counts, avg bid amount,
 * client history, completion times.
 *
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to access premium task data.',
        buyUrl: HIVE_BUY_URL,
        header: `Set "${X402_HEADERS.WALLET_ADDRESS}" to your Solana wallet address`,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  const verification = await verifyHolderAccess(wallet, {
    message: req.headers.get(X402_HEADERS.WALLET_MESSAGE),
    signature: req.headers.get(X402_HEADERS.WALLET_SIGNATURE),
    requireSignature: true,
  });

  if (!verification.allowed) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: verification.error || 'You need to hold $HIVE tokens to access this endpoint.',
        buyUrl: HIVE_BUY_URL,
        balance: verification.balance,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const page = parseInt(searchParams.get('page') || '1');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const query: any = {};
    if (category) query.category = category;
    if (status) query.status = status;

    const [tasks, total] = await Promise.all([
      db.collection(COLLECTIONS.TASKS)
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.TASKS).countDocuments(query),
    ]);

    // Get bid counts per task
    const taskIds = tasks.map(t => t._id.toString());
    const bidAgg = await db.collection(COLLECTIONS.BIDS).aggregate([
      { $match: { taskId: { $in: taskIds } } },
      {
        $group: {
          _id: '$taskId',
          bidCount: { $sum: 1 },
          avgAmount: { $avg: { $toDouble: { $replaceAll: { input: { $ifNull: ['$amount', '0'] }, find: '$', replacement: '' } } } },
        },
      },
    ]).toArray();

    const bidMap = new Map(bidAgg.map(b => [b._id, b]));

    // Get client task counts
    const clientAddresses = [...new Set(tasks.map(t => t.clientAddress).filter(Boolean))];
    const clientAgg = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $match: { clientAddress: { $in: clientAddresses } } },
      {
        $group: {
          _id: '$clientAddress',
          taskCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        },
      },
    ]).toArray();

    const clientMap = new Map(clientAgg.map(c => [c._id, c]));

    const enrichedTasks = tasks.map(task => {
      const taskId = task._id.toString();
      const bids = bidMap.get(taskId) || { bidCount: 0, avgAmount: 0 };
      const clientStats = clientMap.get(task.clientAddress) || { taskCount: 1, completedCount: 0 };

      return {
        id: taskId,
        title: task.title,
        description: task.description,
        category: task.category,
        budget: task.budget,
        budgetAmount: task.budgetAmount,
        status: task.status,
        tags: task.tags || [],
        bidCount: bids.bidCount,
        avgBidAmount: bids.avgAmount ? `$${Math.round(bids.avgAmount)}` : null,
        clientName: task.clientName || 'Anonymous',
        clientTaskCount: clientStats.taskCount,
        clientCompletionRate: clientStats.taskCount > 0
          ? Math.round((clientStats.completedCount / clientStats.taskCount) * 100) / 100
          : 0,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });

    // Category breakdown for analytics
    const categoryAgg = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $match: { status: 'Open' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    return NextResponse.json(
      {
        tasks: enrichedTasks,
        total,
        page,
        limit,
        premium: true,
        analytics: {
          openByCategory: categoryAgg.map(c => ({ category: c._id, count: c.count })),
        },
        holder: { tier: verification.tier, balance: verification.balance },
      },
      {
        headers: {
          [X402_HEADERS.HOLDER_TIER]: verification.tier,
          [X402_HEADERS.HOLDER_BALANCE]: String(verification.balance),
        },
      }
    );
  } catch (error: any) {
    logger.error('[x402] Tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch task data' }, { status: 500 });
  }
}
