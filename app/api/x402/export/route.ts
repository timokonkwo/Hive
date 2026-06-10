import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/x402/export — Bulk Data Export
 *
 * Full JSON dump of platform data: tasks, agents, bids, stats.
 * NOT available via public API (public is paginated + rate limited).
 *
 * Query params:
 *   ?type=tasks|agents|all  (default: all)
 *
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to export platform data.',
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
        message: verification.error || 'You need to hold $HIVE tokens.',
        buyUrl: HIVE_BUY_URL,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all';

  try {
    const db = await getDb();
    const result: any = {
      exportedAt: new Date().toISOString(),
      premium: true,
      holder: { tier: verification.tier, balance: verification.balance },
    };

    if (type === 'tasks' || type === 'all') {
      const tasks = await db.collection(COLLECTIONS.TASKS)
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      // Enrich with bid counts
      const bidCounts = await db.collection(COLLECTIONS.BIDS).aggregate([
        { $group: { _id: '$taskId', count: { $sum: 1 } } },
      ]).toArray();
      const bidMap = new Map(bidCounts.map(b => [b._id, b.count]));

      result.tasks = tasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        description: t.description,
        category: t.category,
        budget: t.budget,
        budgetAmount: t.budgetAmount,
        status: t.status,
        tags: t.tags || [],
        clientAddress: t.clientAddress,
        clientName: t.clientName,
        assignedAgent: t.assignedAgent,
        assignedAgentName: t.assignedAgentName,
        bidCount: bidMap.get(t._id.toString()) || 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
      result.taskCount = result.tasks.length;
    }

    if (type === 'agents' || type === 'all') {
      const agents = await db.collection(COLLECTIONS.AGENTS)
        .find({ status: { $ne: 'pending' } })
        .toArray();

      // Enrich with stats
      const agentBidStats = await db.collection(COLLECTIONS.BIDS).aggregate([
        {
          $group: {
            _id: '$agentId',
            totalBids: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          },
        },
      ]).toArray();
      const bidStatMap = new Map(agentBidStats.map(s => [s._id, s]));

      result.agents = agents.map(a => {
        const bids = bidStatMap.get(a._id.toString()) || { totalBids: 0, accepted: 0 };
        return {
          id: a._id.toString(),
          name: a.name,
          reputation: a.reputation || 0,
          isVerified: a.isVerified || false,
          categories: a.categories || [],
          totalBids: bids.totalBids,
          acceptedBids: bids.accepted,
          winRate: bids.totalBids > 0 ? Math.round((bids.accepted / bids.totalBids) * 100) : 0,
          createdAt: a.createdAt,
        };
      });
      result.agentCount = result.agents.length;
    }

    return NextResponse.json(result, {
      headers: {
        [X402_HEADERS.HOLDER_TIER]: verification.tier,
        [X402_HEADERS.HOLDER_BALANCE]: String(verification.balance),
        'Content-Disposition': `attachment; filename="hive-export-${type}-${Date.now()}.json"`,
      },
    });
  } catch (error: any) {
    logger.error('[x402] Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
