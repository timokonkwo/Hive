import { getDb, COLLECTIONS } from './db';
import { verifyUsdcTransfer } from './solana-pay';
import { logger } from '@/lib/logger';

/**
 * Record a client deposit to their session budget.
 * Verifies on-chain Solana USDC transfer to platform vault.
 */
export async function depositSessionBudget(
  userId: string,
  solanaAddress: string,
  txSignature: string,
  amountUsdc: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();

    // Check if signature was already processed
    const alreadyProcessed = await db.collection(COLLECTIONS.SESSION_LEDGER).findOne({
      settlementTxSignature: txSignature,
      type: 'deposit'
    });
    if (alreadyProcessed) {
      return { success: false, error: 'Transaction has already been processed.' };
    }

    const treasuryWallet = process.env.HIVE_TREASURY_WALLET || '3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura';

    // Verify transaction instructions on Solana
    const verification = await verifyUsdcTransfer(
      txSignature,
      solanaAddress,
      treasuryWallet,
      amountUsdc
    );

    if (!verification.verified) {
      return { success: false, error: verification.error || 'Solana transaction verification failed.' };
    }

    const actualAmount = verification.confirmedAmount || amountUsdc;

    // Update client balance
    await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
      { userId },
      {
        $set: {
          solanaAddress,
          status: 'active',
          updatedAt: new Date()
        },
        $inc: {
          depositBalance: actualAmount,
          reservedBalance: 0
        },
        $setOnInsert: {
          lastSettledAt: new Date(),
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Insert deposit event in ledger
    await db.collection(COLLECTIONS.SESSION_LEDGER).insertOne({
      userId,
      type: 'deposit',
      amount: actualAmount,
      timestamp: new Date(),
      status: 'settled',
      settlementTxSignature: txSignature,
      solanaAddress
    });

    logger.info('Deposit processed', { tag: 'SESSION', amount: actualAmount, userId });
    return { success: true };
  } catch (error: any) {
    logger.error('Deposit verification error', { tag: 'SESSION', error: error.message });
    return { success: false, error: error.message || 'Deposit verification failed' };
  }
}

/**
 * Charge cost of tool invocation to client's session ledger.
 * Uses a single atomic findOneAndUpdate to prevent race conditions
 * under concurrent tool calls. Suspends session automatically if
 * the remaining balance falls below the safety threshold ($0.05).
 */
export async function chargeToolInvocation(
  userId: string,
  toolId: string,
  providerAddress: string,
  cost: number
): Promise<{ success: boolean; error?: string; remainingBalance?: number }> {
  try {
    const db = await getDb();

    // Atomic deduction: only succeeds if balance >= cost AND session is active
    const result = await db.collection(COLLECTIONS.SESSION_BUDGETS).findOneAndUpdate(
      {
        userId,
        status: 'active',
        depositBalance: { $gte: cost },
      },
      {
        $inc: { depositBalance: -cost },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      // Atomic update failed — determine why
      const budget = await db.collection(COLLECTIONS.SESSION_BUDGETS).findOne({ userId });
      if (!budget) {
        return { success: false, error: 'No active session budget found. Please deposit funds first.' };
      }
      if (budget.status === 'suspended') {
        return { success: false, error: 'Session is suspended. Please deposit additional USDC.' };
      }
      // Balance was insufficient — auto-suspend
      await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
        { userId },
        { $set: { status: 'suspended', updatedAt: new Date() } }
      );
      return {
        success: false,
        error: 'Insufficient balance. Session budget suspended.',
        remainingBalance: budget.depositBalance || 0,
      };
    }

    const newBalance = result.depositBalance ?? 0;

    // Auto-suspend if balance dropped below safety threshold
    if (newBalance < 0.05) {
      await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
        { userId },
        { $set: { status: 'suspended', updatedAt: new Date() } }
      );
    }

    // Record unpaid invocation in the session ledger
    await db.collection(COLLECTIONS.SESSION_LEDGER).insertOne({
      userId,
      type: 'invocation',
      toolId,
      providerAddress,
      cost,
      timestamp: new Date(),
      status: 'pending',
    });

    return { success: true, remainingBalance: newBalance };
  } catch (error: any) {
    logger.error('Failed to charge invocation fee', { tag: 'SESSION', error: error.message });
    return { success: false, error: error.message || 'Failed to process invocation charge' };
  }
}

/**
 * Retrieve active session budget info for a user.
 */
export async function getSessionBudget(userId: string) {
  const db = await getDb();
  const budget = await db.collection(COLLECTIONS.SESSION_BUDGETS).findOne({ userId });

  if (!budget) {
    return {
      userId,
      solanaAddress: '',
      depositBalance: 0,
      reservedBalance: 0,
      status: 'suspended'
    };
  }

  return {
    userId: budget.userId,
    solanaAddress: budget.solanaAddress || '',
    depositBalance: budget.depositBalance || 0,
    reservedBalance: budget.reservedBalance || 0,
    status: budget.status || 'suspended',
    lastSettledAt: budget.lastSettledAt
  };
}
