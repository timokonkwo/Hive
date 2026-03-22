import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// PATCH /api/tasks/[id]/bids/[bidId] — Accept or reject a proposal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bidId: string }> }
) {
  try {
    const { id: taskId, bidId } = await params;

    // Rate limit: 20 actions per minute per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`manage-bid:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const body = await request.json();

    const { status, clientAddress } = body;

    if (!status || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'accepted' or 'rejected'" },
        { status: 400 }
      );
    }

    // SECURITY: clientAddress is REQUIRED — never skip authorization
    if (!clientAddress || typeof clientAddress !== 'string') {
      return NextResponse.json(
        { error: "clientAddress is required." },
        { status: 400 }
      );
    }

    // Verify task exists and caller is the task poster
    let task;
    try {
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ _id: new ObjectId(taskId) });
    } catch {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // SECURITY: Authorization — only the task poster can accept/reject (fail-closed)
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the task poster can manage proposals" },
        { status: 403 }
      );
    }

    // Update the bid status
    let bidObjectId;
    try {
      bidObjectId = new ObjectId(bidId);
    } catch {
      return NextResponse.json({ error: "Invalid bid ID" }, { status: 400 });
    }

    const bid = await db
      .collection(COLLECTIONS.BIDS)
      .findOne({ _id: bidObjectId, taskId });

    if (!bid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    await db
      .collection(COLLECTIONS.BIDS)
      .updateOne({ _id: bidObjectId }, { $set: { status, updatedAt: new Date() } });

    // If accepted, update the task
    if (status === "accepted") {
      const queryIds = [{ id: taskId }];
      if (ObjectId.isValid(taskId)) {
        queryIds.push({ _id: new ObjectId(taskId) } as any);
      } else {
        queryIds.push({ _id: taskId } as any);
        queryIds.push({ _id: parseInt(taskId) } as any);
      }

      await db.collection(COLLECTIONS.TASKS).updateOne(
        { $or: queryIds },
        {
          $set: {
            status: "In Progress",
            assignedAgent: bid.agentId || bid.agentAddress,
            assignedAgentName: bid.agentName,
            assignedAgentAddress: bid.agentAddress || null,
            updatedAt: new Date(),
          },
        }
      );

      // Reject all other pending bids for this task
      await db.collection(COLLECTIONS.BIDS).updateMany(
        { taskId, _id: { $ne: bidObjectId }, status: "Pending" },
        { $set: { status: "rejected", updatedAt: new Date() } }
      );
    }

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: status === "accepted" ? "ProposalAccepted" : "ProposalRejected",
      taskId: new ObjectId(taskId),
      bidId: bidObjectId,
      actorAddress: clientAddress || task.clientAddress,
      metadata: {
        agentAddress: bid.agentAddress,
        agentName: bid.agentName,
        taskTitle: task.title,
      },
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("PATCH /api/tasks/[id]/bids/[bidId] error:", error);
    return NextResponse.json(
      { error: "Failed to update bid" },
      { status: 500 }
    );
  }
}
