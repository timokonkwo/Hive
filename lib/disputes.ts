import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './db';
import { STAKING_TIERS, getStakingTierInfo } from './token-utils';
import { awardPoints } from './points';
import { Connection } from '@solana/web3.js';
import { voteWindow } from './dispute-view';
import { logger } from '@/lib/logger';

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Open a new staker dispute.
 * Locks active stake and creates a 48-hour voting window.
 */
export async function createDispute(
  providerAddress: string,
  toolId: string,
  reason: string,
  evidenceUri: string,
  stakedAmount: number,
  options: {
    reportId?: string;
    category?: string;
    openedBy?: string;
    openedByRole?: string;
    evidencePeriodHours?: number;
    votingPeriodHours?: number;
    quorumBps?: number;
    slashThresholdBps?: number;
  } = {}
): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  try {
    const db = await getDb();
    const connection = getConnection();

    try {
      await db.collection(COLLECTIONS.DISPUTES).createIndex(
        { providerAddress: 1, toolId: 1, status: 1 },
        { unique: true, partialFilterExpression: { status: 'active' }, background: true }
      );
    } catch {
      return { success: false, error: 'Dispute replay protection is not ready. Try again shortly.' };
    }

    // Check if there is an active dispute for this provider/tool already
    const activeDispute = await db.collection(COLLECTIONS.DISPUTES).findOne({
      providerAddress,
      toolId,
      status: 'active'
    });
    if (activeDispute) {
      return { success: false, error: 'An active dispute is already open for this tool provider.' };
    }

    // Get current Solana slot height for snapshot auditing
    const slot = await connection.getSlot('confirmed').catch((err) => {
      logger.warn('Failed to fetch Solana slot height', { tag: 'DISPUTES', error: err.message });
      return null;
    });
    if (!slot) {
      return { success: false, error: 'Could not create a verifiable governance snapshot. Try again shortly.' };
    }

    const now = new Date();
    const evidencePeriodHours = Math.min(Math.max(options.evidencePeriodHours ?? 24, 0), 168);
    const votingPeriodHours = Math.min(Math.max(options.votingPeriodHours ?? 48, 1), 168);
    const evidenceOpenUntil = new Date(now.getTime() + evidencePeriodHours * 60 * 60 * 1000);
    const votingStartsAt = evidenceOpenUntil;
    const votingEndsAt = new Date(votingStartsAt.getTime() + votingPeriodHours * 60 * 60 * 1000);
    const quorumBps = Math.min(Math.max(options.quorumBps ?? 500, 0), 10_000);
    const slashThresholdBps = Math.min(Math.max(options.slashThresholdBps ?? 6000, 5_001), 10_000);
    const quorumRequired = Math.round(stakedAmount * (quorumBps / 10_000));

    const dispute = {
      reportId: options.reportId || null,
      providerAddress,
      toolId,
      category: options.category || 'other',
      stakedAmount,
      reason,
      evidenceUri,
      status: 'active' as const,
      phase: evidencePeriodHours > 0 ? 'evidence' : 'voting',
      votesForSlash: 0,
      votesAgainstSlash: 0,
      voteCount: 0,
      snapshotBlock: slot,
      evidenceOpenUntil,
      votingStartsAt,
      votingEndsAt,
      quorumRequired,
      quorumBps,
      slashThresholdBps,
      openedBy: options.openedBy || 'system',
      openedByRole: options.openedByRole || 'system',
      deadline: votingEndsAt,
      createdAt: now
    };

    const result = await db.collection(COLLECTIONS.DISPUTES).insertOne(dispute);
    const disputeId = result.insertedId.toString();

    // Set provider status to locked/flagged
    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { solanaAddress: providerAddress },
      { $set: { disputeStatus: 'flagged', updatedAt: new Date() } }
    );

    // Log dispute activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'DisputeCreated',
      actorName: options.openedByRole || 'System',
      metadata: {
        disputeId,
        reportId: options.reportId || null,
        providerAddress,
        toolId,
        stakedAmount,
        reason,
        phase: dispute.phase,
        votingStartsAt,
        votingEndsAt
      },
      createdAt: new Date(),
    });

    logger.info('Dispute opened', { tag: 'DISPUTES', disputeId, providerAddress, stakedAmount });
    return { success: true, disputeId };
  } catch (error: any) {
    if (error?.code === 11000) {
      return { success: false, error: 'An active dispute is already open for this tool provider.' };
    }
    logger.error('Dispute creation failed', { tag: 'DISPUTES', error: (error as Error).message });
    return { success: false, error: error.message || 'Failed to open dispute' };
  }
}

/**
 * Cast a vote on an active dispute.
 * Voting weight is calculated from the voter's active recorded HIVE stake.
 */
export async function castDisputeVote(
  userId: string,
  disputeId: string,
  vote: 'slash' | 'dismiss',
  solanaAddress: string
): Promise<{ success: boolean; error?: string }> {
  if (!/^[a-f0-9]{24}$/i.test(disputeId)) return { success: false, error: 'Invalid case.' };
  const db = await getDb();
  try {
    await Promise.all([
      db.collection(COLLECTIONS.DISPUTE_VOTES).createIndex({ disputeId: 1, userId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.DISPUTE_VOTES).createIndex({ disputeId: 1, solanaAddress: 1 }, { unique: true }),
    ]);
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const oId = new ObjectId(disputeId);
        const dispute = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: oId }, { session });
        if (!dispute || !voteWindow(dispute)) throw Error('Voting is not open for this case.');
        const prior = await db.collection(COLLECTIONS.DISPUTE_VOTES).findOne({ disputeId, $or: [{ userId }, { solanaAddress }] }, { session });
        if (prior) throw Error('You have already voted on this case.');
        const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress }, { session });
        const active = stake?.activeAmount;
        if (typeof active !== 'number' || !Number.isFinite(active) || active < STAKING_TIERS.staker.threshold) throw Error(`At least ${STAKING_TIERS.staker.threshold.toLocaleString()} active staked HIVE is required before voting.`);
        const weight = active * (getStakingTierInfo(active)?.governanceMultiplier || 1);
        if (!Number.isFinite(weight)) throw Error('Voting weight could not be checked.');
        const now = new Date();
        if (!voteWindow(dispute, now.getTime())) throw Error('Voting is not open for this case.');
        const changed = await db.collection(COLLECTIONS.DISPUTES).updateOne({ _id: oId, status: 'active', $expr: { $and: [{ $gt: ['$deadline', '$$NOW'] }, { $lte: ['$votingStartsAt', '$$NOW'] }] } }, { $inc: { voteCount: 1, [vote === 'slash' ? 'votesForSlash' : 'votesAgainstSlash']: weight }, $set: { phase: 'voting', updatedAt: now } }, { session });
        if (changed.modifiedCount !== 1) throw Error('Voting is not open for this case.');
        await db.collection(COLLECTIONS.DISPUTE_VOTES).insertOne({ userId, disputeId, vote, weight, source: 'staked_hive', solanaAddress, timestamp: now }, { session });
      });
    } finally { await session.endSession(); }
    await awardPoints(userId, 'dao_vote', 10, { disputeId, vote }).catch(() => logger.warn('Vote saved; points award unavailable.'));
    return { success: true };
  } catch (error: any) {
    if (error?.code === 11000) return { success: false, error: 'You have already voted on this case.' };
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('At least ') || ['Voting is not open for this case.', 'You have already voted on this case.', 'Voting weight could not be checked.'].includes(message)) return { success: false, error: message };
    logger.error('Vote result could not be confirmed', { tag: 'DISPUTES', disputeId });
    // A commit response can be lost. The UI checks the account-scoped vote receipt.
    throw Error('The vote result could not be confirmed. Check your vote.');
  }
}
