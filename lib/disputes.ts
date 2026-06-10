import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './db';
import { getStakingTierInfo } from './token-utils';
import { awardPoints } from './points';
import { Connection } from '@solana/web3.js';
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
  try {
    const db = await getDb();

    try {
      await Promise.all([
        db.collection(COLLECTIONS.DISPUTE_VOTES).createIndex(
          { disputeId: 1, userId: 1 },
          { unique: true, background: true }
        ),
        db.collection(COLLECTIONS.DISPUTE_VOTES).createIndex(
          { disputeId: 1, solanaAddress: 1 },
          { unique: true, background: true }
        ),
      ]);
    } catch {
      return { success: false, error: 'Vote replay protection is not ready. Try again shortly.' };
    }
    
    // Find dispute
    const oId = new ObjectId(disputeId);
    const dispute = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: oId });

    if (!dispute) {
      return { success: false, error: 'Dispute not found.' };
    }

    if (dispute.status !== 'active') {
      return { success: false, error: 'This dispute has already been resolved.' };
    }

    if (new Date() > new Date(dispute.deadline)) {
      return { success: false, error: 'The voting window for this dispute has closed.' };
    }

    const now = new Date();
    if (dispute.votingStartsAt && now < new Date(dispute.votingStartsAt)) {
      return { success: false, error: 'This dispute is still in the evidence period. Voting has not started.' };
    }

    if (dispute.phase === 'evidence') {
      await db.collection(COLLECTIONS.DISPUTES).updateOne(
        { _id: oId, phase: 'evidence' },
        { $set: { phase: 'voting', updatedAt: now } }
      );
    }

    // Check if already voted
    const alreadyVoted = await db.collection(COLLECTIONS.DISPUTE_VOTES).findOne({
      disputeId,
      $or: [{ userId }, { solanaAddress }]
    });
    if (alreadyVoted) {
      return { success: false, error: 'You have already voted on this dispute.' };
    }

    // Use recorded stake for governance weight. Live token balance voting is
    // intentionally excluded because it can be flash-loaned or moved between wallets.
    let votingWeight = 0;
    const votingSource = 'staked_hive';
    try {
      const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress });
      const activeStake = stake?.activeAmount || 0;
      const tierInfo = getStakingTierInfo(activeStake);
      votingWeight = activeStake * (tierInfo?.governanceMultiplier || 1);
    } catch (err: any) {
      logger.warn('Failed to fetch governance weight', { tag: 'DISPUTES', error: err.message });
      votingWeight = 0;
    }

    // Enforce holder status (only token holders can vote)
    if (votingWeight <= 0) {
      return { success: false, error: 'No active staked HIVE found for this wallet. Stake HIVE before voting.' };
    }

    // Record the vote
    try {
      await db.collection(COLLECTIONS.DISPUTE_VOTES).insertOne({
        userId,
        disputeId,
        vote,
        weight: votingWeight,
        source: votingSource,
        solanaAddress,
        timestamp: new Date()
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return { success: false, error: 'You have already voted on this dispute.' };
      }
      throw error;
    }

    // Increment dispute metrics
    const incrementFields: Record<string, number> = {
      voteCount: 1
    };

    if (vote === 'slash') {
      incrementFields.votesForSlash = votingWeight;
    } else {
      incrementFields.votesAgainstSlash = votingWeight;
    }

    await db.collection(COLLECTIONS.DISPUTES).updateOne(
      { _id: oId },
      { $inc: incrementFields }
    );

    // Award +10 Hive Points for voting
    await awardPoints(userId, 'dao_vote', 10, { disputeId, vote, votingWeight })
      .catch((err) => logger.error('Failed to award points for DAO vote', { tag: 'POINTS', error: err.message }));

    logger.info('Vote cast', { tag: 'DISPUTES', disputeId, userId, votingWeight });
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to cast vote', { tag: 'DISPUTES', error: (error as Error).message });
    return { success: false, error: error.message || 'Failed to submit vote.' };
  }
}
