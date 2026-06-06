import { NextResponse } from 'next/server';
import { createAgentBagsClient } from '@/lib/bags-agent';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

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

    // Fetch all active claimable positions for the agent launch wallet
    const positions = await bags.getClaimablePositions().catch((err) => {
      logger.error('[CRON-FEES] Failed to fetch claimable positions:', err.message);
      return [];
    });

    results.positionsFound = positions.length;
    results.claimsExecuted = [];

    const db = await getDb();
    const connection = bags.connection;
    const walletPubKey = bags.keypair.publicKey;

    // Iterate over positions and claim fees
    for (const position of positions) {
      const claimableAmount = position.claimableAmount || 0;
      // Skip if claimable amount is below a threshold to save transaction fees
      if (claimableAmount < 1000000) continue; // 0.001 SOL / USDC threshold

      try {
        const baseMintStr = position.baseMint?.toBase58();
        logger.info(`[CRON-FEES] Claiming fees for mint ${baseMintStr} (${claimableAmount} raw);...`);

        // Generate claim transaction instructions from Bags SDK
        const txs = await bags.sdk.fee.getClaimTransaction(walletPubKey, position);

        for (const tx of txs) {
          // Fetch blockhash, sign and broadcast
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = walletPubKey;
          tx.sign(bags.keypair);

          const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 3
          });

          const latestBlockhash = await connection.getLatestBlockhash('confirmed');
          await connection.confirmTransaction({
            signature: sig,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
          }, 'confirmed');

          results.claimsExecuted.push({
            mint: baseMintStr,
            amountRaw: claimableAmount,
            signature: sig
          });
        }
      } catch (claimErr: any) {
        logger.error(`[CRON-FEES] Failed to claim for position:`, claimErr.message);
      }
    }

    // Count total launched tokens
    const totalTokens = await db.collection(COLLECTIONS.AGENTS).countDocuments({
      isTokenized: true,
      tokenLaunchStatus: 'launched',
    });

    results.totalTokenizedAgents = totalTokens;
    
    // Get wallet balance after claiming
    const balanceAfter = await bags.getBalance();
    results.balanceAfter = parseFloat(balanceAfter.toFixed(4));
    
    results.message = results.claimsExecuted.length > 0
      ? `Successfully executed ${results.claimsExecuted.length} claims. Balance: ${results.balanceAfter} SOL.`
      : 'No claimable positions met the fee claiming threshold.';

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
    logger.error('[CRON-FEES] Agent fee claim error:', err.message);
  }

  return NextResponse.json({
    cron: 'claim-agent-fees',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
