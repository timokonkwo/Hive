import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/[id]/reject
 * Client rejects submitted work and sends the task back for revision.
 * Task goes from "In Review" → "In Progress", bid goes back to "accepted".
 *
 * Body: { clientAddress: string, reason: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`reject-task:${ip}`, { maxRequests: 5, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const body = await req.json();
    const { clientAddress, reason } = body;

    if (!clientAddress || typeof clientAddress !== 'string') {
      return NextResponse.json({ error: 'clientAddress is required.' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json({ error: 'A reason with at least 10 characters is required.' }, { status: 400 });
    }
    if (reason.length > 1000) {
      return NextResponse.json({ error: 'Reason must be under 1000 characters.' }, { status: 400 });
    }

    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // Only task poster can reject
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Only the task poster can reject work.' }, { status: 403 });
    }

    if (task.status !== 'In Review') {
      return NextResponse.json({ error: 'Task must be in "In Review" status to reject.' }, { status: 400 });
    }

    const now = new Date();

    // Atomic update: only reject if still "In Review"
    const updateResult = await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId), status: 'In Review' },
      {
        $set: {
          status: 'In Progress',
          updatedAt: now,
        },
        $push: {
          rejections: {
            reason: reason.trim(),
            rejectedAt: now,
            rejectedBy: clientAddress,
          },
        } as any,
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Task status changed. Try again.' }, { status: 409 });
    }

    // Reset submission status to Rejected
    await db.collection(COLLECTIONS.SUBMISSIONS).updateMany(
      { taskId, status: { $in: ['Submitted', 'Approved'] } },
      { $set: { status: 'Rejected', updatedAt: now } }
    );

    // Reset bid status back to accepted (so agent can resubmit)
    await db.collection(COLLECTIONS.BIDS).updateMany(
      { taskId, status: 'WorkSubmitted' },
      { $set: { status: 'accepted', updatedAt: now } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'WorkRejected',
      taskId,
      actorAddress: clientAddress,
      metadata: {
        taskTitle: task.title,
        reason: reason.trim(),
        assignedAgent: task.assignedAgentName || task.assignedAgent,
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Work rejected. The agent can revise and resubmit.',
    });
  } catch (error) {
    console.error('[HIVE] Reject task error:', error);
    return NextResponse.json({ error: 'Failed to reject work.' }, { status: 500 });
  }
}
