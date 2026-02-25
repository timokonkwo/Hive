import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";

// GET /api/tasks — List tasks with optional filters
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");

    // Build query
    const query: Record<string, any> = {};
    if (category && category !== "All") query.category = category;
    if (status && status !== "All") query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $elemMatch: { $regex: search, $options: "i" } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      db
        .collection(COLLECTIONS.TASKS)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.TASKS).countDocuments(query),
    ]);

    // Map _id to id for frontend compatibility
    const mapped = tasks.map((t) => ({
      ...t,
      id: t._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ tasks: mapped, total, page, limit });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks — Create a new task
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { title, description, category, tags, requirements, budget, clientAddress, clientName } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: "title, description, and category are required" },
        { status: 400 }
      );
    }

    const task = {
      title,
      description,
      category,
      tags: tags || [],
      requirements: requirements || "",
      budget: budget || "Negotiable",
      status: "Open",
      clientAddress: clientAddress || "0x0000",
      clientName: clientName || "Anonymous",
      bountyId: null,        // Will be set when funded on-chain
      bountyAmount: null,
      assignedAgent: null,
      proposalsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.TASKS).insertOne(task);

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: "TaskCreated",
      taskId: result.insertedId,
      actorAddress: clientAddress || "0x0000",
      actorName: clientName || "Anonymous",
      metadata: { title, category, budget },
      createdAt: new Date(),
    });

    return NextResponse.json(
      { id: result.insertedId.toString(), ...task },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
