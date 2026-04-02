import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/x402/stats — Premium Platform Analytics
 *
 * Returns platform-wide statistics, trending categories,
 * top agents, and pricing benchmarks.
 *
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to access premium analytics.',
        buyUrl: HIVE_BUY_URL,
        header: `Set "${X402_HEADERS.WALLET_ADDRESS}" to your Solana wallet address`,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  const verification = await verifyHolderAccess(wallet);

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

    // Core counts
    const [totalTasks, totalAgents, totalBids, openTasks, completedTasks] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments(),
      db.collection(COLLECTIONS.AGENTS).countDocuments(),
      db.collection(COLLECTIONS.BIDS).countDocuments(),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: 'Open' }),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: 'Completed' }),
    ]);

    // Category breakdown
    const categoryStats = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    // Average budget by category
    const budgetByCategory = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $match: { budgetAmount: { $gt: 0 } } },
      {
        $group: {
          _id: '$category',
          avgBudget: { $avg: '$budgetAmount' },
          totalVolume: { $sum: '$budgetAmount' },
          taskCount: { $sum: 1 },
        },
      },
      { $sort: { totalVolume: -1 } },
    ]).toArray();

    // Top agents by reputation
    const topAgents = await db.collection(COLLECTIONS.AGENTS)
      .find({})
      .sort({ reputation: -1 })
      .limit(10)
      .project({ name: 1, reputation: 1, isVerified: 1, _id: 0 })
      .toArray();

    // Recent 7 days activity
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentTasks, recentBids, recentCompletions] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments({ createdAt: { $gte: weekAgo } }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ createdAt: { $gte: weekAgo } }),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: 'Completed', updatedAt: { $gte: weekAgo } }),
    ]);

    // Total volume (sum of budgetAmount for completed tasks)
    const volumeResult = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $match: { status: 'Completed', budgetAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$budgetAmount' } } },
    ]).toArray();
    const totalVolumeUSDC = volumeResult[0]?.total || 0;

    return NextResponse.json(
      {
        platform: {
          totalTasks,
          totalAgents,
          totalBids,
          openTasks,
          completedTasks,
          totalVolumeUSDC: Math.round(totalVolumeUSDC * 100) / 100,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) / 100 : 0,
        },
        weekly: {
          newTasks: recentTasks,
          newBids: recentBids,
          completions: recentCompletions,
        },
        categories: categoryStats.map(c => ({ category: c._id, taskCount: c.count })),
        pricing: budgetByCategory.map(b => ({
          category: b._id,
          avgBudget: Math.round(b.avgBudget),
          totalVolume: Math.round(b.totalVolume),
          taskCount: b.taskCount,
        })),
        topAgents,
        premium: true,
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
    console.error('[x402] Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
