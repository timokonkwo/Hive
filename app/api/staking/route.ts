import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import {
  ALL_STAKING_TIERS,
  getStakingTier,
  getStakingTierInfo,
  verifyHiveTransfer,
} from '@/lib/token-utils';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

async function resolveStaker(req: NextRequest, db: any) {
  const client = await authenticateClient(req);
  if (client) {
    const profile = await db.collection(COLLECTIONS.CLIENTS).findOne({ address: client.userId });
      return {
        stakerId: client.userId,
        stakerType: 'client' as const,
        linkedSolanaAddress: profile?.solanaAddress || null,
        linkedSolanaAddressVerified: !!profile?.solanaAddressVerifiedAt,
        profile,
      };
  }

  const agentAuth = await authenticateRequest(req.headers, db);
  if (agentAuth) {
      return {
        stakerId: agentAuth.agent.id,
        stakerType: 'agent' as const,
        linkedSolanaAddress: agentAuth.agent.solanaAddress || null,
        linkedSolanaAddressVerified: !!agentAuth.agent.solanaAddressVerifiedAt,
        agent: agentAuth.agent,
      };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`staking-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const staker = await resolveStaker(req, db);
    if (!staker) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const stake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: staker.stakerId });
    const activeAmount = stake?.activeAmount || 0;
    const tier = getStakingTier(activeAmount);
    const tierInfo = getStakingTierInfo(activeAmount);

    return NextResponse.json({
      stake: {
        stakerId: staker.stakerId,
        stakerType: staker.stakerType,
        solanaAddress: stake?.solanaAddress || staker.linkedSolanaAddress || null,
        solanaAddressVerified: staker.linkedSolanaAddressVerified,
        activeAmount,
        lockedAmount: stake?.lockedAmount || 0,
        slashedAmount: stake?.slashedAmount || 0,
        status: activeAmount > 0 ? 'active' : 'none',
        tier,
        tierInfo,
        updatedAt: stake?.updatedAt || null,
      },
      tiers: ALL_STAKING_TIERS,
      treasuryWallet: process.env.HIVE_TREASURY_WALLET || '3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura',
    });
  } catch (error: any) {
    logger.error('GET /api/staking error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load staking data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`staking-post:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const staker = await resolveStaker(req, db);
    if (!staker) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const { txSignature, solanaAddress, amountHive } = body;

    if (
      !txSignature ||
      typeof txSignature !== 'string' ||
      !TX_SIGNATURE_REGEX.test(txSignature) ||
      !solanaAddress ||
      typeof solanaAddress !== 'string' ||
      typeof amountHive !== 'number' ||
      amountHive <= 0
    ) {
      return NextResponse.json(
        { error: 'txSignature, solanaAddress, and a positive amountHive are required.' },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(solanaAddress)) {
      return NextResponse.json({ error: 'Invalid Solana staking wallet.' }, { status: 400 });
    }

    if (!staker.linkedSolanaAddress) {
      return NextResponse.json(
        { error: 'Link this Solana wallet to your Hive profile before staking.' },
        { status: 400 }
      );
    }

    if (!staker.linkedSolanaAddressVerified) {
      return NextResponse.json(
        { error: 'Re-link this Solana wallet with a signature before staking.' },
        { status: 403 }
      );
    }

    if (staker.linkedSolanaAddress !== solanaAddress) {
      return NextResponse.json(
        { error: 'Stake sender must match the Solana wallet linked to this Hive account.' },
        { status: 403 }
      );
    }

    const treasuryWallet = process.env.HIVE_TREASURY_WALLET || '3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura';

    try {
      await db.collection(COLLECTIONS.STAKE_EVENTS).createIndex(
        { txSignature: 1 },
        { unique: true, background: true }
      );
    } catch {
      return NextResponse.json(
        { error: 'Staking replay protection is not ready. Try again shortly.' },
        { status: 503 }
      );
    }

    try {
      await db.collection(COLLECTIONS.STAKE_EVENTS).insertOne({
        stakerId: staker.stakerId,
        stakerType: staker.stakerType,
        solanaAddress,
        txSignature,
        amount: amountHive,
        type: 'stake',
        status: 'pending',
        createdAt: new Date(),
      });
    } catch (insertError: any) {
      if (insertError?.code === 11000) {
        return NextResponse.json(
          { error: 'This staking transaction has already been used.' },
          { status: 400 }
        );
      }
      throw insertError;
    }

    const verification = await verifyHiveTransfer(
      txSignature,
      solanaAddress,
      treasuryWallet,
      amountHive
    );

    if (!verification.verified) {
      await db.collection(COLLECTIONS.STAKE_EVENTS).deleteOne({ txSignature, status: 'pending' });
      return NextResponse.json(
        { error: verification.error || 'HIVE staking transfer could not be verified.' },
        { status: 400 }
      );
    }

    const confirmedAmount = verification.confirmedAmount || amountHive;
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
        $inc: {
          activeAmount: confirmedAmount,
        },
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
    const tierInfo = getStakingTierInfo(activeAmount);

    await db.collection(COLLECTIONS.STAKE_EVENTS).updateOne(
      { txSignature },
      {
        $set: {
          status: 'verified',
          confirmedAmount,
          blockTime: verification.blockTime || null,
          verifiedAt: now,
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
            isStaked: activeAmount >= 10_000,
            stakedAmount: activeAmount,
            stakingTier: tier,
            updatedAt: now,
          },
        }
      );
    } else {
      await db.collection(COLLECTIONS.CLIENTS).updateOne(
        { address: staker.stakerId },
        {
          $set: {
            stakedAmount: activeAmount,
            stakingTier: tier,
            updatedAt: now,
          },
        }
      );
    }

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'HiveStaked',
      actorName: staker.stakerType,
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
        activeAmount,
        lockedAmount: stakeResult?.lockedAmount || 0,
        slashedAmount: stakeResult?.slashedAmount || 0,
        status: 'active',
        addedAmount: confirmedAmount,
        tier,
        tierInfo,
        solanaAddress,
      },
    });
  } catch (error: any) {
    logger.error('POST /api/staking error:', error);
    return NextResponse.json({ error: error.message || 'Staking failed.' }, { status: 500 });
  }
}
