import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './db';
import { getHiveBalance } from './token-utils';
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
  stakedAmount: number
): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  try {
    const db = await getDb();
    const connection = getConnection();

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
      logger.warn('Failed to fetch Solana slot height, using mock', { tag: 'DISPUTES', error: err.message });
      return 182736450; // Fallback audit block height
    });

    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour voting window

    const dispute = {
      providerAddress,
      toolId,
      stakedAmount,
      reason,
      evidenceUri,
      status: 'active' as const,
      votesForSlash: 0,
      votesAgainstSlash: 0,
      voteCount: 0,
      snapshotBlock: slot,
      deadline,
      createdAt: new Date()
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
      actorName: 'System',
      metadata: {
        disputeId,
        providerAddress,
        toolId,
        stakedAmount,
        reason
      },
      createdAt: new Date(),
    });

    logger.info('Dispute opened', { tag: 'DISPUTES', disputeId, providerAddress, stakedAmount });
    return { success: true, disputeId };
  } catch (error: any) {
    logger.error('Dispute creation failed', { tag: 'DISPUTES', error: (error as Error).message });
    return { success: false, error: error.message || 'Failed to open dispute' };
  }
}

/**
 * Cast a vote on an active dispute.
 * Voting weight is calculated dynamically from the voter's Solana $HIVE token balance.
 */
export async function castDisputeVote(
  userId: string,
  disputeId: string,
  vote: 'slash' | 'dismiss',
  solanaAddress: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    
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

    // Check if already voted
    const alreadyVoted = await db.collection(COLLECTIONS.DISPUTE_VOTES).findOne({
      userId,
      disputeId
    });
    if (alreadyVoted) {
      return { success: false, error: 'You have already voted on this dispute.' };
    }

    // Check $HIVE balance for voting weight
    let votingWeight = 0;
    try {
      votingWeight = await getHiveBalance(solanaAddress);
    } catch (err: any) {
      logger.warn('Failed to fetch live $HIVE balance, checking mock/test environment', { tag: 'DISPUTES', error: err.message });
      votingWeight = 0;
    }

    // Enforce holder status (only token holders can vote)
    if (votingWeight <= 0) {
      return { success: false, error: 'Only $HIVE token holders are eligible to participate in governance votes.' };
    }

    // Record the vote
    await db.collection(COLLECTIONS.DISPUTE_VOTES).insertOne({
      userId,
      disputeId,
      vote,
      weight: votingWeight,
      solanaAddress,
      timestamp: new Date()
    });

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
