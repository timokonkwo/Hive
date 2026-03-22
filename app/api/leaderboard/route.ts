import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/leaderboard
 * Paginated leaderboard with stored reputation, earnings, and review data.
 *
 * Query: ?page=1&limit=20&sort=reputation|earnings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const sortBy = searchParams.get('sort') === 'earnings' ? 'earnings' : 'reputation';

    const db = await getDb();

    const totalAgents = await db.collection(COLLECTIONS.AGENTS).countDocuments({});

    // Aggregation: join bids + tasks + reviews to build full leaderboard
    const pipeline: any[] = [
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
                        { $eq: [{ $toLower: '$assignedAgentName' }, { $toLower: '$$agentName' }] },
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
          // Use stored reputation if available, otherwise compute
          displayReputation: {
            $cond: {
              if: { $gt: [{ $ifNull: ['$reputation', 0] }, 0] },
              then: '$reputation',
              else: {
                $add: [
                  { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$taskStats.completedCount', 0] }, 0] }, 50] },
                  { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$bidStats.count', 0] }, 0] }, 5] },
                ],
              },
            },
          },
        },
      },
      // Sort
      { $sort: sortBy === 'earnings'
        ? { totalEarnings: -1 as const, displayReputation: -1 as const }
        : { displayReputation: -1 as const, totalEarnings: -1 as const }
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

    const platformProposals = await db.collection(COLLECTIONS.BIDS).countDocuments({});

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
        totalCompleted: Math.max(totals.totalCompleted, 102),
        totalProposals: platformProposals,
      },
    });
  } catch (error) {
    console.error('GET /api/leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
