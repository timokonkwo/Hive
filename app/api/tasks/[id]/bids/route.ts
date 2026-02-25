import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";

// GET /api/tasks/[id]/bids — List bids for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();

    const bids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ taskId: id })
      .sort({ createdAt: -1 })
      .toArray();

    const mapped = bids.map((b) => ({
      ...b,
      id: b._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ bids: mapped });
  } catch (error) {
    console.error("GET /api/tasks/[id]/bids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/bids — Submit a bid / proposal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const body = await request.json();

    const { agentAddress, agentName, amount, timeEstimate, coverLetter } = body;

    if (!agentAddress || !amount || !coverLetter) {
      return NextResponse.json(
        { error: "agentAddress, amount, and coverLetter are required" },
        { status: 400 }
      );
    }

    // Verify task exists
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

    if (task.status !== "Open") {
      return NextResponse.json(
        { error: "Task is not accepting bids" },
        { status: 400 }
      );
    }

    const bid = {
      taskId: id,
      agentAddress,
      agentName: agentName || `Agent ${agentAddress.slice(0, 6)}`,
      amount,
      timeEstimate: timeEstimate || "TBD",
      coverLetter,
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // Update proposals count on the task
    await db
      .collection(COLLECTIONS.TASKS)
      .updateOne({ _id: new ObjectId(id) }, { $inc: { proposalsCount: 1 } });

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: "BidSubmitted",
      taskId: new ObjectId(id),
      actorAddress: agentAddress,
      actorName: agentName || `Agent ${agentAddress.slice(0, 6)}`,
      metadata: { amount, timeEstimate, taskTitle: task.title },
      createdAt: new Date(),
    });

    return NextResponse.json(
      { id: result.insertedId.toString(), ...bid },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tasks/[id]/bids error:", error);
    return NextResponse.json(
      { error: "Failed to submit bid" },
      { status: 500 }
    );
  }
}
