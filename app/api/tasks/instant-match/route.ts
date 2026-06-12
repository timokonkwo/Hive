import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { validateTokenConfig, validateDeliverableSpecs } from '@/lib/submission-validator';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { authenticateClient } from '@/lib/client-auth';
import { rankAgentsForTask } from '@/lib/smart-matching';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import { validateAcceptanceRubric } from '@/lib/task-builder';
import { awardPoints } from '@/lib/points';
import { logger } from '@/lib/logger';
import { requireHumanVerification } from '@/lib/human-verification';
import { taskBodyTooLarge, validateHumanTaskInput } from '@/lib/task-security';

/**
 * POST /api/tasks/instant-match
 * 
 * One-click task creation + auto-assignment.
 * Creates the task and immediately assigns the best available agent using
 * the shared smart matching scorer.
 * 
 * Same body as POST /api/tasks, plus the instant match is implied.
 */
export async function POST(request: NextRequest) {
  try {
    if (taskBodyTooLarge(request)) {
      return NextResponse.json({ error: 'Task payload is too large.' }, { status: 413 });
    }

    // Rate limit: same as regular task creation
    const ip = getClientIp(request);
    const rl = checkRateLimit(`create-task:${ip}`, RATE_LIMITS.CREATE_TASK);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    // Auth: require Privy JWT
    const verified = await authenticateClient(request);
    if (!verified) {
      return NextResponse.json(
        { error: 'Authentication required to create tasks.' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const body = await request.json();

    const {
      title, description, category, tags, requirements, budget,
      clientName,
      tokenConfig, deliverableSpecs, acceptanceRubric, humanVerificationToken,
    } = body;

    const human = await requireHumanVerification(request, humanVerificationToken, 'instant_match_task');
    if (!human.ok) {
      return NextResponse.json({ error: human.error }, { status: human.status });
    }

    const inputResult = validateHumanTaskInput({ title, description, category, tags, requirements, budget });
    if (!inputResult.valid) {
      return NextResponse.json({ error: inputResult.error }, { status: 400 });
    }
    const taskInput = inputResult.value;

    // Validate tokenConfig for Token Launch tasks
    let validatedTokenConfig = null;
    if (taskInput.category === 'Token Launch' && tokenConfig) {
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

    // Validate deliverable specs
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

    // Auto-generate specs for Token Launch tasks
    if (taskInput.category === 'Token Launch' && finalSpecs.length === 0) {
      finalSpecs = [{
        type: 'token_launch',
        label: 'Token Launch',
        description: validatedTokenConfig
          ? `Launch token "${validatedTokenConfig.name}" (${validatedTokenConfig.symbol}) on Bags/Solana`
          : 'Launch a token on Bags/Solana based on the task description',
        required: true,
      }];
    }

    const displayName = clientName || `User_${verified.userId.slice(-6)}`;

    const rubricResult = validateAcceptanceRubric(acceptanceRubric);
    if (!rubricResult.valid) {
      return NextResponse.json(
        { error: 'Invalid acceptanceRubric.', details: rubricResult.errors },
        { status: 400 }
      );
    }

    // ─── Find best available agent ─────────────────────────────────

    const matches = await rankAgentsForTask(
      db,
      {
        title: taskInput.title,
        description: taskInput.description,
        category: taskInput.category,
        requirements: taskInput.requirements,
        tags: taskInput.tags,
        budget: taskInput.budget,
        budgetAmount: taskInput.budgetAmount,
      },
      { limit: 5 }
    );

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No agents available for this category. Try posting as a regular task.' },
        { status: 404 }
      );
    }

    const bestMatch = matches[0];
    const bestAgent = bestMatch.agent;

    // ─── Create the task ─────────────────────────────────────────

    const task = {
      title: taskInput.title,
      description: taskInput.description,
      category: taskInput.category,
      tags: taskInput.tags,
      requirements: taskInput.requirements,
      budget: taskInput.budget,
      budgetAmount: taskInput.budgetAmount,
      status: 'In Progress',
      clientAddress: verified.userId,
      clientPrivyUserId: verified.userId,
      clientName: displayName,
      assignedAgent: bestAgent.name,
      assignedAgentId: bestAgent._id.toString(),
      proposalsCount: 1,
      tokenConfig: validatedTokenConfig,
      deliverableSpecs: finalSpecs,
      acceptanceRubric: rubricResult.rubric,
      instantMatch: true,
      matchScore: bestMatch.score,
      matchConfidence: bestMatch.confidence,
      creationSurface: 'web',
      humanVerified: !human.skipped,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskResult = await db.collection(COLLECTIONS.TASKS).insertOne(task);
    const taskId = taskResult.insertedId.toString();

    // ─── Create an auto-accepted bid ─────────────────────────────

    const bid = {
      taskId,
      agentId: bestAgent._id.toString(),
      agentName: bestAgent.name,
      agentAddress: bestAgent.solanaAddress || null,
      amount: taskInput.budget,
      timeEstimate: '2-4 days',
      coverLetter: `Matched automatically by Hive with ${bestMatch.confidence} confidence (${bestMatch.score}/100). ${bestMatch.reasons.join(' ')}`,
      status: 'accepted',
      autoMatched: true,
      matchScore: bestMatch.score,
      matchReasons: bestMatch.reasons,
      createdAt: new Date(),
    };

    await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    await db.collection(COLLECTIONS.TASK_MATCHES).updateOne(
      { taskId },
      {
        $set: {
          taskId,
          category: taskInput.category,
          matches: matches.map(({ agent, ...match }) => ({
            ...match,
            agent: {
              id: match.agentId,
              name: match.agentName,
              reputation: agent.reputation || 0,
              capabilities: agent.capabilities || [],
              isVerified: !!agent.isVerified,
            },
          })),
          selectedAgentId: bestAgent._id.toString(),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    // ─── Log activity ────────────────────────────────────────────

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskCreated',
      taskId: taskResult.insertedId,
      actorAddress: verified.userId,
      actorName: displayName,
      metadata: {
        title: taskInput.title,
        category: taskInput.category,
        budget: taskInput.budget,
        instantMatch: true,
        rubricItems: rubricResult.rubric.length,
        humanVerified: !human.skipped,
        authMethod: 'privy',
      },
      createdAt: new Date(),
    });

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'BidAccepted',
      taskId: taskResult.insertedId,
      actorName: bestAgent.name,
      metadata: {
        taskTitle: taskInput.title,
        agentName: bestAgent.name,
        agentId: bestAgent._id.toString(),
        autoMatched: true,
      },
      createdAt: new Date(),
    });

    // Award Hive Points: +100 for task creation, +50 for instant work assignment
    awardPoints(verified.userId, 'create_task', 100, { title: taskInput.title, taskId, category: taskInput.category, instantMatch: true })
      .catch((err: any) => logger.error('[POINTS] Task creation award failed:', err.message));
    awardPoints(bestAgent._id.toString(), 'work_assigned', 50, { title: taskInput.title, taskId, matchScore: bestMatch.score })
      .catch((err: any) => logger.error('[POINTS] Agent assignment award failed:', err.message));

    enqueueWebhookEvent(db, {
      event: 'task.created',
      taskId,
      actorName: displayName,
      data: { title: taskInput.title, category: taskInput.category, budget: taskInput.budget, instantMatch: true },
    }).catch((err) => logger.error('[WEBHOOK] task.created enqueue failed:', err.message));

    enqueueWebhookEvent(db, {
      event: 'bid.accepted',
      taskId,
      agentId: bestAgent._id.toString(),
      actorName: bestAgent.name,
      data: { taskTitle: taskInput.title, matchScore: bestMatch.score, instantMatch: true },
    }).catch((err) => logger.error('[WEBHOOK] bid.accepted enqueue failed:', err.message));

    return NextResponse.json(
      {
        id: taskId,
        ...task,
        assignedAgentId: bestAgent._id.toString(),
        assignedAgentName: bestAgent.name,
        assignedAgentReputation: bestAgent.reputation || 0,
        matchScore: bestMatch.score,
        matchConfidence: bestMatch.confidence,
        matchReasons: bestMatch.reasons,
        message: `Task created and instantly assigned to ${bestAgent.name} (${bestMatch.score}/100 match, ${bestMatch.confidence} confidence).`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('POST /api/tasks/instant-match error:', error);
    return NextResponse.json(
      { error: 'Failed to create instant match task' },
      { status: 500 }
    );
  }
}
