import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateTokenConfig, validateDeliverableSpecs } from "@/lib/submission-validator";
import { notifyMatchingAgents } from "@/lib/agent-notifications";
import { authenticateClient } from "@/lib/client-auth";
import { enqueueWebhookEvent } from "@/lib/webhooks";
import { validateAcceptanceRubric } from "@/lib/task-builder";
import { awardPoints } from "@/lib/points";
import { rankAgentsForTask } from "@/lib/smart-matching";
import { logger } from '@/lib/logger';

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
    logger.error("GET /api/tasks error:", error);
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

    // Auth: task creation is a client action. Do not accept agent API keys here:
    // self-registered agent keys must not be able to manufacture marketplace demand.
    const client = await authenticateClient(request);
    if (!client) {
      return NextResponse.json(
        { error: 'Authentication required to create tasks.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      title, description, category, tags, requirements, budget,
      clientName,
      tokenConfig,       // For "Token Launch" tasks
      deliverableSpecs,  // Structured specs for what agent must deliver
      acceptanceRubric,  // Acceptance criteria clients can use during review
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

    // Store the verified Privy DID as the canonical owner. The request body
    // may include a display wallet address, but it must not control ownership.
    const verifiedAddress = client.userId;
    const displayName = clientName || (verifiedAddress.startsWith('did:privy:') ? `User_${verifiedAddress.slice(-6)}` : 'User');

    // Parse numeric budget amount from budget string (e.g. "$50 USDC" → 50)
    let budgetAmount = 0;
    if (budget) {
      const match = String(budget).match(/([\d.]+)/);
      if (match) budgetAmount = parseFloat(match[1]);
    }

    // Reject negative budgets
    if (budgetAmount < 0) {
      return NextResponse.json({ error: 'Budget cannot be negative.' }, { status: 400 });
    }

    const rubricResult = validateAcceptanceRubric(acceptanceRubric);
    if (!rubricResult.valid) {
      return NextResponse.json(
        { error: 'Invalid acceptanceRubric.', details: rubricResult.errors },
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
      budgetAmount,
      status: "Open",
      clientAddress: verifiedAddress,
      clientPrivyUserId: client?.userId || null,
      clientName: displayName,
      assignedAgent: null,
      proposalsCount: 0,
      tokenConfig: validatedTokenConfig,
      deliverableSpecs: finalSpecs,
      acceptanceRubric: rubricResult.rubric,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.TASKS).insertOne(task);

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: "TaskCreated",
      taskId: result.insertedId,
      actorAddress: client.userId,
      actorName: displayName,
      metadata: { title, category, budget, hasTokenConfig: !!validatedTokenConfig, rubricItems: rubricResult.rubric.length },
      createdAt: new Date(),
    });

    // Award 100 Hive Points for posting a task (excluding auto-posted tasks)
    const isMockClient = verifiedAddress.startsWith('did:privy:cl_');
    if (!isMockClient) {
      awardPoints(verifiedAddress, 'create_task', 100, { title, taskId: result.insertedId.toString() })
        .catch((err) => logger.error('[POINTS] Failed to award points for task creation:', err.message));
    }

    const taskId = result.insertedId.toString();

    let matchedAndAssigned = false;
    if (!isMockClient) {
      try {
        const matches = await rankAgentsForTask(db, {
          id: taskId,
          title,
          description,
          category,
          requirements: requirements || '',
          tags,
          budget,
          budgetAmount
        }, { limit: 1 });

        if (matches.length > 0) {
          const bestMatch = matches[0];
          // Assign task directly
          await db.collection(COLLECTIONS.TASKS).updateOne(
            { _id: result.insertedId },
            {
              $set: {
                status: 'In Progress',
                assignedAgent: bestMatch.agentId,
                assignedAgentName: bestMatch.agentName,
                updatedAt: new Date()
              }
            }
          );

          // Create accepted bid
          await db.collection(COLLECTIONS.BIDS).insertOne({
            taskId: taskId,
            agentId: bestMatch.agentId,
            agentName: bestMatch.agentName,
            amount: budgetAmount || 0,
            coverLetter: 'Directly assigned via Hive Smart Matching.',
            timeEstimate: 'Instant',
            status: 'accepted',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Log assignment activity
          await db.collection(COLLECTIONS.ACTIVITY).insertOne({
            type: 'ProposalAccepted',
            taskId: result.insertedId,
            actorName: 'System',
            metadata: {
              taskTitle: title,
              agentName: bestMatch.agentName,
              agentId: bestMatch.agentId,
              bidAmount: budgetAmount || 0,
              directAssigned: true
            },
            createdAt: new Date(),
          });

          // Send bid.accepted webhook
          enqueueWebhookEvent(db, {
            event: 'bid.accepted',
            taskId: taskId,
            agentId: bestMatch.agentId,
            actorName: displayName,
            data: { taskTitle: title, amount: budgetAmount || 0 }
          }).catch((err) => logger.error('[WEBHOOK] bid.accepted enqueue failed:', err.message));

          matchedAndAssigned = true;
          logger.info(`[DIRECT-ROUTING] Successfully assigned task "${title}" to "${bestMatch.agentName}"`);
        }
      } catch (err: any) {
        logger.error('[DIRECT-ROUTING] Failed to auto-match/assign task:', err.message);
      }
    }

    // Only trigger stealth bidding if not already matched and assigned
    if (!matchedAndAssigned) {
      // Trigger agent bidding directly (same-process, no HTTP)
      import('@/lib/stealth-agents/runner').then(({ handleNewTask }) => {
        handleNewTask({
          taskId,
          title,
          description,
          category,
          requirements: requirements || '',
          budget: budget || 'Negotiable',
        }).catch((err: any) => logger.error('[STEALTH] Agent bid failed:', err.message));
      }).catch((err) => logger.error('[STEALTH] Runner import failed:', err.message));

      // Notify matching agents (async, non-blocking)
      notifyMatchingAgents({
        taskId,
        title,
        category,
        budget: budget || 'Negotiable',
        description: description || '',
      }).catch((err) => logger.error('[NOTIFY] Agent notification failed:', err.message));
    }

    enqueueWebhookEvent(db, {
      event: 'task.created',
      taskId,
      actorName: displayName,
      data: { title, category, budget: budget || 'Negotiable' },
    }).catch((err) => logger.error('[WEBHOOK] task.created enqueue failed:', err.message));

    return NextResponse.json(
      { id: result.insertedId.toString(), ...task },
      { status: 201 }
    );
  } catch (error) {
    logger.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
