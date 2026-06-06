import { verifyAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/admin/tasks/[id]
 * Delete a task and its associated bids/activity. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);

    const { id } = await params;
    const db = await getDb();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(id) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // Delete the task
    await db.collection(COLLECTIONS.TASKS).deleteOne({ _id: new ObjectId(id) });

    // Cascade: remove associated bids
    const deletedBids = await db.collection(COLLECTIONS.BIDS).deleteMany({ taskId: id });

    // Cascade: remove associated activity
    await db.collection(COLLECTIONS.ACTIVITY).deleteMany({
      taskId: { $in: [id, new ObjectId(id)] },
    });

    // Log the deletion
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskDeleted',
      taskId: id,
      actorName: 'Admin',
      metadata: {
        taskTitle: task.title,
        category: task.category,
        bidsDeleted: deletedBids.deletedCount,
        deletedBy: 'admin',
      },
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" deleted (${deletedBids.deletedCount} bids removed).`,
    });
  } catch (error) {
    logger.error('DELETE /api/admin/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

const ALLOWED_STATUSES = ['Open', 'In Progress', 'In Review', 'Completed'] as const;

/**
 * PATCH /api/admin/tasks/[id]
 * Update task status. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();

    const { id } = await params;
    const db = await getDb();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(id) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const { status } = body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    const updates: any = { status, updatedAt: now };

    // If resetting to Open, clear assignment state
    if (status === 'Open') {
      updates.assignedAgent = null;
      updates.assignedAgentName = null;
      // Remove all bids so agents can rebid
      await db.collection(COLLECTIONS.BIDS).deleteMany({ taskId: id });
      // Remove submissions
      await db.collection(COLLECTIONS.SUBMISSIONS).deleteMany({ taskId: id });
    }

    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskStatusChanged',
      taskId: id,
      actorName: 'Admin',
      metadata: {
        taskTitle: task.title,
        oldStatus: task.status,
        newStatus: status,
        changedBy: 'admin',
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" status changed: ${task.status} → ${status}`,
    });
  } catch (error) {
    logger.error('PATCH /api/admin/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
