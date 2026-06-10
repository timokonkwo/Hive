import { NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createBurnInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { HIVE_MINT, HIVE_DECIMALS } from '@/lib/token-utils';
import bs58 from 'bs58';
import { logger } from '@/lib/logger';

function parseKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const bytes = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.HIVE_LAUNCH_KEYPAIR || process.env.HIVE_AGENT_LAUNCH_KEYPAIR;
  if (!raw) return null;
  try {
    return parseKeypair(raw);
  } catch (err) {
    logger.error('[CRON-DISPUTE] Failed to parse treasury keypair:', err);
    return null;
  }
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * GET /api/cron/resolve-disputes
 * Process expired disputes, count vote tallies, and resolve slashing outcomes on-chain.
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
  results.processedDisputes = [];

  try {
    const db = await getDb();
    const connection = getConnection();
    const treasuryKeypair = getTreasuryKeypair();

    // Query expired disputes
    const expiredDisputes = await db.collection(COLLECTIONS.DISPUTES)
      .find({ status: 'active', deadline: { $lte: new Date() } })
      .toArray();

    if (expiredDisputes.length === 0) {
      return NextResponse.json({ message: 'No active disputes have reached their deadline.' });
    }

    for (const dispute of expiredDisputes) {
      const voteFor = dispute.votesForSlash || 0;
      const voteAgainst = dispute.votesAgainstSlash || 0;
      const totalVotes = voteFor + voteAgainst;
      const quorumRequired = Number(dispute.quorumRequired || Math.round((dispute.stakedAmount || 0) * 0.05));
      const slashThresholdBps = Number(dispute.slashThresholdBps || 6000);
      const slashShareBps = totalVotes > 0 ? Math.round((voteFor / totalVotes) * 10_000) : 0;
      const quorumMet = totalVotes >= quorumRequired;
      const isSlashedOutcome = quorumMet && slashShareBps >= slashThresholdBps;
      let finalStatus = !quorumMet ? 'failed_quorum' : isSlashedOutcome ? 'slashed' : 'dismissed';

      let txSignature = '';

      if (isSlashedOutcome && treasuryKeypair && dispute.stakedAmount > 0) {
        // Burn treasury-custodied HIVE that represents the provider's recorded stake.
        try {
          const sourceAta = await getAssociatedTokenAddress(HIVE_MINT, treasuryKeypair.publicKey);

          const transaction = new Transaction();
          const rawAmount = BigInt(Math.round(dispute.stakedAmount * Math.pow(10, HIVE_DECIMALS)));

          transaction.add(
            createBurnInstruction(
              sourceAta,
              HIVE_MINT,
              treasuryKeypair.publicKey,
              rawAmount,
              [],
              TOKEN_PROGRAM_ID
            )
          );

          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;
          transaction.sign(treasuryKeypair);

          // Broadcast signature (this will simulate or execute depending on wallet tokens)
          txSignature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3
          });
          logger.info(`[CRON-DISPUTE] Slashing tx broadcasted: ${txSignature}`);
        } catch (err: any) {
          logger.error(`[CRON-DISPUTE] Slashing SPL token instruction failed for ${dispute.providerAddress}:`, err.message);
          txSignature = 'failed_chain_error';
          finalStatus = 'execution_failed';
        }
      }

      // Update Dispute State
      await db.collection(COLLECTIONS.DISPUTES).updateOne(
        { _id: dispute._id },
        {
          $set: {
            status: finalStatus,
            phase: 'resolved',
            resolutionTx: txSignature || null,
            resolvedAt: new Date(),
            quorumMet,
            totalVoteWeight: totalVotes,
            slashShareBps
          }
        }
      );

      // Update Provider Agent profile state
      const agentUpdate: Record<string, any> = {
        disputeStatus: finalStatus === 'slashed' ? 'slashed' : 'resolved',
        updatedAt: new Date()
      };
      if (finalStatus === 'slashed') {
        agentUpdate.isSlashed = true;
        agentUpdate.isVerified = false;
        agentUpdate.reputation = 0; // Reputation wiped on slashing
      }

      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { solanaAddress: dispute.providerAddress },
        { $set: agentUpdate }
      );

      if (finalStatus === 'slashed') {
        await db.collection(COLLECTIONS.STAKES).updateOne(
          { solanaAddress: dispute.providerAddress },
          {
            $inc: {
              activeAmount: -Math.abs(dispute.stakedAmount || 0),
              slashedAmount: Math.abs(dispute.stakedAmount || 0),
            },
            $set: { status: 'none', updatedAt: new Date() },
          }
        );
      }

      // Log resolution activity
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'DisputeResolved',
        actorName: 'System',
        metadata: {
          disputeId: dispute._id.toString(),
          providerAddress: dispute.providerAddress,
          toolId: dispute.toolId,
          outcome: finalStatus,
          votesFor: voteFor,
          votesAgainst: voteAgainst,
          quorumMet,
          quorumRequired,
          slashThresholdBps,
          slashingTxSignature: txSignature || null
        },
        createdAt: new Date()
      });

      results.processedDisputes.push({
        id: dispute._id.toString(),
        provider: dispute.providerAddress,
        outcome: finalStatus,
        txSignature
      });
    }

  } catch (error: any) {
    logger.error('[CRON-DISPUTE] Dispute resolver error:', error);
    results.error = error.message || 'Dispute resolver execution failed.';
  }

  return NextResponse.json({
    cron: 'resolve-disputes',
    timestamp: new Date().toISOString(),
    ...results
  });
}
