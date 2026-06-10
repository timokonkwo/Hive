import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getDb, COLLECTIONS } from './db';
import { HIVE_MINT, HIVE_DECIMALS, getStakingTierInfo } from './token-utils';
import bs58 from 'bs58';
import { logger } from '@/lib/logger';

// ── Points Configuration Constants ──
export const POINTS_EXCHANGE_RATE = 10; // 10 Points = 1 $HIVE
export const MIN_CONVERSION_THRESHOLD = 1000; // Minimum 1,000 Points required to convert

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
    logger.error('Failed to parse treasury keypair', { tag: 'POINTS', error: (err as Error).message });
    return null;
  }
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Award points to a client or agent.
 */
export async function awardPoints(
  userId: string,
  action: string,
  points: number,
  metadata: any = {}
): Promise<void> {
  if (!userId) return;
  const db = await getDb();
  const stake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: userId });
  const tierInfo = getStakingTierInfo(stake?.activeAmount || 0);
  const multiplier = tierInfo?.pointsMultiplier || 1;
  const awardedPoints = Math.max(0, Math.round(points * multiplier));

  await db.collection(COLLECTIONS.USER_POINTS).updateOne(
    { userId },
    {
      $inc: {
        totalPointsEarned: awardedPoints,
        currentPointsBalance: awardedPoints,
      },
      $push: {
        history: {
          action,
          points: awardedPoints,
          timestamp: new Date(),
          metadata: {
            ...metadata,
            basePoints: points,
            stakingMultiplier: multiplier,
            stakingTier: tierInfo?.id || 'none',
          },
        } as any,
      },
    },
    { upsert: true }
  );

  logger.info('Points awarded', { tag: 'POINTS', points: awardedPoints, userId, action });
}

/**
 * Get current points balance and history for a user.
 */
export async function getPoints(userId: string) {
  const db = await getDb();
  const record = await db.collection(COLLECTIONS.USER_POINTS).findOne({ userId });
  if (!record) {
    return {
      userId,
      totalPointsEarned: 0,
      currentPointsBalance: 0,
      history: [],
    };
  }

  return {
    userId: record.userId,
    totalPointsEarned: record.totalPointsEarned || 0,
    currentPointsBalance: record.currentPointsBalance || 0,
    history: record.history || [],
  };
}

/**
 * Convert points to on-chain $HIVE tokens.
 */
export async function convertPointsToHive(
  userId: string,
  pointsToConvert: number,
  recipientAddress: string
): Promise<{ success: boolean; txSignature?: string; hiveAmount?: number; error?: string }> {
  if (pointsToConvert < MIN_CONVERSION_THRESHOLD) {
    return {
      success: false,
      error: `Minimum conversion threshold is ${MIN_CONVERSION_THRESHOLD} points.`,
    };
  }

  const db = await getDb();

  // Verify points balance
  const userRecord = await db.collection(COLLECTIONS.USER_POINTS).findOne({ userId });
  const currentBalance = userRecord?.currentPointsBalance || 0;
  if (currentBalance < pointsToConvert) {
    return {
      success: false,
      error: `Insufficient points balance. Current balance is ${currentBalance} points.`,
    };
  }

  // Verify treasury configuration
  const treasuryKeypair = getTreasuryKeypair();
  if (!treasuryKeypair) {
    return {
      success: false,
      error: 'Treasury conversion keypair is not configured on the server.',
    };
  }

  // Calculate target token amount
  const hiveAmount = pointsToConvert / POINTS_EXCHANGE_RATE;
  const rawAmount = BigInt(Math.round(hiveAmount * Math.pow(10, HIVE_DECIMALS)));

  try {
    const connection = getConnection();
    const recipientPubKey = new PublicKey(recipientAddress);
    const treasuryPubKey = treasuryKeypair.publicKey;

    // Get associated token accounts
    const sourceAta = await getAssociatedTokenAddress(HIVE_MINT, treasuryPubKey);
    const destinationAta = await getAssociatedTokenAddress(HIVE_MINT, recipientPubKey);

    const transaction = new Transaction();

    // Check if recipient ATA exists — create if not
    try {
      await getAccount(connection, destinationAta);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          treasuryPubKey,
          destinationAta,
          recipientPubKey,
          HIVE_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceAta,
        destinationAta,
        treasuryPubKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Fetch blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryPubKey;

    transaction.sign(treasuryKeypair);

    // Broadcast transaction
    const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 5,
    });

    // Confirm transaction
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      {
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    logger.info('On-chain conversion successful', { tag: 'POINTS', pointsToConvert, hiveAmount, txSignature });

    // Update points balance in DB
    await db.collection(COLLECTIONS.USER_POINTS).updateOne(
      { userId },
      {
        $inc: {
          currentPointsBalance: -pointsToConvert,
        },
        $push: {
          history: {
            action: 'convert_to_hive',
            points: -pointsToConvert,
            timestamp: new Date(),
            metadata: {
              solanaAddress: recipientAddress,
              hiveAmount,
              txSignature,
            },
          } as any,
        },
      }
    );

    return {
      success: true,
      txSignature,
      hiveAmount,
    };
  } catch (err: any) {
    logger.error('Conversion failed', { tag: 'POINTS', error: (err as Error).message });
    return {
      success: false,
      error: `Blockchain transaction failed: ${err.message || err}`,
    };
  }
}
