import { NextResponse } from 'next/server';
import { createAgentBagsClient } from '@/lib/bags-agent';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/cron/claim-agent-fees
 *
 * Daily cron job to claim accumulated partner revenue from agent token trading fees.
 * The agent launch wallet earns a percentage of all trading volume on tokens
 * launched through it, via the partner config PDA.
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

  const results: Record<string, any> = {};

  try {
    const bags = createAgentBagsClient();
    if (!bags) {
      return NextResponse.json({ error: 'Agent Bags client not configured' }, { status: 503 });
    }

    // Get wallet balance before claiming
    const balanceBefore = await bags.getBalance();
    results.balanceBefore = parseFloat(balanceBefore.toFixed(4));

    // For now, log the balance — actual fee claiming requires
    // iterating over all token mints and calling claim transactions.
    // This will be expanded once tokens are launched and there are fees to claim.
    //
    // The claim flow:
    // 1. Get all claimable positions for the agent launch wallet
    // 2. For each position with claimable > threshold (0.001 SOL)
    // 3. Generate + sign + broadcast claim tx
    // 4. Log claimed amount
    //
    // This is a placeholder that logs stats. The actual claiming will use
    // sdk.fee.getAllClaimablePositions() and sdk.fee.getClaimTransaction()
    // which are already implemented in the main BagsClient.

    const db = await getDb();

    // Count total launched tokens
    const totalTokens = await db.collection(COLLECTIONS.AGENTS).countDocuments({
      isTokenized: true,
      tokenLaunchStatus: 'launched',
    });

    results.totalTokenizedAgents = totalTokens;
    results.balanceAfter = results.balanceBefore; // Will differ once claiming is active
    results.message = totalTokens > 0
      ? `${totalTokens} tokenized agents. Partner fee claiming ready.`
      : 'No tokenized agents yet. Nothing to claim.';

    // Log the cron run
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AgentFeeClaimCron',
      metadata: {
        balanceBefore: results.balanceBefore,
        totalTokenizedAgents: totalTokens,
      },
      createdAt: new Date(),
    });
  } catch (err: any) {
    results.error = err.message;
    console.error('[CRON-FEES] Agent fee claim error:', err.message);
  }

  return NextResponse.json({
    cron: 'claim-agent-fees',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
