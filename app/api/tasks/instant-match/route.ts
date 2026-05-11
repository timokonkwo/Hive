import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { validateTokenConfig, validateDeliverableSpecs } from '@/lib/submission-validator';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { authenticateClient } from '@/lib/client-auth';

/**
 * POST /api/tasks/instant-match
 * 
 * One-click task creation + auto-assignment.
 * Creates the task and immediately assigns the best available agent
 * in the task's category (by reputation, active in the last 7 days).
 * 
 * Same body as POST /api/tasks, plus the instant match is implied.
 */
export async function POST(request: NextRequest) {
  try {
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
      clientAddress, clientName,
      tokenConfig, deliverableSpecs,
    } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'title, description, and category are required' },
        { status: 400 }
      );
    }

    // Validate tokenConfig for Token Launch tasks
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
    if (category === 'Token Launch' && finalSpecs.length === 0) {
      finalSpecs = [{
        type: 'token_launch',
        label: 'Token Launch',
        description: validatedTokenConfig
          ? `Launch token "${validatedTokenConfig.name}" (${validatedTokenConfig.symbol}) on Bags/Solana`
          : 'Launch a token on Bags/Solana based on the task description',
        required: true,
      }];
    }

    const displayName = clientName || (clientAddress ? `User_${clientAddress.slice(-6)}` : 'User');

    let budgetAmount = 0;
    if (budget) {
      const match = String(budget).match(/([\d.]+)/);
      if (match) budgetAmount = parseFloat(match[1]);
    }
    if (budgetAmount < 0) {
      return NextResponse.json({ error: 'Budget cannot be negative.' }, { status: 400 });
    }

    // ─── Find best available agent ─────────────────────────────────

    // Map task categories to agent capability keywords
    const categoryCapabilities: Record<string, string[]> = {
      'Development': ['web-development', 'code-review', 'smart-contract', 'solana', 'typescript'],
      'Security': ['security-review', 'smart-contract-audit', 'code-review'],
      'Token Launch': ['smart-contract', 'solana', 'web-development'],
      'Research': ['research', 'data-analysis', 'market-research'],
      'Analysis': ['data-analysis', 'market-research', 'reporting'],
      'Content': ['content-creation', 'copywriting', 'research'],
      'Legal': ['research', 'content-creation'],
      'Translation': ['translation', 'content-creation'],
      'Social': ['social-media', 'community-management'],
      'Design': ['ui-design', 'graphic-design', 'branding'],
      'Other': [],
    };

    const relevantCaps = categoryCapabilities[category] || [];

    // Find active agents (active in the last 7 days OR verified)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const agentQuery: Record<string, any> = {
      status: 'active',
      $or: [
        { updatedAt: { $gte: sevenDaysAgo } },
        { isVerified: true },
      ],
    };

    if (relevantCaps.length > 0) {
      agentQuery.capabilities = { $in: relevantCaps };
    }

    const candidates = await db
      .collection(COLLECTIONS.AGENTS)
      .find(agentQuery)
      .sort({ reputation: -1 }) // Best reputation first
      .limit(5)
      .toArray();

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No agents available for this category. Try posting as a regular task.' },
        { status: 404 }
      );
    }

    const bestAgent = candidates[0];

    // ─── Create the task ─────────────────────────────────────────

    const task = {
      title,
      description,
      category,
      tags: tags || [],
      requirements: requirements || '',
      budget: budget || 'Negotiable',
      budgetAmount,
      status: 'In Progress',
      clientAddress: clientAddress || 'unknown',
      clientPrivyUserId: verified.userId,
      clientName: displayName,
      assignedAgent: bestAgent.name,
      proposalsCount: 1,
      tokenConfig: validatedTokenConfig,
      deliverableSpecs: finalSpecs,
      instantMatch: true,
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
      amount: budget || 'Negotiable',
      timeEstimate: '2-4 days',
      coverLetter: `Matched automatically by Hive. ${bestAgent.name} is the highest-rated agent for ${category} tasks.`,
      status: 'accepted',
      autoMatched: true,
      createdAt: new Date(),
    };

    await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // ─── Log activity ────────────────────────────────────────────

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskCreated',
      taskId: taskResult.insertedId,
      actorAddress: verified.userId,
      actorName: displayName,
      metadata: { title, category, budget, instantMatch: true },
      createdAt: new Date(),
    });

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'BidAccepted',
      taskId: taskResult.insertedId,
      actorName: bestAgent.name,
      metadata: {
        taskTitle: title,
        agentName: bestAgent.name,
        agentId: bestAgent._id.toString(),
        autoMatched: true,
      },
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        id: taskId,
        ...task,
        assignedAgentId: bestAgent._id.toString(),
        assignedAgentName: bestAgent.name,
        assignedAgentReputation: bestAgent.reputation || 0,
        message: `Task created and instantly assigned to ${bestAgent.name} (reputation: ${bestAgent.reputation || 0}).`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/tasks/instant-match error:', error);
    return NextResponse.json(
      { error: 'Failed to create instant match task' },
      { status: 500 }
    );
  }
}
