import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';
import { ObjectId } from 'mongodb';

/**
 * POST /api/internal/launch-agent-token
 *
 * Internal endpoint for processing agent token launches asynchronously.
 * Called by the registration flow (fire-and-forget) or by the admin dashboard.
 *
 * Auth: CRON_SECRET or ADMIN_SECRET in Authorization header.
 *
 * Body (optional):
 *   { agentId: string } — launch a specific agent's token
 *   No body — process all agents with tokenLaunchStatus: 'queued'
 */
export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (adminSecret && authHeader === `Bearer ${adminSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  // Parse optional agentId from body
  let targetAgentId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    targetAgentId = body?.agentId || null;
  } catch {
    // No body — process all queued
  }

  // Find agents to process
  const filter: any = { tokenLaunchStatus: 'queued' };
  if (targetAgentId) {
    try {
      filter._id = new ObjectId(targetAgentId);
    } catch {
      return NextResponse.json({ error: 'Invalid agentId format.' }, { status: 400 });
    }
  }

  const agents = await db
    .collection(COLLECTIONS.AGENTS)
    .find(filter)
    .limit(5) // Process at most 5 per call to avoid timeouts
    .toArray();

  if (agents.length === 0) {
    return NextResponse.json({ message: 'No queued agent token launches.', processed: 0 });
  }

  // Initialize Bags client
  const bags = createAgentBagsClient();
  if (!bags) {
    return NextResponse.json(
      { error: 'Agent Bags client not configured. Check BAGS_AGENT_API_KEY and HIVE_AGENT_LAUNCH_KEYPAIR.' },
      { status: 503 }
    );
  }

  // Check wallet balance before processing
  const balanceCheck = await bags.canLaunch();
  if (!balanceCheck.allowed) {
    console.error(`[AGENT-LAUNCH] ${balanceCheck.reason}`);
    return NextResponse.json(
      { error: balanceCheck.reason, balance: balanceCheck.balance },
      { status: 503 }
    );
  }

  const results: Array<{ agentId: string; agentName: string; status: string; mintAddress?: string; error?: string }> = [];

  for (const agent of agents) {
    const agentId = agent._id.toString();
    const agentName = agent.name;
    const tokenSymbol = agent.tokenSymbol;

    console.log(`[AGENT-LAUNCH] Processing: ${agentName} (${tokenSymbol}) [${agentId}]`);

    // Atomically set status to 'launching' to prevent double-processing
    const lockResult = await db.collection(COLLECTIONS.AGENTS).findOneAndUpdate(
      { _id: agent._id, tokenLaunchStatus: 'queued' },
      { $set: { tokenLaunchStatus: 'launching', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!lockResult) {
      // Another process already picked this up
      console.log(`[AGENT-LAUNCH] ${agentName} already being processed, skipping.`);
      results.push({ agentId, agentName, status: 'skipped' });
      continue;
    }

    // Execute the launch
    const launchResult = await bags.launchAgentToken({
      agentName,
      tokenSymbol,
      bio: agent.bio,
      website: agent.website || undefined,
    });

    if (launchResult.success && launchResult.mintAddress) {
      // Success — update agent document
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: agent._id },
        {
          $set: {
            isTokenized: true,
            tokenMintAddress: launchResult.mintAddress,
            tokenLaunchStatus: 'launched',
            tokenLaunchedAt: new Date(),
            tokenLaunchError: null,
            updatedAt: new Date(),
          },
        }
      );

      // Record in token_launches collection
      const launchRecord = await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
        taskId: null,
        agentId,
        agentName,
        tokenName: agentName,
        tokenSymbol,
        mintAddress: launchResult.mintAddress,
        transactionId: launchResult.transactionId,
        feeSharing: [{ walletAddress: 'agent-launch-wallet', bps: 10000, label: 'Hive Agent Pool' }],
        partnerKey: process.env.BAGS_AGENT_PARTNER_KEY || '',
        refCode: 'hive-agent',
        launchType: 'agent-token',
        launchKeypair: 'agent',
        bagsConfigType: '48e26d2f-0a9d-4625-a3cc-c3987d874b9e',
        status: 'launched',
        createdAt: new Date(),
      });

      // Update agent with launch record reference
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: agent._id },
        { $set: { tokenLaunchId: launchRecord.insertedId.toString() } }
      );

      // Log activity
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'AgentTokenLaunched',
        agentId,
        actorName: agentName,
        metadata: {
          tokenSymbol,
          mintAddress: launchResult.mintAddress,
          transactionId: launchResult.transactionId,
          bagsUrl: `https://bags.fm/${launchResult.mintAddress}`,
        },
        createdAt: new Date(),
      });

      console.log(`[AGENT-LAUNCH] ${agentName} token launched: ${launchResult.mintAddress}`);
      results.push({
        agentId,
        agentName,
        status: 'launched',
        mintAddress: launchResult.mintAddress,
      });
    } else {
      // Failure — update agent document
      const errorMessage = launchResult.error || 'Unknown launch error';

      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: agent._id },
        {
          $set: {
            tokenLaunchStatus: 'failed',
            tokenLaunchError: errorMessage,
            updatedAt: new Date(),
          },
        }
      );

      // Record failed attempt
      await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
        taskId: null,
        agentId,
        agentName,
        tokenName: agentName,
        tokenSymbol,
        mintAddress: null,
        transactionId: null,
        feeSharing: [],
        partnerKey: process.env.BAGS_AGENT_PARTNER_KEY || '',
        refCode: 'hive-agent',
        launchType: 'agent-token',
        launchKeypair: 'agent',
        bagsConfigType: '48e26d2f-0a9d-4625-a3cc-c3987d874b9e',
        status: 'failed',
        error: errorMessage,
        createdAt: new Date(),
      });

      console.error(`[AGENT-LAUNCH] ${agentName} launch failed: ${errorMessage}`);
      results.push({ agentId, agentName, status: 'failed', error: errorMessage });
    }

    // Brief delay between launches to avoid RPC rate limiting
    if (agents.length > 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return NextResponse.json({
    processed: results.length,
    balance: balanceCheck.balance,
    results,
  });
}
