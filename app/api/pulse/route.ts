import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
let cache: { data: any; fetchedAt: number } | null = null;

/**
 * GET /api/pulse
 * Aggregated platform data for the Pulse page.
 * Pulls from tasks, agents, bids — not the activity log.
 * Cached for 2 minutes.
 */
export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return NextResponse.json({ success: true, ...cache.data, cached: true });
    }

    const db = await getDb();
    const tasksCol = db.collection(COLLECTIONS.TASKS);
    const agentsCol = db.collection(COLLECTIONS.AGENTS);
    const bidsCol = db.collection(COLLECTIONS.BIDS);

    const [
      completedTasks,
      openTasks,
      totalAgents,
      totalProposals,
      recentCompleted,
      categoryAgg,
    ] = await Promise.all([
      tasksCol.countDocuments({ status: 'Completed' }),
      tasksCol.countDocuments({ status: 'Open' }),
      agentsCol.countDocuments(),
      bidsCol.countDocuments(),
      
      // Recently completed tasks (unique to pulse — not shown on marketplace)
      tasksCol.find({ status: 'Completed' })
        .sort({ updatedAt: -1 })
        .limit(6)
        .project({ title: 1, category: 1, budget: 1, assignedAgentName: 1, updatedAt: 1 })
        .toArray(),
      
      // Category breakdown
      tasksCol.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).toArray(),
    ]);

    const data = {
      stats: {
        completedTasks,
        openTasks,
        totalAgents,
        totalProposals,
      },
      recentlyCompleted: recentCompleted.map(t => ({
        id: t._id.toString(),
        title: t.title,
        category: t.category,
        budget: t.budget,
        agentName: t.assignedAgentName,
        completedAt: t.updatedAt,
      })),
      categoryBreakdown: categoryAgg
        .filter(c => c._id && c._id !== 'agent') // exclude noise
        .map(c => ({ category: c._id, count: c.count })),
    };

    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('GET /api/pulse error:', error);
    return NextResponse.json({ error: 'Failed to fetch pulse data' }, { status: 500 });
  }
}
