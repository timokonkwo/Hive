import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { authenticateClient } from "@/lib/client-auth";
import { verifiedClientOwnsResource } from "@/lib/client-ownership";
import { verifyAdmin } from "@/lib/admin-auth";
import { logger } from '@/lib/logger';
import { redactTaskForPublic } from "@/lib/public-redaction";

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
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ $or: queryIds });
    } catch (e) {
      logger.error(`[TASKS API] Error fetching "${id}":`, e);
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const assignedId = task.assignedAgentId || task.assignedAgent;
    const assignedProfile = typeof assignedId === 'string' && ObjectId.isValid(assignedId) ? await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(assignedId) }, { projection: { avatarSeed: 1 } }) : null;

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

    // Check if a review exists for this task
    let review = null;
    if (task.status === 'Completed') {
      const existingReview = await db.collection('reviews').findOne(
        { taskId: task._id.toString() },
        { projection: { satisfaction: 1, comment: 1, tags: 1, createdAt: 1 } }
      );
      if (existingReview) {
        review = {
          satisfaction: existingReview.satisfaction,
          comment: existingReview.comment,
          tags: existingReview.tags,
          createdAt: existingReview.createdAt,
        };
      }
    }

    const publicTask = redactTaskForPublic(task);
    const publicTaskId = task._id.toString();

    const verified = await authenticateClient(request);
    const claimedAddress = request.nextUrl.searchParams.get('address');
    const isOwner = !!verified && verifiedClientOwnsResource(verified, task, claimedAddress);
    return NextResponse.json({
      ...publicTask,
      access: { isOwner },
      agentAvatarSeed: assignedProfile?.avatarSeed || null,
      id: publicTaskId,
      url: `https://uphive.xyz/marketplace/${publicTaskId}`,
      _id: undefined,
      proposalsCount,
      tokenLaunch,
      hasReview: !!review,
      review,
    }, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" } });
  } catch (error) {
    logger.error("GET /api/tasks/[id] error:", error);
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

    const verified = await authenticateClient(request);
    if (!verified) {
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
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

    if (!verifiedClientOwnsResource(verified, task, clientAddress)) {
      return NextResponse.json(
        { error: "Only the task poster can update this task." },
        { status: 403 }
      );
    }

    // Only allow specific fields to be updated by the poster
    // NOTE: "status" is intentionally excluded — status transitions must go through
    // dedicated endpoints (complete, reject, assign) to enforce business rules.
    const allowedFields = [
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
    logger.error("PATCH /api/tasks/[id] error:", error);
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

    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

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
      deletedBy: admin.client?.userId || 'admin_api_key',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: `Task "${task.title}" deleted.` });
  } catch (error) {
    logger.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
