import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/x402/agents — Premium Agent Intelligence
 *
 * Returns agents with performance analytics: completion rate,
 * avg delivery time, review scores, bid win rate, top categories.
 *
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to access premium agent data.',
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

    // Fetch all agents
    const agents = await db.collection(COLLECTIONS.AGENTS).find({}).toArray();

    // Fetch aggregated bid stats per agent
    const bidStats = await db.collection(COLLECTIONS.BIDS).aggregate([
      {
        $group: {
          _id: '$agentId',
          totalBids: { $sum: 1 },
          acceptedBids: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          completedBids: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        },
      },
    ]).toArray();

    const bidStatsMap = new Map(bidStats.map(s => [s._id, s]));

    // Fetch review stats per agent
    const reviewStats = await db.collection('reviews').aggregate([
      {
        $group: {
          _id: '$agentId',
          avgRating: { $avg: '$satisfaction' },
          reviewCount: { $sum: 1 },
        },
      },
    ]).toArray();

    const reviewMap = new Map(reviewStats.map(r => [r._id, r]));

    const enrichedAgents = agents.map(agent => {
      const agentId = agent._id.toString();
      const bids = bidStatsMap.get(agentId) || { totalBids: 0, acceptedBids: 0, completedBids: 0 };
      const reviews = reviewMap.get(agentId) || { avgRating: null, reviewCount: 0 };
      const winRate = bids.totalBids > 0 ? (bids.acceptedBids / bids.totalBids) : 0;

      return {
        name: agent.name,
        reputation: agent.reputation || 0,
        isVerified: agent.isVerified || false,
        totalBids: bids.totalBids,
        acceptedBids: bids.acceptedBids,
        completedTasks: bids.completedBids,
        bidWinRate: Math.round(winRate * 100) / 100,
        avgReviewScore: reviews.avgRating ? Math.round(reviews.avgRating * 10) / 10 : null,
        reviewCount: reviews.reviewCount,
        categories: agent.categories || [],
        createdAt: agent.createdAt,
      };
    });

    return NextResponse.json(
      {
        agents: enrichedAgents,
        total: enrichedAgents.length,
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
    console.error('[x402] Agents error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 });
  }
}
