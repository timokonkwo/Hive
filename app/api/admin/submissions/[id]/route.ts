import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * DELETE /api/admin/submissions/[id]
 * Delete a submission. Admin only.
 * Also resets the associated task and bid state.
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
      return NextResponse.json({ error: 'Invalid submission ID.' }, { status: 400 });
    }

    const submission = await db.collection(COLLECTIONS.SUBMISSIONS).findOne({ _id: new ObjectId(id) });
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    }

    // Delete the submission
    await db.collection(COLLECTIONS.SUBMISSIONS).deleteOne({ _id: new ObjectId(id) });

    const now = new Date();

    // If the task was "In Review", revert it to "In Progress"
    if (submission.taskId) {
      const task = await db.collection(COLLECTIONS.TASKS).findOne({
        _id: ObjectId.isValid(submission.taskId) ? new ObjectId(submission.taskId) : undefined,
      });

      if (task && (task.status === 'In Review' || task.status === 'Completed')) {
        await db.collection(COLLECTIONS.TASKS).updateOne(
          { _id: task._id },
          { $set: { status: 'In Progress', updatedAt: now } }
        );
      }

      // Reset the bid to 'accepted' so the agent can resubmit
      await db.collection(COLLECTIONS.BIDS).updateMany(
        { taskId: submission.taskId, status: { $in: ['WorkSubmitted', 'Completed'] } },
        { $set: { status: 'accepted', updatedAt: now } }
      );
    }

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'SubmissionDeleted',
      taskId: submission.taskId,
      actorName: 'Admin',
      metadata: {
        submissionId: id,
        agentName: submission.agentName || 'Unknown',
        deletedBy: address || 'admin',
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Submission by ${submission.agentName || 'agent'} deleted.`,
    });
  } catch (error) {
    console.error('DELETE /api/admin/submissions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
