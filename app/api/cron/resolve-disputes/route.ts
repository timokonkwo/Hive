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

const DEFAULT_HIVE_TREASURY_WALLET = 'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';

function parseKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const bytes = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.HIVE_TREASURY_KEYPAIR;
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

function isConfiguredTreasuryKeypair(keypair: Keypair | null): keypair is Keypair {
  if (!keypair) return false;
  const configuredTreasury = process.env.HIVE_TREASURY_WALLET || DEFAULT_HIVE_TREASURY_WALLET;
  return keypair.publicKey.toBase58() === configuredTreasury;
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

      if (isSlashedOutcome && dispute.stakedAmount > 0) {
        if (!isConfiguredTreasuryKeypair(treasuryKeypair)) {
          logger.error('[CRON-DISPUTE] Slashing skipped: HIVE_TREASURY_KEYPAIR is missing or does not match HIVE_TREASURY_WALLET');
          txSignature = 'failed_treasury_key_mismatch';
          finalStatus = 'execution_failed';
        } else {
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

      let remainingProviderActiveStake: number | null = null;

      if (finalStatus === 'slashed') {
        const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: dispute.providerAddress });
        const activeAmount = Number(stake?.activeAmount || 0);
        const lockedAmount = Number(stake?.lockedAmount || 0);
        const slashAmount = Math.min(Math.abs(dispute.stakedAmount || 0), activeAmount + lockedAmount);
        const activeSlash = Math.min(activeAmount, slashAmount);
        const lockedSlash = Math.min(lockedAmount, slashAmount - activeSlash);
        const pendingUnstakes = Array.isArray(stake?.pendingUnstakes) ? [...stake.pendingUnstakes] : [];

        if (lockedSlash > 0) {
          let remainingLockedSlash = lockedSlash;
          for (const request of pendingUnstakes) {
            if (remainingLockedSlash <= 0) break;
            if (!request || !['cooldown', 'claiming'].includes(request.status)) continue;
            const requestAmount = Number(request.amount || 0);
            if (requestAmount <= 0) continue;
            const requestSlash = Math.min(requestAmount, remainingLockedSlash);
            request.amount = requestAmount - requestSlash;
            request.slashedAmount = Number(request.slashedAmount || 0) + requestSlash;
            request.slashedAt = new Date();
            if (request.amount <= 0) {
              request.amount = 0;
              request.status = 'slashed';
            }
            remainingLockedSlash -= requestSlash;
          }
        }

        const remainingActive = Math.max(0, activeAmount - activeSlash);
        const remainingLocked = Math.max(0, lockedAmount - lockedSlash);
        remainingProviderActiveStake = remainingActive;
        await db.collection(COLLECTIONS.STAKES).updateOne(
          { solanaAddress: dispute.providerAddress },
          {
            $set: {
              activeAmount: remainingActive,
              lockedAmount: remainingLocked,
              pendingUnstakes,
              status: remainingActive > 0 ? 'active' : remainingLocked > 0 ? 'cooldown' : 'none',
              updatedAt: new Date(),
            },
            $inc: {
              slashedAmount: slashAmount,
            },
          }
        );
      }

      // Update Provider Agent profile state
      const agentUpdate: Record<string, any> = {
        disputeStatus: finalStatus === 'slashed' ? 'slashed' : 'resolved',
        updatedAt: new Date()
      };
      if (finalStatus === 'slashed') {
        agentUpdate.isSlashed = true;
        agentUpdate.isVerified = false;
        agentUpdate.reputation = 0; // Reputation wiped on slashing
        agentUpdate.stakedAmount = remainingProviderActiveStake || 0;
        agentUpdate.isStaked = (remainingProviderActiveStake || 0) > 0;
      }

      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { solanaAddress: dispute.providerAddress },
        { $set: agentUpdate }
      );

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
