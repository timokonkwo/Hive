import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/leaderboard
 * Paginated leaderboard with stored reputation, earnings, and review data.
 *
 * Query: ?page=1&limit=20&sort=reputation|earnings|completed
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPage = Number(searchParams.get('page') || 1);
    const requestedLimit = Number(searchParams.get('limit') || 20);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 20;
    const requestedSort = searchParams.get('sort');
    const sortBy = requestedSort === 'earnings' || requestedSort === 'completed' ? requestedSort : 'reputation';
    const searchQuery = (searchParams.get('search')?.trim() || '').slice(0, 160);

    const db = await getDb();

    // Build base match filter
    const baseMatch: any = { status: { $ne: 'pending' } };

    // Add server-side search if provided
    if (searchQuery) {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: escaped, $options: 'i' };
      baseMatch.$or = [
        { name: searchRegex },
        { bio: searchRegex },
        { capabilities: searchRegex },
      ];
    }

    const totalAgents = await db.collection(COLLECTIONS.AGENTS).countDocuments(baseMatch);

    // Aggregation: join bids + tasks + reviews to build full leaderboard
    const pipeline: any[] = [
      // Exclude pending registrations + apply search filter
      { $match: baseMatch },
      // Count proposals
      {
        $lookup: {
          from: COLLECTIONS.BIDS,
          let: { agentId: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$agentId', '$$agentId'] } } },
            { $count: 'count' },
          ],
          as: 'bidStats',
        },
      },
      // Count completed tasks AND sum earnings in a single lookup
      {
        $lookup: {
          from: COLLECTIONS.TASKS,
          let: {
            agentId: { $toString: '$_id' },
            agentName: '$name',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ['$assignedAgent', '$$agentId'] },
                        { $eq: ['$assignedAgentName', '$$agentName'] },
                        { $eq: [{ $toLower: '$assignedAgentName' }, { $toLower: '$$agentName' }] },
                        { $eq: [{ $toLower: '$assignedAgent' }, { $toLower: '$$agentName' }] },
                      ],
                    },
                    { $eq: ['$status', 'Completed'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                completedCount: { $sum: 1 },
                totalEarned: { $sum: { $ifNull: ['$budgetAmount', 0] } },
                paidCount: {
                  $sum: {
                    $cond: [{ $gt: [{ $ifNull: ['$budgetAmount', 0] }, 0] }, 1, 0],
                  },
                },
              },
            },
          ],
          as: 'taskStats',
        },
      },
      // Compute fields
      {
        $addFields: {
          totalProposals: {
            $ifNull: [{ $arrayElemAt: ['$bidStats.count', 0] }, 0],
          },
          completedTasks: {
            $ifNull: [{ $arrayElemAt: ['$taskStats.completedCount', 0] }, 0],
          },
          totalEarnings: {
            $ifNull: [{ $arrayElemAt: ['$taskStats.totalEarned', 0] }, 0],
          },
          paidTaskCount: {
            $ifNull: [{ $arrayElemAt: ['$taskStats.paidCount', 0] }, 0],
          },
          // Use stored reputation (calculated and persisted by complete/review/auto-complete)
          displayReputation: { $ifNull: ['$reputation', 0] },
        },
      },
      // Sort
      { $sort: sortBy === 'earnings'
        ? { totalEarnings: -1 as const, displayReputation: -1 as const, _id: 1 as const }
        : sortBy === 'completed'
          ? { completedTasks: -1 as const, displayReputation: -1 as const, _id: 1 as const }
          : { displayReputation: -1 as const, totalEarnings: -1 as const, _id: 1 as const }
      },
      // Facet for pagination
      {
        $facet: {
          agents: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                id: { $toString: '$_id' },
                name: { $ifNull: ['$name', 'Unnamed Agent'] },
                bio: { $ifNull: ['$bio', ''] },
                avatarSeed: { $ifNull: ['$avatarSeed', ''] },
                avatarUrl: { $ifNull: ['$avatarUrl', ''] },
                capabilities: { $ifNull: ['$capabilities', []] },
                address: { $ifNull: ['$walletAddress', ''] },
                reputation: '$displayReputation',
                avgSatisfaction: { $ifNull: ['$avgSatisfaction', 0] },
                reviewCount: { $ifNull: ['$reviewCount', 0] },
                completedTasks: 1,
                totalProposals: 1,
                totalEarnings: 1,
                paidTaskCount: 1,
                isVerified: { $ifNull: ['$isVerified', false] },
                registeredAt: { $ifNull: ['$createdAt', '$registeredAt'] },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalReputation: { $sum: '$displayReputation' },
                totalCompleted: { $sum: '$completedTasks' },
                totalEarnings: { $sum: '$totalEarnings' },
              },
            },
          ],
        },
      },
    ];

    // Direct counts for platform-wide stats (avoids aggregation mismatch)
    const [platformProposals, platformCompleted] = await Promise.all([
      db.collection(COLLECTIONS.BIDS).countDocuments({}),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: 'Completed' }),
    ]);

    const [result] = await db.collection(COLLECTIONS.AGENTS).aggregate(pipeline).toArray();

    const agents = result?.agents || [];
    const totals = result?.totals?.[0] || { totalReputation: 0, totalCompleted: 0 };

    return NextResponse.json({
      agents,
      total: totalAgents,
      page,
      limit,
      totalPages: Math.ceil(totalAgents / limit),
      sortBy,
      stats: {
        totalAgents,
        totalReputation: totals.totalReputation,
        totalCompleted: platformCompleted,
        totalProposals: platformProposals,
      },
    });
  } catch (error) {
    logger.error('GET /api/leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
