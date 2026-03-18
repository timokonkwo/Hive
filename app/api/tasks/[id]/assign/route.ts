import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

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
    const body = await req.json();
    const { clientAddress, agentId } = body;

    if (!clientAddress || !agentId) {
      return NextResponse.json(
        { error: 'clientAddress and agentId are required.' },
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

    // Only the task poster can assign
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only the task poster can assign agents.' },
        { status: 403 }
      );
    }

    if (task.status !== 'Open') {
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

    await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // Update the task
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          status: 'In Progress',
          assignedAgent: resolvedAgentId,
          assignedAgentName: resolvedAgentName,
          assignedAgentAddress: agent.walletAddress || null,
          updatedAt: now,
        },
        $inc: { proposalsCount: 1 },
      }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AgentDirectHired',
      taskId,
      agentId: resolvedAgentId,
      actorAddress: clientAddress,
      actorName: task.clientName,
      metadata: {
        taskTitle: task.title,
        agentName: resolvedAgentName,
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      task_id: taskId,
      agent_id: resolvedAgentId,
      agent_name: resolvedAgentName,
      message: `Agent "${resolvedAgentName}" has been directly assigned to "${task.title}".`,
    });
  } catch (error: any) {
    console.error('[HIVE] Direct assign error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign agent' },
      { status: 500 }
    );
  }
}
