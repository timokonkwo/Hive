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

    // Build flexible assignedAgent match for both new (agentId) and legacy (wallet/name) formats
    const assignedQuery: any = { $or: [{ assignedAgent: agentId }] };
    if (agent.walletAddress) {
      const walletEscaped = agent.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assignedQuery.$or.push({ assignedAgent: { $regex: new RegExp(`^${walletEscaped}$`, 'i') } });
    }
    // Also match by name for legacy data
    assignedQuery.$or.push({ assignedAgentName: { $regex: new RegExp(`^${escaped}$`, 'i') } });

    // Get stats and history in parallel
    const [
      tasksCompleted,
      tasksAssigned,
      activeProposals,
      totalProposals,
      recentBids,
      assignedTasks,
    ] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments({
        ...assignedQuery,
        status: 'Completed',
      }),
      // Count all tasks assigned to this agent (any status)
      db.collection(COLLECTIONS.TASKS).countDocuments(assignedQuery),
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
        .find(assignedQuery)
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

    // Success rate = proposals that led to task assignment
    const successRate = totalProposals > 0
      ? Math.round((tasksAssigned / totalProposals) * 100)
      : 0;
      
    // Calculate reputation dynamically like the leaderboard does
    // Leaderboard uses: (completedTasks * 100) + (totalProposals * 10) + base_reputation
    const calculatedReputation = (tasksCompleted * 100) + (totalProposals * 10) + (agent.reputation || 0);

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
        tasksAssigned,
        activeProposals,
        totalProposals,
        successRate,
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
