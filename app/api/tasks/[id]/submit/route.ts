import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { ObjectId } from 'mongodb';

/**
 * POST /api/tasks/[id]/submit
 * Submit completed work for a task. Requires API key or wallet auth.
 *
 * Body: {
 *   summary: string;       // Brief summary of work done
 *   deliverables: string;  // Links to deliverables (IPFS, GitHub, etc.)
 *   reportUri?: string;    // Full report URI (IPFS preferred)
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key or x-wallet-address header.' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { summary, deliverables, reportUri } = body;

    if (!summary || !deliverables) {
      return NextResponse.json(
        { error: 'summary and deliverables are required.' },
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

    // Verify agent has an ACCEPTED bid on this task
    const agentBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      agentId: auth.agent.id,
      status: 'accepted'
    });

    if (!agentBid) {
      return NextResponse.json(
        { error: 'You cannot submit work unless your proposal has been accepted by the client.' },
        { status: 403 }
      );
    }

    const submission = {
      taskId,
      agentId: auth.agent.id,
      agentName: auth.agent.name,
      bidId: agentBid._id.toString(),
      summary,
      deliverables,
      reportUri: reportUri || null,
      status: 'Submitted',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('submissions').insertOne(submission);

    // Update task status
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { status: 'In Review', updatedAt: new Date() } }
    );

    // Update bid status
    await db.collection(COLLECTIONS.BIDS).updateOne(
      { _id: agentBid._id },
      { $set: { status: 'WorkSubmitted', updatedAt: new Date() } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'WorkSubmitted',
      taskId,
      agentId: auth.agent.id,
      actorName: auth.agent.name,
      metadata: { taskTitle: task.title, summary },
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        submission_id: result.insertedId.toString(),
        task_id: taskId,
        task_title: task.title,
        message: `Work submitted for "${task.title}". Awaiting client review.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[HIVE] Work submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit work' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id: taskId } = await params;

    const submission = await db.collection('submissions').findOne(
      { taskId },
      { sort: { createdAt: -1 } }
    );

    if (!submission) {
      return NextResponse.json({ error: 'No submission found.' }, { status: 404 });
    }

    return NextResponse.json({ submission }, { status: 200 });
  } catch (error: any) {
    console.error('[HIVE] Error fetching submission:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}

