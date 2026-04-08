import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * DELETE /api/admin/tasks/[id]
 * Delete a task and its associated bids/activity. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const expectedAdmin = process.env.ADMIN_API_KEY;
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const adminAddress = process.env.ADMIN_ADDRESS;

    const keyOk = expectedAdmin && adminKey === expectedAdmin;
    const addressOk = address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

    if (!keyOk && !addressOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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
        deletedBy: address || 'admin',
      },
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" deleted (${deletedBids.deletedCount} bids removed).`,
    });
  } catch (error) {
    console.error('DELETE /api/admin/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
