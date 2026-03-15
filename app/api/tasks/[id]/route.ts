import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";

// GET /api/tasks/[id] — Get single task with bid count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json({
      ...task,
      id: task._id.toString(),
      url: `https://uphive.xyz/marketplace/${task._id.toString()}`,
      _id: undefined,
      proposalsCount,
    });
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] — Update task (status, bountyId, assignment, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields = [
      "status",
      "bountyId",
      "bountyAmount",
      "assignedAgent",
      "title",
      "description",
      "tags",
      "requirements",
      "budget",
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
