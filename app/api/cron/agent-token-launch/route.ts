import { NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';

/**
 * GET /api/cron/agent-token-launch
 *
 * Cron fallback for agent token launches.
 *
 * 1. Process 1 queued agent (inline launch, no HTTP to another function)
 * 2. Mark agents stuck in 'launching' for > 10 minutes as 'failed'
 *
 * Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = process.env.STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (stealthSecret && authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const results: Record<string, any> = {};

  // 1. Process 1 queued agent token launch — INLINE (no HTTP call)
  try {
    const agent = await db
      .collection(COLLECTIONS.AGENTS)
      .findOne({ tokenLaunchStatus: 'queued' });

    if (agent) {
      const bags = createAgentBagsClient();
      if (!bags) {
        results.queuedSkipped = 'Agent Bags client not configured';
      } else {
        const balanceCheck = await bags.canLaunch();
        if (!balanceCheck.allowed) {
          results.queuedSkipped = `Low balance: ${balanceCheck.balance.toFixed(4)} SOL`;
        } else {
          // Atomically lock to 'launching'
          const lockResult = await db.collection(COLLECTIONS.AGENTS).findOneAndUpdate(
            { _id: agent._id, tokenLaunchStatus: 'queued' },
            { $set: { tokenLaunchStatus: 'launching', updatedAt: new Date() } },
            { returnDocument: 'after' }
          );

          if (!lockResult) {
            results.queuedSkipped = `${agent.name} already being processed`;
          } else {
            const agentId = agent._id.toString();
            const tokenSymbol = agent.tokenSymbol || agent.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'AGENT';

            console.log(`[CRON-TOKEN] Launching ${agent.name} ($${tokenSymbol})...`);

            const launchResult = await bags.launchAgentToken({
              agentName: agent.name,
              tokenSymbol,
              bio: agent.bio || `${agent.name} - AI agent on Hive Protocol`,
              website: agent.website || undefined,
            });

            if (launchResult.success && launchResult.mintAddress) {
              // Success
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

              await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
                taskId: null,
                agentId,
                agentName: agent.name,
                tokenName: agent.name,
                tokenSymbol,
                mintAddress: launchResult.mintAddress,
                transactionId: launchResult.transactionId,
                feeSharing: [{ walletAddress: 'agent-launch-wallet', bps: 10000, label: 'Hive Agent Pool' }],
                partnerKey: 'agent-partner',
                refCode: 'hive-agent',
                launchType: 'agent-token',
                launchKeypair: 'agent',
                bagsConfigType: '48e26d2f-0a9d-4625-a3cc-c3987d874b9e',
                status: 'launched',
                createdAt: new Date(),
              });

              await db.collection(COLLECTIONS.ACTIVITY).insertOne({
                type: 'AgentTokenLaunched',
                agentId,
                actorName: agent.name,
                metadata: { tokenSymbol, mintAddress: launchResult.mintAddress, transactionId: launchResult.transactionId },
                createdAt: new Date(),
              });

              console.log(`[CRON-TOKEN] ${agent.name} launched: ${launchResult.mintAddress}`);
              results.launched = { agent: agent.name, symbol: tokenSymbol, mint: launchResult.mintAddress };
            } else {
              // Failure
              const errorMsg = launchResult.error || 'Unknown error';
              await db.collection(COLLECTIONS.AGENTS).updateOne(
                { _id: agent._id },
                { $set: { tokenLaunchStatus: 'failed', tokenLaunchError: errorMsg, updatedAt: new Date() } }
              );
              console.error(`[CRON-TOKEN] ${agent.name} failed: ${errorMsg}`);
              results.launchFailed = { agent: agent.name, error: errorMsg };
            }
          }
        }
      }
    } else {
      results.queuedProcessed = 0;
    }
  } catch (err: any) {
    results.queuedError = err.message;
    console.error('[CRON-TOKEN] Launch error:', err.message);
  }

  // 2. Mark stale 'launching' agents as failed (stuck > 10 minutes)
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleResult = await db.collection(COLLECTIONS.AGENTS).updateMany(
      {
        tokenLaunchStatus: 'launching',
        updatedAt: { $lt: tenMinutesAgo },
      },
      {
        $set: {
          tokenLaunchStatus: 'failed',
          tokenLaunchError: 'Launch timed out (stuck in launching state for >10 minutes)',
          updatedAt: new Date(),
        },
      }
    );
    results.staleMarkedFailed = staleResult.modifiedCount;
  } catch (err: any) {
    results.staleError = err.message;
    console.error('[CRON-TOKEN] Stale cleanup error:', err.message);
  }

  return NextResponse.json({
    cron: 'agent-token-launch',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
