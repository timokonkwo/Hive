import { NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';

/**
 * GET /api/cron/agent-token-launch
 *
 * Cron fallback for agent token launches that failed to trigger
 * from the registration endpoint, or got stuck in 'queued'/'launching'.
 *
 * Runs every 5 minutes via external scheduler (Netlify, cron-job.org, etc.).
 *
 * Actions:
 *   1. Process any agents stuck in 'queued' status (fire-and-forget from registration failed)
 *   2. Mark agents stuck in 'launching' for > 10 minutes as 'failed' (tx likely dropped)
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

  // 1. Process queued agent token launches
  try {
    const queuedAgents = await db
      .collection(COLLECTIONS.AGENTS)
      .find({ tokenLaunchStatus: 'queued' })
      .limit(1) // Process 1 per cron run — balance is re-checked per launch
      .toArray();

    if (queuedAgents.length > 0) {
      const bags = createAgentBagsClient();
      if (bags) {
        const balanceCheck = await bags.canLaunch();
        if (balanceCheck.allowed) {
          // Trigger the internal launch endpoint for each queued agent
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz';
          const internalUrl = `${siteUrl}/api/internal/launch-agent-token`;

          for (const agent of queuedAgents) {
            try {
              const res = await fetch(internalUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${cronSecret}`,
                },
                body: JSON.stringify({ agentId: agent._id.toString() }),
              });
              const data = await res.json();
              console.log(`[CRON-TOKEN] Triggered launch for ${agent.name}:`, data);
            } catch (err: any) {
              console.error(`[CRON-TOKEN] Failed to trigger launch for ${agent.name}:`, err.message);
            }
          }

          results.queuedProcessed = queuedAgents.length;
        } else {
          results.queuedSkipped = `Low balance: ${balanceCheck.balance.toFixed(4)} SOL`;
        }
      } else {
        results.queuedSkipped = 'Agent Bags client not configured';
      }
    } else {
      results.queuedProcessed = 0;
    }
  } catch (err: any) {
    results.queuedError = err.message;
    console.error('[CRON-TOKEN] Queue processing error:', err.message);
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
