import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { authenticateClient } from '@/lib/client-auth';
import { getClientActorAddress, verifiedClientOwnsResource } from '@/lib/client-ownership';
import { logger } from '@/lib/logger';

/**
 * POST /api/tasks/[id]/assign
 * Direct-hire: assign a specific agent to a task.
 * Creates an auto-accepted bid and sets task to "In Progress".
 * Only the task poster can assign.
 *
 * Body: {
 *   clientAddress: string;   // The poster's wallet address (for auth)
 *   agentId: string;         // The agent's MongoDB _id to assign
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`assign-task:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;

    // Auth: require Privy JWT
    const verified = await authenticateClient(req);
    if (!verified) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { clientAddress, agentId } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required.' },
        { status: 400 }
      );
    }

    // Verify task exists
    let task;
    try {
      task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    } catch {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    if (!verifiedClientOwnsResource(verified, task, clientAddress)) {
      return NextResponse.json(
        { error: 'Only the task poster can assign agents.' },
        { status: 403 }
      );
    }
    const actorAddress = getClientActorAddress(verified, task, clientAddress);

    const alreadyAssigned = task.status === 'In Progress' && task.isDirectHire === true && task.assignedAgent === agentId;
    if (task.status !== 'Open' && !alreadyAssigned) {
      return NextResponse.json(
        { error: `Task is "${task.status}", not Open. Cannot assign.` },
        { status: 400 }
      );
    }

    // Verify agent exists
    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(agentId) });
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    if (!alreadyAssigned && agent.status != null && agent.status !== 'active') {
      return NextResponse.json({ error: 'This agent cannot be assigned.' }, { status: 409 });
    }
    if (!alreadyAssigned && task.assignmentMode === 'direct' && task.requestedAgentId !== agentId) {
      return NextResponse.json({ error: 'This task was created for another agent.' }, { status: 409 });
    }
    const now = new Date();
    const resolvedAgentId = agent._id.toString();
    const resolvedAgentName = agent.name || 'Unknown Agent';

    // Create an auto-accepted bid
    const bid = {
      taskId,
      agentId: resolvedAgentId,
      agentName: resolvedAgentName,
      agentAddress: agent.walletAddress || null,
      amount: task.budget || 'Direct Hire',
      timeEstimate: 'Direct Hire',
      coverLetter: 'Directly hired by the client.',
      status: 'accepted',
      isDirectHire: true,
      createdAt: now,
      updatedAt: now,
    };

    // Claim before adding a bid. Concurrent requests cannot assign different agents.
    if (!alreadyAssigned) {
      const claim = await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: new ObjectId(taskId), status: 'Open' },
        { $set: { status: 'In Progress', isDirectHire: true, assignedAgent: resolvedAgentId,
          assignedAgentId: resolvedAgentId, assignedAgentName: resolvedAgentName,
          assignedAgentAddress: agent.walletAddress || null, updatedAt: now }, $inc: { proposalsCount: 1 } }
      );
      if (claim.modifiedCount !== 1) return NextResponse.json({ error: 'The task changed. Open it to check the assigned agent.' }, { status: 409 });
    }
    // Deterministic record IDs make a retry repair an interrupted assignment without duplicate records.
    const recordId = (kind: string) => new ObjectId(createHash('sha256').update(`${kind}:${taskId}`).digest('hex').slice(0, 24));
    await db.collection(COLLECTIONS.BIDS).updateOne(
      { _id: recordId('direct-bid') }, { $setOnInsert: bid }, { upsert: true }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).updateOne({ _id: recordId('direct-activity') }, { $setOnInsert: {
      type: 'AgentDirectHired',
      taskId,
      agentId: resolvedAgentId,
      actorAddress,
      actorName: task.clientName,
      metadata: {
        taskTitle: task.title,
        agentName: resolvedAgentName,
      },
      createdAt: now,
    } }, { upsert: true });

    return NextResponse.json({
      success: true,
      task_id: taskId,
      agent_id: resolvedAgentId,
      agent_name: resolvedAgentName,
      message: `Agent "${resolvedAgentName}" has been directly assigned to "${task.title}".`,
    });
  } catch (error: any) {
    logger.error('[HIVE] Direct assign error:', error);
    return NextResponse.json(
      { error: 'Failed to assign agent.' },
      { status: 500 }
    );
  }
}
