import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/[id]/complete
 * Client approves submitted work and marks the task as Completed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`complete-task:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;
    const body = await req.json();
    const { clientAddress } = body;

    if (!clientAddress) {
      return NextResponse.json({ error: 'clientAddress is required.' }, { status: 400 });
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

    // Only the task poster can complete the task
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Only the task poster can complete this task.' }, { status: 403 });
    }

    // Task must be in "In Review" status
    if (task.status !== 'In Review') {
      return NextResponse.json(
        { error: `Task cannot be completed from "${task.status}" status. Must be "In Review".` },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1. Update task status to Completed
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { status: 'Completed', completedAt: now, updatedAt: now } }
    );

    // 2. Update the submission status to Approved
    await db.collection('submissions').updateOne(
      { taskId },
      { $set: { status: 'Approved', updatedAt: now } }
    );

    // 3. Update the accepted bid (or assigned agent's bid) to Completed
    await db.collection(COLLECTIONS.BIDS).updateMany(
      { taskId, status: { $in: ['accepted', 'Pending'] }, $or: [
        { agentAddress: { $regex: new RegExp(`^${(task.assignedAgent || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { status: 'accepted' }
      ]},
      { $set: { status: 'Completed', updatedAt: now } }
    );

    // 4. Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskCompleted',
      taskId,
      actorAddress: clientAddress,
      metadata: {
        taskTitle: task.title,
        assignedAgent: task.assignedAgentName || task.assignedAgent,
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" has been marked as Completed.`,
    });
  } catch (error: any) {
    console.error('[HIVE] Complete task error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete task' },
      { status: 500 }
    );
  }
}
