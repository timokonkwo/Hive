import { getDb, COLLECTIONS } from './db';
import { verifyUsdcTransfer } from './solana-pay';
import { logger } from '@/lib/logger';
import { getStakingTierInfo } from './token-utils';

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

    try {
      await db.collection(COLLECTIONS.SESSION_LEDGER).createIndex(
        { settlementTxSignature: 1, type: 1 },
        { unique: true, partialFilterExpression: { type: 'deposit' }, background: true }
      );
    } catch {
      return { success: false, error: 'Deposit replay protection is not ready. Try again shortly.' };
    }

    let ledgerId: any;
    try {
      const ledgerResult = await db.collection(COLLECTIONS.SESSION_LEDGER).insertOne({
        userId,
        type: 'deposit',
        amount: amountUsdc,
        timestamp: new Date(),
        status: 'pending',
        settlementTxSignature: txSignature,
        solanaAddress
      });
      ledgerId = ledgerResult.insertedId;
    } catch (insertError: any) {
      if (insertError?.code === 11000) {
        return { success: false, error: 'Transaction has already been processed.' };
      }
      throw insertError;
    }

    const treasuryWallet = process.env.HIVE_TREASURY_WALLET || 'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';

    // Verify transaction instructions on Solana
    const verification = await verifyUsdcTransfer(
      txSignature,
      solanaAddress,
      treasuryWallet,
      amountUsdc
    );

    if (!verification.verified) {
      await db.collection(COLLECTIONS.SESSION_LEDGER).deleteOne({ _id: ledgerId, status: 'pending' });
      return { success: false, error: verification.error || 'Solana transaction verification failed.' };
    }

    const actualAmount = verification.confirmedAmount || amountUsdc;

    // Update client balance
    try {
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
    } catch (budgetError) {
      await db.collection(COLLECTIONS.SESSION_LEDGER).deleteOne({ _id: ledgerId, status: 'pending' });
      throw budgetError;
    }

    try {
      await db.collection(COLLECTIONS.SESSION_LEDGER).updateOne({
        _id: ledgerId,
        status: 'pending',
      }, {
        $set: {
          amount: actualAmount,
          status: 'settled',
          verifiedAt: new Date(),
        }
      });
    } catch (ledgerError) {
      await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
        { userId },
        { $inc: { depositBalance: -actualAmount }, $set: { updatedAt: new Date() } }
      );
      throw ledgerError;
    }

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
): Promise<{ success: boolean; error?: string; remainingBalance?: number; ledgerId?: any; chargedCost?: number }> {
  try {
    const db = await getDb();
    const stake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: userId });
    const stakingTierInfo = getStakingTierInfo(stake?.activeAmount || 0);
    const discountBps = stakingTierInfo?.routingDiscountBps || 0;
    const discountedCost = Math.max(0, Math.round(cost * (10_000 - discountBps)) / 10_000);

    // Atomic deduction: only succeeds if balance >= cost AND session is active
    const result = await db.collection(COLLECTIONS.SESSION_BUDGETS).findOneAndUpdate(
      {
        userId,
        status: 'active',
        depositBalance: { $gte: discountedCost },
      },
      {
        $inc: { depositBalance: -discountedCost },
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
    let ledgerResult;
    try {
      ledgerResult = await db.collection(COLLECTIONS.SESSION_LEDGER).insertOne({
        userId,
        type: 'invocation',
        toolId,
        providerAddress,
        cost: discountedCost,
        originalCost: cost,
        stakingDiscountBps: discountBps,
        stakingTier: stakingTierInfo?.id || 'none',
        timestamp: new Date(),
        status: 'pending',
      });
    } catch (ledgerError) {
      await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
        { userId },
        { $inc: { depositBalance: discountedCost }, $set: { status: 'active', updatedAt: new Date() } }
      );
      throw ledgerError;
    }

    return { success: true, remainingBalance: newBalance, ledgerId: ledgerResult.insertedId, chargedCost: discountedCost };
  } catch (error: any) {
    logger.error('Failed to charge invocation fee', { tag: 'SESSION', error: error.message });
    return { success: false, error: error.message || 'Failed to process invocation charge' };
  }
}

export async function refundToolInvocation(
  userId: string,
  ledgerId: any,
  amount: number,
  reason: string
): Promise<void> {
  if (!ledgerId || !Number.isFinite(amount) || amount <= 0) return;

  const db = await getDb();
  const refunded = await db.collection(COLLECTIONS.SESSION_LEDGER).findOneAndUpdate(
    {
      _id: ledgerId,
      userId,
      type: 'invocation',
      status: 'pending',
    },
    {
      $set: {
        status: 'refunded',
        refundReason: reason.slice(0, 500),
        refundedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!refunded) return;

  await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
    { userId },
    {
      $inc: { depositBalance: amount },
      $set: { status: 'active', updatedAt: new Date() },
    }
  );
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
