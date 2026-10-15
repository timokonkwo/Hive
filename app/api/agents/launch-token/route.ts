import { legacyAgentLaunchesEnabled, legacyLaunchMessage } from '@/lib/agent-tokenization/legacy';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createAgentBagsClient, validateTokenSymbol } from '@/lib/bags-agent';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';

/**
 * POST /api/agents/launch-token
 * 
 * Agent owner initiates a token launch for their agent.
 * Requires API key auth. Each agent can only have 1 token.
 * 
 * Body: { tokenSymbol?: string }
 */
export async function POST(req: NextRequest) {
  if (!legacyAgentLaunchesEnabled()) return NextResponse.json({ error:legacyLaunchMessage }, { status:410 });
  try {
    // Rate limit — stricter than normal
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-launch-token:${ip}`, { windowSeconds: 300, maxRequests: 3 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const { agent } = auth;
    const body = await req.json();

    // If user uploaded a custom token image, store it on the agent
    if (body.tokenImageUrl && typeof body.tokenImageUrl === 'string' && body.tokenImageUrl.startsWith('https://')) {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agent.id) },
        { $set: { tokenImageUrl: body.tokenImageUrl, updatedAt: new Date() } }
      );
    }

    // Check agent isn't already tokenized or in progress
    if (agent.isTokenized && agent.tokenLaunchStatus === 'launched') {
      return NextResponse.json(
        { error: 'This agent already has a token.', tokenSymbol: agent.tokenSymbol, tokenMintAddress: agent.tokenMintAddress },
        { status: 409 }
      );
    }

    if (agent.tokenLaunchStatus === 'queued' || agent.tokenLaunchStatus === 'launching') {
      return NextResponse.json(
        { error: 'Token launch already in progress.' },
        { status: 409 }
      );
    }

    // Validate/generate symbol
    let symbolToUse = body.tokenSymbol || agent.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'AGENT';

    if (body.tokenSymbol) {
      const symbolCheck = validateTokenSymbol(body.tokenSymbol);
      if (!symbolCheck.valid) {
        return NextResponse.json({ error: symbolCheck.error }, { status: 400 });
      }
      symbolToUse = symbolCheck.normalized!;
    }

    // Check symbol uniqueness
    const symbolExists = await db.collection(COLLECTIONS.AGENTS).findOne({
      tokenSymbol: symbolToUse,
      _id: { $ne: new ObjectId(agent.id) },
    });
    if (symbolExists) {
      return NextResponse.json({ error: `Token symbol "${symbolToUse}" is already taken.` }, { status: 409 });
    }

    // Check bio exists (needed for description)
    if (!agent.bio || agent.bio.trim().length < 10) {
      return NextResponse.json(
        { error: 'Your agent needs a bio of at least 10 characters before launching a token.' },
        { status: 400 }
      );
    }

    // Atomically lock the agent to 'launching'
    const lockResult = await db.collection(COLLECTIONS.AGENTS).findOneAndUpdate(
      {
        _id: new ObjectId(agent.id),
        $or: [
          { tokenLaunchStatus: { $exists: false } },
          { tokenLaunchStatus: null },
          { tokenLaunchStatus: 'failed' },
        ],
      },
      {
        $set: {
          tokenLaunchStatus: 'launching',
          tokenSymbol: symbolToUse,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!lockResult) {
      return NextResponse.json({ error: 'Agent is not in a launchable state.' }, { status: 409 });
    }

    // Create Bags client and launch
    const bags = createAgentBagsClient();
    if (!bags) {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agent.id) },
        { $set: { tokenLaunchStatus: 'failed', tokenLaunchError: 'Launch service not configured', updatedAt: new Date() } }
      );
      return NextResponse.json({ error: 'Token launch service is temporarily unavailable.' }, { status: 503 });
    }

    // Execute launch inline
    logger.info(`[OWNER-LAUNCH] Launching token for ${agent.name} ($${symbolToUse});...`);

    const launchResult = await bags.launchAgentToken({
      agentName: agent.name,
      tokenSymbol: symbolToUse,
      bio: agent.bio,
      website: agent.website || undefined,
      tokenImageUrl: body.tokenImageUrl || agent.tokenImageUrl || undefined,
    });

    if (launchResult.success && launchResult.mintAddress) {
      // Success — update DB
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agent.id) },
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

      // Record launch
      await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
        taskId: null,
        agentId: agent.id,
        agentName: agent.name,
        tokenName: agent.name,
        tokenSymbol: symbolToUse,
        mintAddress: launchResult.mintAddress,
        transactionId: launchResult.transactionId,
        metadataUrl: launchResult.metadataUrl,
        feeSharing: [{ walletAddress: 'agent-launch-wallet', bps: 10000, label: 'Hive Agent Pool' }],
        partnerKey: 'agent-partner',
        refCode: 'hive-agent',
        launchType: 'agent-token-owner',
        launchKeypair: 'agent',
        bagsConfigType: '48e26d2f-0a9d-4625-a3cc-c3987d874b9e',
        status: 'launched',
        initiatedBy: 'owner',
        createdAt: new Date(),
      });

      // Activity log
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'AgentTokenLaunched',
        agentId: agent.id,
        actorName: agent.name,
        metadata: {
          tokenSymbol: symbolToUse,
          mintAddress: launchResult.mintAddress,
          transactionId: launchResult.transactionId,
          initiatedBy: 'owner',
        },
        createdAt: new Date(),
      });

      logger.info(`[OWNER-LAUNCH] ${agent.name} launched: ${launchResult.mintAddress}`);

      return NextResponse.json({
        success: true,
        tokenSymbol: symbolToUse,
        mintAddress: launchResult.mintAddress,
        transactionId: launchResult.transactionId,
        bagsUrl: `https://bags.fm/${launchResult.mintAddress}`,
      });
    } else {
      // Failure
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agent.id) },
        { $set: { tokenLaunchStatus: 'unknown', tokenLaunchError: launchResult.error || 'Unknown error', updatedAt: new Date() } }
      );

      logger.error(`[OWNER-LAUNCH] ${agent.name} failed: ${launchResult.error}`);
      return NextResponse.json({ error: launchResult.error || 'Token launch failed' }, { status: 500 });
    }
  } catch (error: any) {
    logger.error('[OWNER-LAUNCH] Error:', error);
    return NextResponse.json({ error: "Token launch failed." }, { status: 500 });
  }
}
