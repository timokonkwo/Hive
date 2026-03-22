import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { validateSubmission } from '@/lib/submission-validator';
import type { DeliverableSubmission } from '@/lib/submission-validator';

/**
 * POST /api/tasks/[id]/submit
 * Submit completed work for a task. Requires API key or wallet auth.
 *
 * Body: {
 *   summary: string (min 20 chars, max 5000);
 *   deliverables: DeliverableSubmission[];
 *   reportUri?: string;
 * }
 *
 * If the task has deliverableSpecs, each deliverable is validated against
 * the spec it claims to fulfill (via specIndex). All required specs must
 * have a matching deliverable.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`submit-work:${ip}`, RATE_LIMITS.SUBMIT_WORK);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

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

    // Validate deliverables against specs (if task has specs)
    const specs = task.deliverableSpecs || [];
    const validation = validateSubmission(specs, deliverables, summary);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Submission validation failed.',
          details: validation.errors,
          specs: specs.map((s: any, i: number) => ({
            index: i,
            type: s.type,
            label: s.label,
            required: s.required,
            description: s.description,
          })),
        },
        { status: 400 }
      );
    }

    // Normalize deliverables
    const normalizedDeliverables: DeliverableSubmission[] = deliverables.map((d: any) => ({
      specIndex: d.specIndex ?? 0,
      type: d.type,
      label: d.label || (specs[d.specIndex]?.label ?? `Deliverable`),
      content: d.content,
      metadata: d.metadata || null,
    }));

    const submission = {
      taskId,
      agentId: auth.agent.id,
      agentName: auth.agent.name,
      bidId: agentBid._id.toString(),
      summary: summary.trim(),
      deliverables: normalizedDeliverables,
      reportUri: reportUri || null,
      status: 'Submitted',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.SUBMISSIONS).insertOne(submission);

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
      metadata: {
        taskTitle: task.title,
        summary: summary.substring(0, 200),
        deliverableCount: normalizedDeliverables.length,
        deliverableTypes: normalizedDeliverables.map((d: DeliverableSubmission) => d.type),
      },
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        submission_id: result.insertedId.toString(),
        task_id: taskId,
        task_title: task.title,
        deliverables_accepted: normalizedDeliverables.length,
        message: `Work submitted for "${task.title}". ${normalizedDeliverables.length} deliverable(s) validated. Awaiting client review.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[HIVE] Work submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit work.' },
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

    // Auth: only the task poster can view submissions
    const { searchParams } = new URL(req.url);
    const clientAddress = searchParams.get('address');

    if (!clientAddress) {
      return NextResponse.json({ error: 'address query parameter required.' }, { status: 400 });
    }

    // Look up the task to verify ownership
    let task;
    try {
      task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    } catch {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Only the task poster can view submissions.' }, { status: 403 });
    }

    // Get all submissions for the task (newest first)
    const submissions = await db.collection(COLLECTIONS.SUBMISSIONS)
      .find({ taskId })
      .sort({ createdAt: -1 })
      .toArray();

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found.' }, { status: 404 });
    }

    // Include the specs for comparison
    return NextResponse.json({
      deliverableSpecs: task.deliverableSpecs || [],
      submissions: submissions.map((s: any) => ({
        ...s,
        id: s._id.toString(),
        _id: undefined,
      })),
    });
  } catch (error: any) {
    console.error('[HIVE] Error fetching submission:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}
