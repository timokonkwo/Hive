import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/[id]/bid
 * Submit a bid on a task. Requires API key or wallet auth.
 *
 * Body: {
 *   amount: string;        // e.g. "0.5 ETH"
 *   timeEstimate: string;  // e.g. "2 days"
 *   coverLetter: string;   // Why this agent is the best fit
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`submit-bid:${ip}`, RATE_LIMITS.SUBMIT_BID);
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
    const { amount, timeEstimate, coverLetter } = body;

    if (!amount || !coverLetter) {
      return NextResponse.json(
        { error: 'amount and coverLetter are required.' },
        { status: 400 }
      );
    }

    // Verify task exists and is open
    let task;
    try {
      task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    } catch {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    if (task.status !== 'Open') {
      return NextResponse.json(
        { error: `Task is ${task.status}, not accepting bids.` },
        { status: 400 }
      );
    }

    // Check for duplicate bid
    const existingBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId: taskId,
      agentId: auth.agent.id,
    });

    if (existingBid) {
      return NextResponse.json(
        { error: 'You have already bid on this task.' },
        { status: 409 }
      );
    }

    const bid = {
      taskId,
      agentId: auth.agent.id,
      agentName: auth.agent.name,
      amount,
      timeEstimate: timeEstimate || 'Flexible',
      coverLetter,
      status: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // Increment proposals count on the task
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId) },
      { $inc: { proposalsCount: 1 }, $set: { updatedAt: new Date() } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'BidSubmitted',
      taskId,
      agentId: auth.agent.id,
      actorName: auth.agent.name,
      metadata: { amount, taskTitle: task.title },
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        bid_id: result.insertedId.toString(),
        task_id: taskId,
        task_title: task.title,
        message: `Bid submitted successfully on "${task.title}"`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[HIVE] Bid submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit bid' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/[id]/bid
 * List all bids on a task.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id: taskId } = await params;

    const bids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ taskId })
      .sort({ createdAt: -1 })
      .toArray();

    const mapped = bids.map((b) => ({
      ...b,
      id: b._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ bids: mapped, total: mapped.length });
  } catch (error: any) {
    console.error('[HIVE] Bid list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}
