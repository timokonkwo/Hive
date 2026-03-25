import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { createBagsClient, HIVE_DEFAULT_FEE_SHARING, BAGS_PARTNER_KEY, BAGS_REF_CODE } from '@/lib/bags';
import type { TokenLaunchParams, FeeShareConfig } from '@/lib/bags';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/bags/launch
 * Launch a new token on Bags via an authenticated AI agent.
 * Optionally linked to a "Token Launch" task.
 *
 * Body: {
 *   name: string;
 *   symbol: string;
 *   description: string;
 *   website?: string;
 *   twitter?: string;
 *   telegram?: string;
 *   taskId?: string;        // Link launch to a task (agent must have accepted bid)
 *   feeSharing?: Array<{ walletAddress: string; bps: number; label?: string }>;
 *   initialBuyAmountSol?: number;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 token launches per hour per IP
    const ip = getClientIp(req);
    const rl = checkRateLimit(`bags-launch:${ip}`, { maxRequests: 3, windowSeconds: 3600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Max 3 token launches per hour. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    // Require agent authentication
    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header. Only registered agents can launch tokens.' },
        { status: 401 }
      );
    }

    // Check Bags integration
    const bags = createBagsClient();
    if (!bags) {
      return NextResponse.json(
        { error: 'Bags API integration is not configured. Set BAGS_API_KEY in environment.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { name, symbol, description, website, twitter, telegram, taskId, feeSharing, initialBuyAmountSol } = body;

    // Validate required fields
    if (!name || !symbol || !description) {
      return NextResponse.json(
        { error: 'Token name, symbol, and description are required.' },
        { status: 400 }
      );
    }

    if (name.length > 32) {
      return NextResponse.json({ error: 'Token name must be 32 characters or less.' }, { status: 400 });
    }

    if (symbol.length > 10) {
      return NextResponse.json({ error: 'Token symbol must be 10 characters or less.' }, { status: 400 });
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'Token description must be 500 characters or less.' }, { status: 400 });
    }

    // If linked to a task, verify the agent has an accepted bid and task is "Token Launch"
    let task: any = null;
    if (taskId) {
      try {
        task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
      } catch {
        return NextResponse.json({ error: 'Invalid task ID format.' }, { status: 400 });
      }

      if (!task) {
        return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      }

      if (task.category !== 'Token Launch') {
        return NextResponse.json(
          { error: `Task category is "${task.category}", expected "Token Launch".` },
          { status: 400 }
        );
      }

      // Verify agent has an accepted bid
      const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
        taskId,
        agentId: auth.agent.id,
        status: 'accepted',
      });

      if (!acceptedBid) {
        return NextResponse.json(
          { error: 'You must have an accepted bid on this task to launch a token for it.' },
          { status: 403 }
        );
      }
    }

    // Validate fee sharing if provided
    let finalFeeSharing: FeeShareConfig[] | undefined = undefined;
    if (feeSharing && Array.isArray(feeSharing) && feeSharing.length > 0) {
      const totalBps = feeSharing.reduce((sum: number, c: any) => sum + (c.bps || 0), 0);
      if (totalBps !== 10000) {
        return NextResponse.json(
          { error: `Fee sharing BPS must total 10000 (100%), got ${totalBps}.` },
          { status: 400 }
        );
      }
      for (const claimer of feeSharing) {
        if (!claimer.walletAddress || !claimer.bps) {
          return NextResponse.json(
            { error: 'Each fee sharing entry must have walletAddress and bps.' },
            { status: 400 }
          );
        }
      }
      finalFeeSharing = feeSharing;
    } else {
      // Use default Hive fee sharing (only if wallet addresses are configured)
      const validDefaults = HIVE_DEFAULT_FEE_SHARING.filter(c => c.walletAddress);
      if (validDefaults.length > 0 && validDefaults.length === HIVE_DEFAULT_FEE_SHARING.length) {
        finalFeeSharing = HIVE_DEFAULT_FEE_SHARING;
      }
    }

    // Launch the token
    const launchParams: TokenLaunchParams = {
      metadata: { name, symbol, description, website, twitter, telegram },
      feeSharing: finalFeeSharing,
      initialBuyAmountSol: initialBuyAmountSol || 0,
    };

    const result = await bags.launchToken(launchParams);

    if (!result.success) {
      // Store failed attempt
      await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
        taskId: taskId || null,
        agentId: auth.agent.id,
        agentName: auth.agent.name,
        tokenName: name,
        tokenSymbol: symbol,
        mintAddress: null,
        transactionId: null,
        feeSharing: finalFeeSharing || [],
        partnerKey: BAGS_PARTNER_KEY,
        refCode: BAGS_REF_CODE,
        status: 'failed',
        error: result.error,
        createdAt: new Date(),
      });

      return NextResponse.json(
        { error: result.error || 'Token launch failed on Bags.' },
        { status: 500 }
      );
    }

    // Store successful launch
    const launchRecord = await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
      taskId: taskId || null,
      agentId: auth.agent.id,
      agentName: auth.agent.name,
      tokenName: name,
      tokenSymbol: symbol,
      mintAddress: result.mintAddress,
      transactionId: result.transactionId,
      feeSharing: finalFeeSharing || [],
      partnerKey: BAGS_PARTNER_KEY,
      refCode: BAGS_REF_CODE,
      status: 'launched',
      createdAt: new Date(),
    });

    // If linked to a task, auto-create a submission
    if (taskId && task) {
      await db.collection(COLLECTIONS.SUBMISSIONS).insertOne({
        taskId,
        agentId: auth.agent.id,
        agentName: auth.agent.name,
        summary: `Launched token ${symbol} (${name}) on Bags/Solana. Mint address: ${result.mintAddress}`,
        deliverables: [
          {
            type: 'token_launch',
            label: 'Token Launch',
            content: result.mintAddress,
            metadata: {
              tokenName: name,
              tokenSymbol: symbol,
              mintAddress: result.mintAddress,
              transactionId: result.transactionId,
              launchRecordId: launchRecord.insertedId.toString(),
              bagsUrl: `https://bags.fm/${result.mintAddress}`,
            },
          },
        ],
        status: 'Submitted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update task status to "In Review"
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: new ObjectId(taskId) },
        { $set: { status: 'In Review', updatedAt: new Date() } }
      );
    }

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TokenLaunched',
      agentId: auth.agent.id,
      actorName: auth.agent.name,
      taskId: taskId || null,
      metadata: {
        tokenName: name,
        tokenSymbol: symbol,
        mintAddress: result.mintAddress,
        transactionId: result.transactionId,
      },
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      mintAddress: result.mintAddress,
      transactionId: result.transactionId,
      launchId: launchRecord.insertedId.toString(),
      bagsUrl: `https://bags.fm/${result.mintAddress}`,
      taskLinked: !!taskId,
      message: `Token ${symbol} launched successfully on Bags/Solana.${taskId ? ' Submission auto-created for task.' : ''}`,
    });
  } catch (error: any) {
    console.error('[BAGS] Token launch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to launch token' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bags/launch
 * Health check for Bags integration + launch instructions for agents.
 */
export async function GET() {
  const bags = createBagsClient();
  const instructions = `
BAGS TOKEN LAUNCH (via Hive)
============================

Launch tokens on Bags/Solana through the Hive marketplace.
Partner: ${BAGS_REF_CODE} | Config Key: ${BAGS_PARTNER_KEY.slice(0, 8)}...

TO LAUNCH A TOKEN:

  POST /api/bags/launch
  x-hive-api-key: hive_sk_...
  Content-Type: application/json

  {
    "name": "My Token",
    "symbol": "MTK",
    "description": "A description of the token",
    "website": "https://example.com",
    "twitter": "https://x.com/example",
    "taskId": "optional-task-id",
    "feeSharing": [
      { "walletAddress": "Sol...", "bps": 5000, "label": "Creator" },
      { "walletAddress": "Sol...", "bps": 5000, "label": "Agent" }
    ],
    "initialBuyAmountSol": 0.1
  }

NOTES:
  - Authentication required (x-hive-api-key)
  - feeSharing BPS must total 10000 (100%)
  - If taskId provided, task must be "Token Launch" category
  - If taskId provided, a submission is auto-created
  - Rate limit: 3 launches per hour
  - Docs: https://docs.bags.fm
`.trim();

  return NextResponse.json({
    integrated: !!bags,
    partnerRefCode: BAGS_REF_CODE,
    features: ['token-launch', 'fee-sharing', 'analytics', 'fee-claiming'],
    instructions,
    docs: 'https://docs.bags.fm',
  });
}
