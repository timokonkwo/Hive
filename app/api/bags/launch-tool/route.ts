import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { authenticateClient } from '@/lib/client-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createBagsClient, HIVE_DEFAULT_FEE_SHARING, BAGS_PARTNER_KEY, BAGS_REF_CODE } from '@/lib/bags';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';

/**
 * POST /api/bags/launch-tool
 * Launches a Bags token directly tied to a specific agent capability (MCP tool).
 * Requires developer/agent auth.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`bags-launch-tool:${ip}`, { windowSeconds: 3600, maxRequests: 5 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Authenticate developer/owner
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required to tokenize tools.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { agentId, capability, tokenSymbol, tokenImageUrl } = body;

    if (!agentId || !capability || !tokenSymbol) {
      return NextResponse.json(
        { error: 'agentId, capability, and tokenSymbol are required.' },
        { status: 400 }
      );
    }

    // Verify ownership of the agent
    const oId = new ObjectId(agentId);
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      _id: oId,
      $or: [
        { id: userId },
        { walletAddress: userId },
        { solanaAddress: userId }
      ]
    });

    if (!agent && !agentAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. You do not own this agent profile.' },
        { status: 403 }
      );
    }

    const agentToUse = agent || agentAuth?.agent;

    // Verify agent has the capability registered
    const capabilities = agentToUse.capabilities || [];
    if (!capabilities.includes(capability)) {
      return NextResponse.json(
        { error: `The agent does not support the capability "${capability}". Register it first.` },
        { status: 400 }
      );
    }

    // Check if this capability is already tokenized
    const toolTokens = agentToUse.toolTokens || {};
    if (toolTokens[capability]?.mintAddress) {
      return NextResponse.json(
        { error: `Capability "${capability}" is already tokenized.`, tokenInfo: toolTokens[capability] },
        { status: 409 }
      );
    }

    // Check Bags integration
    const bags = createBagsClient();
    if (!bags) {
      return NextResponse.json(
        { error: 'Bags SDK is not configured on the server.' },
        { status: 503 }
      );
    }

    // Setup metadata
    const toolName = `${agentToUse.name} - ${capability}`;
    const tokenName = `${toolName} Tool`;
    const description = `Decentralized Model Context Protocol (MCP) tool token for the ${capability} capability on the Hive gateway.`;

    const launchParams = {
      metadata: {
        name: tokenName,
        symbol: tokenSymbol.toUpperCase(),
        description,
        image: tokenImageUrl || undefined
      },
      feeSharing: HIVE_DEFAULT_FEE_SHARING.filter(c => c.walletAddress),
      initialBuyAmountSol: 0
    };

    logger.info(`[TOOL-LAUNCH] Tokenizing capability "${capability}" for agent ${agentToUse.name}...`);
    const result = await bags.launchToken(launchParams);

    if (!result.success || !result.mintAddress) {
      return NextResponse.json(
        { error: result.error || 'Bags on-chain launch failed.' },
        { status: 500 }
      );
    }

    // Update agent's toolTokens in database
    const updatedToolTokens = {
      ...toolTokens,
      [capability]: {
        mintAddress: result.mintAddress,
        symbol: tokenSymbol.toUpperCase(),
        launchedAt: new Date(),
        transactionId: result.transactionId
      }
    };

    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(agentToUse.id || agentToUse._id) },
      { $set: { toolTokens: updatedToolTokens, updatedAt: new Date() } }
    );

    // Record launch event
    await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
      agentId: agentToUse.id || agentToUse._id.toString(),
      agentName: agentToUse.name,
      capability,
      tokenName,
      tokenSymbol: tokenSymbol.toUpperCase(),
      mintAddress: result.mintAddress,
      transactionId: result.transactionId,
      status: 'launched',
      launchType: 'tool-token',
      createdAt: new Date()
    });

    // Activity log
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'ToolTokenLaunched',
      actorName: agentToUse.name,
      metadata: {
        agentId: agentToUse.id || agentToUse._id.toString(),
        capability,
        tokenSymbol: tokenSymbol.toUpperCase(),
        mintAddress: result.mintAddress
      },
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      mintAddress: result.mintAddress,
      transactionId: result.transactionId,
      bagsUrl: `https://bags.fm/${result.mintAddress}`
    });

  } catch (error: any) {
    logger.error('[TOOL-LAUNCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Token launch execution failed.' }, { status: 500 });
  }
}
