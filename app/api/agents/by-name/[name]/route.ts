import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/agents/by-name/[name]
 * Get agent profile by name (case-insensitive) with task/bid history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    if (!decodedName) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const db = await getDb();
    const escaped = decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    const agentId = agent._id.toString();

    // Get stats and history in parallel
    const [
      tasksCompleted,
      activeProposals,
      totalProposals,
      recentBids,
      assignedTasks,
    ] = await Promise.all([
      db.collection('submissions').countDocuments({
        agentId,
        status: { $in: ['Approved', 'Submitted'] },
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({
        agentId,
        status: { $nin: ['rejected', 'withdrawn', 'Completed'] },
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ agentId }),
      // Recent bids with task info
      db.collection(COLLECTIONS.BIDS)
        .find({ agentId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      // Tasks this agent was assigned to
      db.collection(COLLECTIONS.TASKS)
        .find({
          $or: [
            { assignedAgent: { $regex: new RegExp(`^${escaped}$`, 'i') } },
            { assignedAgentName: { $regex: new RegExp(`^${escaped}$`, 'i') } },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    // Enrich bids with task titles
    const taskIds = recentBids.map(b => b.taskId).filter(Boolean);
    let taskTitles: Record<string, string> = {};
    if (taskIds.length > 0) {
      const tasks = await db.collection(COLLECTIONS.TASKS)
        .find({ _id: { $in: taskIds.map((id: string) => {
          try { return new (require('mongodb').ObjectId)(id); } catch { return id; }
        }) } })
        .project({ title: 1 })
        .toArray();
      taskTitles = Object.fromEntries(tasks.map(t => [t._id.toString(), t.title]));
    }

    const completionRate = totalProposals > 0
      ? Math.round((tasksCompleted / totalProposals) * 100)
      : 0;
      
    // Calculate reputation dynamically like the leaderboard does
    // Base reputation from DB = 0 normally unless manually assigned
    // Tasks completed * 10 points
    const calculatedReputation = (agent.reputation || 0) + (tasksCompleted * 10);

    return NextResponse.json({
      agent: {
        id: agentId,
        name: agent.name || 'Unnamed Agent',
        bio: agent.bio || '',
        walletAddress: agent.walletAddress,
        reputation: calculatedReputation,
        isVerified: agent.isVerified || false,
        capabilities: agent.capabilities || [],
        registrationMethod: agent.registrationMethod || 'unknown',
        createdAt: agent.createdAt,
        website: agent.website || null,
      },
      stats: {
        tasksCompleted,
        activeProposals,
        totalProposals,
        completionRate,
      },
      recentBids: recentBids.map(b => ({
        id: b._id.toString(),
        taskId: b.taskId,
        taskTitle: taskTitles[b.taskId] || b.taskTitle || 'Unknown Task',
        amount: b.amount,
        status: b.status,
        createdAt: b.createdAt,
      })),
      taskHistory: assignedTasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        status: t.status,
        category: t.category,
        budget: t.budget,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/agents/by-name error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
