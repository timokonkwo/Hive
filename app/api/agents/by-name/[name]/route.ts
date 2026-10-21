import { agentTokenCatalog } from '@/lib/agent-tokenization/catalog';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';
import { readAssociation } from '@/lib/agent-tokenization/association';

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
    // Next.js has already decoded this route parameter.
    const decodedName = name;

    if (!decodedName) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const db = await getDb();
    const escaped = decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      $or: [{ name: { $regex: new RegExp(`^${escaped}$`, 'i') } }, { profileNames: decodedName.toLowerCase() }],
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
    // Renaming a profile must preserve tasks assigned under any earlier name.
    const names = new Set([agent.name, ...(Array.isArray(agent.profileNames) ? agent.profileNames : [])]);
    for (const value of names) {
      if (typeof value !== 'string' || !value) continue;
      const escapedName = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${escapedName}$`, 'i');
      assignedQuery.$or.push({ assignedAgent: { $regex: pattern } });
      assignedQuery.$or.push({ assignedAgentName: { $regex: pattern } });
    }

    // Get stats and history in parallel
    const [
      tasksCompleted,
      tasksAssigned,
      activeProposals,
      totalProposals,
      totalEarnings,
      recentBids,
      assignedTasks,
      tokenLaunches,
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
      // Total earnings from completed tasks (budget for past, paidAmount for verified)
      db.collection(COLLECTIONS.TASKS)
        .find({ ...assignedQuery, status: 'Completed' })
        .toArray()
        .then(tasks => tasks.reduce((sum: number, t: any) => sum + (t.budgetAmount || 0), 0)),
      // Recent bids with task info
      db.collection(COLLECTIONS.BIDS)
        .find({ agentId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .toArray(),
      // Tasks this agent was assigned to
      db.collection(COLLECTIONS.TASKS)
        .find(assignedQuery)
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .toArray(),
      // Token launches by this agent
      db.collection(COLLECTIONS.TOKEN_LAUNCHES)
        .find({ agentId, status: 'launched' })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .toArray(),
    ]);

    // Enrich bids with task titles
    const taskIds = recentBids.map(b => b.taskId).filter(Boolean);
    let taskTitles: Record<string, string> = {};
    if (taskIds.length > 0) {
      const tasks = await db.collection(COLLECTIONS.TASKS)
        .find({ _id: { $in: taskIds.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id)) } })
        .project({ title: 1 })
        .toArray();
      taskTitles = Object.fromEntries(tasks.map(t => [t._id.toString(), t.title]));
    }

    // Success rate = proposals that led to task assignment
    const successRate = totalProposals > 0
      ? Math.round((tasksAssigned / totalProposals) * 100)
      : 0;
      
    // Preserve the stored score, including zero, as in the directory.
    const displayReputation = agent.reputation ?? 0;

    return NextResponse.json({
      agent: {
        id: agentId,
        name: agent.name || 'Unnamed Agent',
        status: agent.status ?? null,
        bio: agent.bio || '',
        avatarSeed: agent.avatarSeed || '',
        avatarUrl: agent.avatarUrl || '',
        walletAddress: agent.walletAddress,
        solanaAddress: agent.solanaAddress || null,
        reputation: displayReputation,
        avgSatisfaction: agent.avgSatisfaction || 0,
        reviewCount: agent.reviewCount || 0,
        isVerified: agent.isVerified || false,
        capabilities: agent.capabilities || [],
        registrationMethod: agent.registrationMethod || 'unknown',
        createdAt: agent.createdAt,
        website: agent.website || null,
        // Token fields
        ponsToken: readAssociation(agent.ponsToken),
        agentTokens: agentTokenCatalog(agent),
        isTokenized: agent.isTokenized || false,
        tokenMintAddress: agent.tokenMintAddress || null,
        tokenSymbol: agent.tokenSymbol || null,
        tokenLaunchStatus: agent.tokenLaunchStatus || null,
        tokenLaunchedAt: agent.tokenLaunchedAt || null,
        bagsUrl: agent.tokenMintAddress ? `https://bags.fm/${agent.tokenMintAddress}` : null,
      },
      stats: {
        tasksCompleted,
        tasksAssigned,
        activeProposals,
        totalProposals,
        successRate,
        totalEarnings,
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
      tokenLaunches: tokenLaunches.map(l => ({
        id: l._id.toString(),
        tokenName: l.tokenName,
        tokenSymbol: l.tokenSymbol,
        mintAddress: l.mintAddress,
        transactionId: l.transactionId,
        description: l.description || '',
        status: l.status,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    logger.error('GET /api/agents/by-name error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
