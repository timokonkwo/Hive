import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateTokenConfig, validateDeliverableSpecs } from "@/lib/submission-validator";

// GET /api/tasks — List tasks with optional filters
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`list-tasks:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const sortParam = searchParams.get("sort") || "createdAt";
    const orderParam = searchParams.get("order") === "asc" ? 1 : -1;

    // Build query
    const query: Record<string, any> = {};
    if (category && category !== "All") query.category = category;
    if (status && status !== "All") query.status = status;
    if (search) {
      // Escape regex special characters to prevent injection
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { tags: { $elemMatch: { $regex: escaped, $options: "i" } } },
      ];
    }

    const skip = (page - 1) * limit;

    // Build sort object
    const allowedSorts = ["createdAt", "proposalsCount", "budget"];
    const sortField = allowedSorts.includes(sortParam) ? sortParam : "createdAt";
    const sortObj = { [sortField]: orderParam } as any;

    const [tasks, total] = await Promise.all([
      db
        .collection(COLLECTIONS.TASKS)
        .find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.TASKS).countDocuments(query),
    ]);

    // Map _id to id and add a full URL for frontend compatibility
    const mapped = tasks.map((t) => ({
      ...t,
      id: t._id.toString(),
      url: `https://uphive.xyz/marketplace/${t._id.toString()}`,
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
    // Rate limit: 10 task creations per minute per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`create-task:${ip}`, RATE_LIMITS.CREATE_TASK);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const body = await request.json();

    const {
      title, description, category, tags, requirements, budget,
      clientAddress, clientName,
      tokenConfig,       // For "Token Launch" tasks
      deliverableSpecs,  // Structured specs for what agent must deliver
    } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: "title, description, and category are required" },
        { status: 400 }
      );
    }

    // Validate tokenConfig for Token Launch tasks (optional — agent figures out details)
    let validatedTokenConfig = null;
    if (category === 'Token Launch' && tokenConfig) {
      const tcResult = validateTokenConfig(tokenConfig);
      if (!tcResult.valid) {
        return NextResponse.json(
          { error: 'Invalid tokenConfig.', details: tcResult.errors },
          { status: 400 }
        );
      }
      validatedTokenConfig = {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        description: tokenConfig.description,
        website: tokenConfig.website || null,
        twitter: tokenConfig.twitter || null,
        telegram: tokenConfig.telegram || null,
        feeSharing: tokenConfig.feeSharing || null,
        initialBuyAmountSol: tokenConfig.initialBuyAmountSol || 0,
      };
    }

    // Validate deliverable specs (if provided)
    let finalSpecs: any[] = [];
    if (deliverableSpecs && Array.isArray(deliverableSpecs) && deliverableSpecs.length > 0) {
      const specResult = validateDeliverableSpecs(deliverableSpecs);
      if (!specResult.valid) {
        return NextResponse.json(
          { error: 'Invalid deliverableSpecs.', details: specResult.errors },
          { status: 400 }
        );
      }
      finalSpecs = deliverableSpecs;
    }

    // Auto-generate specs for Token Launch tasks if none provided
    if (category === 'Token Launch' && finalSpecs.length === 0) {
      const specDescription = validatedTokenConfig
        ? `Launch token "${validatedTokenConfig.name}" (${validatedTokenConfig.symbol}) on Bags/Solana`
        : 'Launch a token on Bags/Solana based on the task description';
      finalSpecs = [
        {
          type: 'token_launch',
          label: 'Token Launch',
          description: specDescription,
          required: true,
        },
      ];
    }

    // Derive a display name from the client's wallet if no name provided
    const displayName = clientName || (clientAddress ? `User_${clientAddress.slice(-6)}` : 'User');

    // Parse numeric budget amount from budget string (e.g. "$50 USDC" → 50)
    let budgetAmount = 0;
    if (budget) {
      const match = String(budget).match(/([\d.]+)/);
      if (match) budgetAmount = parseFloat(match[1]);
    }

    const task = {
      title,
      description,
      category,
      tags: tags || [],
      requirements: requirements || "",
      budget: budget || "Negotiable",
      budgetAmount,
      status: "Open",
      clientAddress: clientAddress || "unknown",
      clientName: displayName,
      assignedAgent: null,
      proposalsCount: 0,
      tokenConfig: validatedTokenConfig,
      deliverableSpecs: finalSpecs,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.TASKS).insertOne(task);

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: "TaskCreated",
      taskId: result.insertedId,
      actorAddress: clientAddress || "unknown",
      actorName: displayName,
      metadata: { title, category, budget, hasTokenConfig: !!validatedTokenConfig },
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

