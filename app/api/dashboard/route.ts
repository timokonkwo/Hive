import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/dashboard?address=0x... — Fetch user's tasks and bids
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "address query parameter required" },
        { status: 400 }
      );
    }

    const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const addressRegex = new RegExp(`^${escaped}$`, "i");

    // Tasks posted by this user
    const postedTasks = await db
      .collection(COLLECTIONS.TASKS)
      .find({ clientAddress: { $regex: addressRegex } })
      .sort({ createdAt: -1 })
      .toArray();

    const postedTasksMapped = postedTasks.map((t) => ({
      ...t,
      id: t._id.toString(),
      _id: undefined,
    }));

    // Check which completed tasks have reviews
    const completedTaskIds = postedTasks
      .filter(t => t.status === 'Completed')
      .map(t => t._id.toString());

    let reviewedTaskIds = new Set<string>();
    if (completedTaskIds.length > 0) {
      const reviews = await db.collection('reviews')
        .find({ taskId: { $in: completedTaskIds } }, { projection: { taskId: 1 } })
        .toArray();
      reviewedTaskIds = new Set(reviews.map((r: any) => r.taskId));
    }

    const postedTasksWithReviews = postedTasksMapped.map((t: any) => ({
      ...t,
      hasReview: reviewedTaskIds.has(t.id),
    }));

    // Bids/proposals submitted by this user
    const myBids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ agentAddress: { $regex: addressRegex } })
      .sort({ createdAt: -1 })
      .toArray();

    const myBidsMapped = myBids.map((b: any) => ({
      ...b,
      id: b._id.toString(),
      _id: undefined,
    }));

    // Get task titles for the bids
    const taskIds = [...new Set(myBids.map((b) => b.taskId))];
    const relatedTasks = taskIds.length > 0
      ? await db.collection(COLLECTIONS.TASKS).find({
          _id: { $in: taskIds.map((id) => {
            try { return new (require("mongodb").ObjectId)(id); } catch { return null; }
          }).filter(Boolean) },
        }).toArray()
      : [];

    const taskMap = new Map(relatedTasks.map((t: any) => [t._id.toString(), t.title]));
    const bidsWithTitles = myBidsMapped.map((b: any) => ({
      ...b,
      taskTitle: taskMap.get(b.taskId) || "Unknown Task",
    }));

    // Get proposals on user's posted tasks
    const postedTaskIds = postedTasks.map((t) => t._id.toString());
    const incomingProposals = postedTaskIds.length > 0
      ? await db
          .collection(COLLECTIONS.BIDS)
          .find({ taskId: { $in: postedTaskIds } })
          .sort({ createdAt: -1 })
          .toArray()
      : [];

    const incomingMapped = incomingProposals.map((b: any) => ({
      ...b,
      id: b._id.toString(),
      _id: undefined,
      taskTitle: postedTasks.find((t: any) => t._id.toString() === b.taskId)?.title || "Unknown",
    }));

    // Stats
    const stats = {
      totalPosted: postedTasks.length,
      openTasks: postedTasks.filter((t) => t.status === "Open").length,
      inProgressTasks: postedTasks.filter((t) => t.status === "In Progress").length,
      inReviewTasks: postedTasks.filter((t) => t.status === "In Review").length,
      completedTasks: postedTasks.filter((t) => t.status === "Completed").length,
      totalBidsSubmitted: myBids.length,
      activeBids: myBids.filter((b) => b.status === "Pending").length,
      acceptedBids: myBids.filter((b) => b.status === "accepted").length,
      incomingProposals: incomingProposals.length,
      pendingReviews: postedTasks.filter((t) => t.status === "In Review").length,
    };

    return NextResponse.json({
      postedTasks: postedTasksWithReviews,
      myBids: bidsWithTitles,
      incomingProposals: incomingMapped,
      stats,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
