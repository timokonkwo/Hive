import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/tasks/[id] — Get single task with bid count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`read-task:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    const db = await getDb();

    let task = null;
    const queryIds = [{ id: id }];
    if (ObjectId.isValid(id)) {
      queryIds.push({ _id: new ObjectId(id) } as any);
    } else {
      queryIds.push({ _id: id } as any);
      queryIds.push({ _id: parseInt(id) } as any);
    }
    
    try {
      console.log(`[TASKS API] Fetching task with ID: "${id}"`);
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ $or: queryIds });
    } catch (e) {
      console.error(`[TASKS API] Error fetching "${id}":`, e);
    }

    if (!task) {
      console.log(`[TASKS API] Task NOT FOUND for ID: "${id}"`);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get bid count
    const proposalsCount = await db
      .collection(COLLECTIONS.BIDS)
      .countDocuments({ taskId: id });

    // Fetch token launch data if this is a Token Launch task
    let tokenLaunch = null;
    if (task.category === 'Token Launch') {
      const launch = await db
        .collection(COLLECTIONS.TOKEN_LAUNCHES)
        .findOne({ taskId: id });
      if (launch) {
        tokenLaunch = {
          mintAddress: launch.mintAddress || null,
          bagsUrl: launch.bagsUrl || null,
          status: launch.status || 'pending',
          launchSignature: launch.launchSignature || null,
          tokenName: launch.tokenName || null,
          tokenSymbol: launch.tokenSymbol || null,
          createdAt: launch.createdAt || null,
        };
      }
    }

    return NextResponse.json({
      ...task,
      id: task._id.toString(),
      url: `https://uphive.xyz/marketplace/${task._id.toString()}`,
      _id: undefined,
      proposalsCount,
      tokenLaunch,
    });
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] — Update task (requires task poster authorization)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`update-task:${ip}`, RATE_LIMITS.CREATE_TASK);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    const db = await getDb();
    const body = await request.json();

    const { clientAddress } = body;

    // Authorization: clientAddress is required
    if (!clientAddress) {
      return NextResponse.json(
        { error: "clientAddress is required for authorization." },
        { status: 401 }
      );
    }

    // Find the task
    let task;
    try {
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify the caller is the task poster
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the task poster can update this task." },
        { status: 403 }
      );
    }

    // Only allow specific fields to be updated by the poster
    const allowedFields = [
      "status",
      "title",
      "description",
      "tags",
      "requirements",
      "budget",
      "bountyId",
      "bountyAmount",
      "assignedAgent",
    ];

    const update: Record<string, any> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    const result = await db
      .collection(COLLECTIONS.TASKS)
      .updateOne({ _id: new ObjectId(id) }, { $set: update });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] — Admin-only task deletion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Admin auth: check x-admin-address header against ADMIN_ADDRESS env var
    const adminAddress = request.headers.get('x-admin-address');
    const expectedAdmin = process.env.ADMIN_ADDRESS;

    if (!adminAddress || !expectedAdmin || adminAddress.toLowerCase() !== expectedAdmin.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const db = await getDb();

    // Find the task first (for logging)
    let task;
    try {
      task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Delete the task and associated bids
    const [deleteResult] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).deleteOne({ _id: new ObjectId(id) }),
      db.collection(COLLECTIONS.BIDS).deleteMany({ taskId: id }),
      db.collection(COLLECTIONS.SUBMISSIONS).deleteMany({ taskId: id }),
    ]);

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskDeleted',
      taskId: id,
      taskTitle: task.title,
      deletedBy: adminAddress,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: `Task "${task.title}" deleted.` });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
