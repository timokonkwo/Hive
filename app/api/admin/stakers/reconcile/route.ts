import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { COLLECTIONS, getDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';
import {
  HIVE_DECIMALS,
  STAKING_TIERS,
  getStakingTier,
  parseHiveAmountToRaw,
  verifyHiveTransfer,
} from '@/lib/token-utils';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { logger } from '@/lib/logger';

const TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const MAX_RECONCILE_BODY_BYTES = 8 * 1024;
const MAX_STAKE_HIVE = 1_000_000_000;
const DEFAULT_HIVE_TREASURY_WALLET = 'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';

async function resolveVerifiedStaker(db: any, solanaAddress: string, stakerType?: string, stakerId?: string) {
  if (stakerType === 'client' && stakerId) {
    const client = await db.collection(COLLECTIONS.CLIENTS).findOne({ address: stakerId });
    if (client?.solanaAddressVerifiedAt && client.solanaAddress === solanaAddress) {
      return { stakerId: client.address, stakerType: 'client' as const, profile: client };
    }
    return null;
  }

  if (stakerType === 'agent' && stakerId && ObjectId.isValid(stakerId)) {
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(stakerId) });
    if (agent?.solanaAddressVerifiedAt && agent.solanaAddress === solanaAddress) {
      return { stakerId: agent._id.toString(), stakerType: 'agent' as const, profile: agent };
    }
    return null;
  }

  const [client, agent] = await Promise.all([
    db.collection(COLLECTIONS.CLIENTS).findOne({ solanaAddress, solanaAddressVerifiedAt: { $exists: true, $ne: null } }),
    db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress, solanaAddressVerifiedAt: { $exists: true, $ne: null } }),
  ]);

  if (client && agent) return { conflict: true };
  if (client) return { stakerId: client.address, stakerType: 'client' as const, profile: client };
  if (agent) return { stakerId: agent._id.toString(), stakerType: 'agent' as const, profile: agent };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (admin.error) return admin.error;

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_RECONCILE_BODY_BYTES) {
      return NextResponse.json({ error: 'Reconcile request body is too large.' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const txSignature = String(body.txSignature || '').trim();
    const solanaAddress = String(body.solanaAddress || '').trim();
    const amountHive = body.amountHive;
    const amountHiveNumber = Number(amountHive);

    if (
      !TX_SIGNATURE_REGEX.test(txSignature) ||
      !isValidSolanaAddress(solanaAddress) ||
      (typeof amountHive !== 'number' && typeof amountHive !== 'string') ||
      !Number.isFinite(amountHiveNumber) ||
      amountHiveNumber <= 0 ||
      amountHiveNumber > MAX_STAKE_HIVE ||
      !parseHiveAmountToRaw(amountHive)
    ) {
      return NextResponse.json(
        { error: `txSignature, solanaAddress, and a positive amountHive with up to ${HIVE_DECIMALS} decimals are required.` },
        { status: 400 }
      );
    }

    const db = await getDb();
    const staker = await resolveVerifiedStaker(db, solanaAddress, body.stakerType, body.stakerId);
    if ((staker as any)?.conflict) {
      return NextResponse.json(
        { error: 'Both a client and agent use this Solana wallet. Provide stakerType and stakerId.' },
        { status: 409 }
      );
    }
    if (!staker) {
      return NextResponse.json(
        { error: 'No verified Hive profile is linked to this Solana wallet.' },
        { status: 404 }
      );
    }

    try {
      await db.collection(COLLECTIONS.STAKE_EVENTS).createIndex(
        { txSignature: 1 },
        { unique: true, background: true }
      );
    } catch {
      return NextResponse.json({ error: 'Staking replay protection is not ready. Try again shortly.' }, { status: 503 });
    }

    try {
      await db.collection(COLLECTIONS.STAKE_EVENTS).insertOne({
        stakerId: staker.stakerId,
        stakerType: staker.stakerType,
        solanaAddress,
        txSignature,
        amount: amountHiveNumber,
        type: 'stake',
        status: 'pending_reconcile',
        createdAt: new Date(),
        reconciledBy: admin.client?.userId || 'admin_api_key',
      });
    } catch (insertError: any) {
      if (insertError?.code === 11000) {
        return NextResponse.json({ error: 'This staking transaction has already been recorded.' }, { status: 409 });
      }
      throw insertError;
    }

    const treasuryWallet = process.env.HIVE_TREASURY_WALLET || DEFAULT_HIVE_TREASURY_WALLET;
    const verification = await verifyHiveTransfer(
      txSignature,
      solanaAddress,
      treasuryWallet,
      amountHive,
      { maxAgeMinutes: null }
    );

    if (!verification.verified) {
      await db.collection(COLLECTIONS.STAKE_EVENTS).deleteOne({ txSignature, status: 'pending_reconcile' });
      return NextResponse.json(
        { error: verification.error || 'HIVE staking transfer could not be verified.' },
        { status: 400 }
      );
    }

    const confirmedAmount = verification.confirmedAmount || amountHiveNumber;
    const now = new Date();
    const stakeResult = await db.collection(COLLECTIONS.STAKES).findOneAndUpdate(
      { stakerId: staker.stakerId },
      {
        $set: {
          stakerType: staker.stakerType,
          solanaAddress,
          status: 'active',
          updatedAt: now,
        },
        $inc: { activeAmount: confirmedAmount },
        $setOnInsert: {
          lockedAmount: 0,
          slashedAmount: 0,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const activeAmount = stakeResult?.activeAmount || confirmedAmount;
    const tier = getStakingTier(activeAmount);

    await db.collection(COLLECTIONS.STAKE_EVENTS).updateOne(
      { txSignature },
      {
        $set: {
          status: 'verified',
          confirmedAmount,
          blockTime: verification.blockTime || null,
          verifiedAt: now,
          reconciledAt: now,
          resultingActiveAmount: activeAmount,
          resultingTier: tier,
        },
      }
    );

    if (staker.stakerType === 'agent') {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(staker.stakerId) },
        {
          $set: {
            isStaked: activeAmount >= STAKING_TIERS.staker.threshold,
            stakedAmount: activeAmount,
            stakingTier: tier,
            updatedAt: now,
          },
        }
      );
    } else {
      await db.collection(COLLECTIONS.CLIENTS).updateOne(
        { address: staker.stakerId },
        { $set: { stakedAmount: activeAmount, stakingTier: tier, updatedAt: now } }
      );
    }

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'HiveStakeReconciled',
      actorName: 'admin',
      metadata: {
        stakerId: staker.stakerId,
        stakerType: staker.stakerType,
        solanaAddress,
        amount: confirmedAmount,
        activeAmount,
        tier,
        txSignature,
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      stake: {
        stakerId: staker.stakerId,
        stakerType: staker.stakerType,
        solanaAddress,
        activeAmount,
        addedAmount: confirmedAmount,
        tier,
      },
    });
  } catch (error: any) {
    logger.error('POST /api/admin/stakers/reconcile error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reconcile stake.' }, { status: 500 });
  }
}
