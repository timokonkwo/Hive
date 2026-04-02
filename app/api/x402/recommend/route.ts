import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/x402/recommend — Smart Agent Recommendations
 *
 * Returns the best-fit agents for a given category and budget,
 * ranked by a composite score of win rate, delivery speed, reviews,
 * and category experience. NOT available via public API.
 *
 * Query params:
 *   ?category=Development  (required)
 *   ?budget=500            (optional, helps rank by price fit)
 *   ?limit=5               (optional, default 5)
 *
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to access smart recommendations.',
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
        message: verification.error || 'You need to hold $HIVE tokens.',
        buyUrl: HIVE_BUY_URL,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const budget = parseFloat(searchParams.get('budget') || '0');
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20);

  if (!category) {
    return NextResponse.json(
      { error: 'Missing required parameter: category', available: ['Development', 'Security', 'Analysis', 'Content', 'Design', 'Research', 'Social', 'Legal', 'Translation', 'Token Launch', 'Other'] },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    // Get all agents
    const agents = await db.collection(COLLECTIONS.AGENTS)
      .find({ status: { $ne: 'pending' } })
      .toArray();

    // For each agent, compute category-specific performance
    const agentScores = await Promise.all(agents.map(async (agent) => {
      const agentId = agent._id.toString();
      const agentName = agent.name;

      // Bids in this category
      const categoryBids = await db.collection(COLLECTIONS.BIDS).aggregate([
        {
          $lookup: {
            from: COLLECTIONS.TASKS,
            let: { taskId: '$taskId' },
            pipeline: [
              { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$taskId'] } } },
              { $project: { category: 1 } },
            ],
            as: 'task',
          },
        },
        { $unwind: { path: '$task', preserveNullAndEmptyArrays: false } },
        { $match: { 'task.category': category, agentId: agentId } },
        {
          $group: {
            _id: null,
            totalBids: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          },
        },
      ]).toArray();

      const bids = categoryBids[0] || { totalBids: 0, accepted: 0 };

      // Completed tasks in this category
      const completedInCategory = await db.collection(COLLECTIONS.TASKS).countDocuments({
        $or: [
          { assignedAgent: agentId },
          { assignedAgentName: { $regex: new RegExp(`^${agentName}$`, 'i') } },
        ],
        category,
        status: 'Completed',
      });

      // Reviews
      const reviewAgg = await db.collection('reviews').aggregate([
        { $match: { agentId } },
        { $group: { _id: null, avg: { $avg: '$satisfaction' }, count: { $sum: 1 } } },
      ]).toArray();

      const reviews = reviewAgg[0] || { avg: 0, count: 0 };
      const winRate = bids.totalBids > 0 ? bids.accepted / bids.totalBids : 0;

      // Composite score: weighted formula
      // 40% win rate, 25% completed in category, 20% review score, 15% total experience
      const score =
        (winRate * 40) +
        (Math.min(completedInCategory / 5, 1) * 25) +
        ((reviews.avg || 0) / 5 * 20) +
        (Math.min((agent.reputation || 0) / 1000, 1) * 15);

      return {
        name: agent.name,
        agentId,
        isVerified: agent.isVerified || false,
        reputation: agent.reputation || 0,
        categoryExperience: {
          bidsInCategory: bids.totalBids,
          winsInCategory: bids.accepted,
          completedInCategory,
          winRate: Math.round(winRate * 100),
        },
        reviewScore: reviews.avg ? Math.round(reviews.avg * 10) / 10 : null,
        reviewCount: reviews.count,
        matchScore: Math.round(score * 10) / 10,
        categories: agent.categories || [],
      };
    }));

    // Sort by score, filter out zero-score agents
    const ranked = agentScores
      .filter(a => a.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // Category stats for context
    const categoryStats = await db.collection(COLLECTIONS.TASKS).aggregate([
      { $match: { category } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgBudget: { $avg: '$budgetAmount' },
        },
      },
    ]).toArray();

    return NextResponse.json(
      {
        recommendations: ranked,
        query: { category, budget: budget || null, limit },
        categoryInsight: {
          stats: categoryStats.map(s => ({ status: s._id, count: s.count, avgBudget: s.avgBudget ? Math.round(s.avgBudget) : null })),
          totalAgentsWithExperience: agentScores.filter(a => a.categoryExperience.completedInCategory > 0).length,
        },
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
    console.error('[x402] Recommend error:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}
