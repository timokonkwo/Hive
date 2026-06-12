import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import {
  HIVE_MINT,
  ALL_STAKING_TIERS,
  HIVE_DECIMALS,
  STAKING_TIERS,
  getStakingTier,
  getStakingTierInfo,
  parseHiveAmountToRaw,
  rawHiveAmountToNumber,
  verifyHiveTransfer,
} from '@/lib/token-utils';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import bs58 from 'bs58';

const TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const MAX_STAKE_HIVE = 1_000_000_000;
const MIN_ACTIVE_STAKE_HIVE = STAKING_TIERS.staker.threshold;
const UNSTAKE_COOLDOWN_DAYS = 7;
const UNSTAKE_COOLDOWN_MS = UNSTAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const UNSTAKE_REQUEST_ID_REGEX = /^[a-f0-9]{24}$/i;
const DEFAULT_HIVE_TREASURY_WALLET = 'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';
const MAX_STAKING_REQUEST_BYTES = 8 * 1024;
const MAX_STAKE_TX_AGE_MINUTES = 7 * 24 * 60;
const MIN_TREASURY_SOL_LAMPORTS = 5_000_000; // Covers transfer fees and recipient ATA creation.

function hasValidHivePrecision(amount: number | string) {
  return parseHiveAmountToRaw(amount) !== null;
}

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
  } catch (error: any) {
    logger.error('Failed to parse HIVE treasury keypair', { tag: 'STAKING', error: error.message });
    return null;
  }
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function confirmSignatureByPolling(connection: Connection, signature: string, lastValidBlockHeight: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    const status = (await connection.getSignatureStatuses([signature]))?.value?.[0];
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return;
    }

    const blockHeight = await connection.getBlockHeight('confirmed');
    if (blockHeight > lastValidBlockHeight) {
      throw new Error('Transaction expired before confirmation.');
    }
    await wait(1500);
  }
  throw new Error('Transaction was sent but not confirmed in time.');
}

function visiblePendingUnstakes(stake: any) {
  return Array.isArray(stake?.pendingUnstakes)
    ? stake.pendingUnstakes.filter((item: any) => item?.status !== 'claimed')
    : [];
}

async function syncProfileStake(db: any, staker: any, activeAmount: number, now = new Date()) {
  const tier = getStakingTier(activeAmount);
  if (staker.stakerType === 'agent') {
    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(staker.stakerId) },
      {
        $set: {
          isStaked: activeAmount >= MIN_ACTIVE_STAKE_HIVE,
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
  return tier;
}

async function findStakeExitBlocker(db: any, solanaAddress: string) {
  const [activeDispute, pendingReport] = await Promise.all([
    db.collection(COLLECTIONS.DISPUTES).findOne({
      providerAddress: solanaAddress,
      status: 'active',
    }),
    db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({
      providerAddress: solanaAddress,
      status: { $in: ['submitted', 'needs_evidence', 'escalated'] },
    }),
  ]);

  if (activeDispute) return 'This stake is locked by an active slashing dispute.';
  if (pendingReport) return 'This stake is locked by a pending DAO report.';
  return null;
}

async function sendHiveFromTreasury(recipientAddress: string, amountHive: number) {
  const treasuryKeypair = getTreasuryKeypair();
  if (!treasuryKeypair) {
    throw new Error('Treasury withdrawal keypair is not configured. Set HIVE_TREASURY_KEYPAIR on the server.');
  }

  const configuredTreasury = process.env.HIVE_TREASURY_WALLET || DEFAULT_HIVE_TREASURY_WALLET;
  if (configuredTreasury && treasuryKeypair.publicKey.toBase58() !== configuredTreasury) {
    throw new Error('Treasury withdrawal keypair does not match HIVE_TREASURY_WALLET.');
  }

  const connection = getConnection();
  const recipientKey = new PublicKey(recipientAddress);
  const treasuryAta = await getAssociatedTokenAddress(HIVE_MINT, treasuryKeypair.publicKey);
  const recipientAta = await getAssociatedTokenAddress(HIVE_MINT, recipientKey);
  const rawAmount = parseHiveAmountToRaw(amountHive);
  if (rawAmount === null) {
    throw new Error('Invalid HIVE withdrawal amount.');
  }

  const treasurySolLamports = await connection.getBalance(treasuryKeypair.publicKey, 'confirmed');
  if (treasurySolLamports < MIN_TREASURY_SOL_LAMPORTS) {
    throw new Error(
      `Treasury wallet ${treasuryKeypair.publicKey.toBase58()} needs SOL for unstake claim fees. ` +
      `Current balance is ${(treasurySolLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL; fund it with at least ` +
      `${(MIN_TREASURY_SOL_LAMPORTS / LAMPORTS_PER_SOL).toFixed(3)} SOL and retry.`
    );
  }

  let treasuryHiveAccount;
  try {
    treasuryHiveAccount = await getAccount(connection, treasuryAta);
  } catch {
    throw new Error(`Treasury HIVE token account ${treasuryAta.toBase58()} does not exist.`);
  }

  if (treasuryHiveAccount.amount < rawAmount) {
    throw new Error(
      `Treasury HIVE balance is insufficient for this claim. Required ${amountHive.toLocaleString()} HIVE, ` +
      `available ${rawHiveAmountToNumber(treasuryHiveAccount.amount).toLocaleString()} HIVE.`
    );
  }

  const transaction = new Transaction();
  try {
    await getAccount(connection, recipientAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        treasuryKeypair.publicKey,
        recipientAta,
        recipientKey,
        HIVE_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  transaction.add(
    createTransferInstruction(
      treasuryAta,
      recipientAta,
      treasuryKeypair.publicKey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = treasuryKeypair.publicKey;
  transaction.sign(treasuryKeypair);

  let txSignature = '';
  try {
    txSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 5,
    });
  } catch (error: any) {
    let logs: string[] | null = null;
    if (typeof error?.getLogs === 'function') {
      logs = await error.getLogs(connection).catch(() => null);
    }
    const logText = logs?.length ? ` Logs: ${logs.join(' | ')}` : '';
    throw new Error(`${error?.message || 'Treasury transfer simulation failed.'}${logText}`);
  }
  await confirmSignatureByPolling(connection, txSignature, latestBlockhash.lastValidBlockHeight);
  return txSignature;
}

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
        pendingUnstakes: visiblePendingUnstakes(stake),
        status: activeAmount > 0 ? 'active' : (stake?.lockedAmount || 0) > 0 ? 'cooldown' : 'none',
        tier,
        tierInfo,
        updatedAt: stake?.updatedAt || null,
      },
      tiers: ALL_STAKING_TIERS,
      unstakePolicy: {
        cooldownDays: UNSTAKE_COOLDOWN_DAYS,
        benefitsStopOnRequest: true,
        lockedStakeRemainsSlashable: true,
      },
      treasuryWallet: process.env.HIVE_TREASURY_WALLET || DEFAULT_HIVE_TREASURY_WALLET,
    });
  } catch (error: any) {
    logger.error('GET /api/staking error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load staking data.' }, { status: 500 });
  }
}

async function handleRequestUnstake(db: any, staker: any, body: any) {
  const amountHive = Number(body.amountHive);
  if (
    !Number.isFinite(amountHive) ||
    amountHive <= 0 ||
    amountHive > MAX_STAKE_HIVE ||
    !hasValidHivePrecision(amountHive)
  ) {
    return NextResponse.json(
      { error: `A positive amountHive with up to ${HIVE_DECIMALS} decimals is required.` },
      { status: 400 }
    );
  }

  const stake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: staker.stakerId });
  if (!stake || (stake.activeAmount || 0) <= 0) {
    return NextResponse.json({ error: 'No active HIVE stake is available to unstake.' }, { status: 400 });
  }

  const solanaAddress = stake.solanaAddress || staker.linkedSolanaAddress;
  if (!solanaAddress || !isValidSolanaAddress(solanaAddress)) {
    return NextResponse.json({ error: 'A verified Solana staking wallet is required.' }, { status: 400 });
  }

  const blocker = await findStakeExitBlocker(db, solanaAddress);
  if (blocker) {
    return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const requestId = new ObjectId().toString();
  const now = new Date();
  const unlocksAt = new Date(now.getTime() + UNSTAKE_COOLDOWN_MS);

  const updatedStake = await db.collection(COLLECTIONS.STAKES).findOneAndUpdate(
    {
      _id: stake._id,
      stakerId: staker.stakerId,
      activeAmount: { $gte: amountHive },
    },
    {
      $inc: {
        activeAmount: -amountHive,
        lockedAmount: amountHive,
      },
      $push: {
        pendingUnstakes: {
          id: requestId,
          amount: amountHive,
          status: 'cooldown',
          requestedAt: now,
          unlocksAt,
        } as any,
      },
      $set: {
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedStake) {
    return NextResponse.json({ error: 'Insufficient active stake for this unstake request.' }, { status: 400 });
  }

  const activeAmount = updatedStake.activeAmount || 0;
  const tier = await syncProfileStake(db, staker, activeAmount, now);
  const tierInfo = getStakingTierInfo(activeAmount);
  const status = activeAmount > 0 ? 'active' : (updatedStake.lockedAmount || 0) > 0 ? 'cooldown' : 'none';
  await db.collection(COLLECTIONS.STAKES).updateOne(
    { _id: stake._id },
    { $set: { status, updatedAt: now } }
  );

  await db.collection(COLLECTIONS.STAKE_EVENTS).insertOne({
    stakerId: staker.stakerId,
    stakerType: staker.stakerType,
    solanaAddress,
    amount: amountHive,
    type: 'unstake_requested',
    status: 'cooldown',
    requestId,
    cooldownDays: UNSTAKE_COOLDOWN_DAYS,
    unlocksAt,
    resultingActiveAmount: activeAmount,
    resultingTier: tier,
    createdAt: now,
  });

  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'HiveUnstakeRequested',
    actorName: staker.stakerType,
    metadata: {
      stakerId: staker.stakerId,
      stakerType: staker.stakerType,
      solanaAddress,
      amount: amountHive,
      requestId,
      unlocksAt,
      activeAmount,
      tier,
    },
    createdAt: now,
  });

  return NextResponse.json({
    success: true,
    request: { id: requestId, amount: amountHive, status: 'cooldown', requestedAt: now, unlocksAt },
    stake: {
      activeAmount,
      lockedAmount: updatedStake.lockedAmount || 0,
      slashedAmount: updatedStake.slashedAmount || 0,
      pendingUnstakes: visiblePendingUnstakes(updatedStake),
      status,
      tier,
      tierInfo,
      solanaAddress,
    },
  });
}

async function handleClaimUnstake(db: any, staker: any, body: any) {
  const requestId = String(body.requestId || '');
  if (!UNSTAKE_REQUEST_ID_REGEX.test(requestId)) {
    return NextResponse.json({ error: 'A valid unstake requestId is required.' }, { status: 400 });
  }

  const stake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: staker.stakerId });
  const request = Array.isArray(stake?.pendingUnstakes)
    ? stake.pendingUnstakes.find((item: any) => item?.id === requestId)
    : null;

  if (!stake || !request || request.status !== 'cooldown') {
    return NextResponse.json({ error: 'No claimable unstake request was found.' }, { status: 404 });
  }

  const now = new Date();
  if (new Date(request.unlocksAt) > now) {
    return NextResponse.json(
      { error: `Unstake cooldown ends on ${new Date(request.unlocksAt).toISOString()}.` },
      { status: 400 }
    );
  }

  const solanaAddress = stake.solanaAddress || staker.linkedSolanaAddress;
  if (!solanaAddress || !isValidSolanaAddress(solanaAddress)) {
    return NextResponse.json({ error: 'A verified Solana staking wallet is required.' }, { status: 400 });
  }

  const blocker = await findStakeExitBlocker(db, solanaAddress);
  if (blocker) {
    return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const amountHive = Number(request.amount || 0);
  const lockedAmount = Number(stake.lockedAmount || 0);
  if (!Number.isFinite(amountHive) || amountHive <= 0 || lockedAmount < amountHive) {
    return NextResponse.json({ error: 'Locked stake is no longer sufficient for this claim.' }, { status: 409 });
  }

  const lockResult = await db.collection(COLLECTIONS.STAKES).updateOne(
    {
      _id: stake._id,
      lockedAmount: { $gte: amountHive },
      pendingUnstakes: {
        $elemMatch: {
          id: requestId,
          status: 'cooldown',
          unlocksAt: { $lte: now },
        },
      },
    },
    {
      $set: {
        'pendingUnstakes.$.status': 'claiming',
        'pendingUnstakes.$.claimStartedAt': now,
        updatedAt: now,
      },
    }
  );

  if (lockResult.modifiedCount !== 1) {
    return NextResponse.json({ error: 'This unstake request is not claimable right now.' }, { status: 409 });
  }

  const postLockBlocker = await findStakeExitBlocker(db, solanaAddress);
  if (postLockBlocker) {
    await db.collection(COLLECTIONS.STAKES).updateOne(
      { _id: stake._id, 'pendingUnstakes.id': requestId },
      {
        $set: {
          'pendingUnstakes.$.status': 'cooldown',
          'pendingUnstakes.$.claimError': postLockBlocker,
          updatedAt: new Date(),
        },
      }
    );
    return NextResponse.json({ error: postLockBlocker }, { status: 409 });
  }

  let txSignature = '';
  try {
    txSignature = await sendHiveFromTreasury(solanaAddress, amountHive);
  } catch (error: any) {
    await db.collection(COLLECTIONS.STAKES).updateOne(
      { _id: stake._id, 'pendingUnstakes.id': requestId },
      {
        $set: {
          'pendingUnstakes.$.status': 'cooldown',
          'pendingUnstakes.$.claimError': error.message || 'Treasury transfer failed.',
          updatedAt: new Date(),
        },
      }
    );
    return NextResponse.json({ error: error.message || 'Treasury transfer failed.' }, { status: 502 });
  }

  const claimedAt = new Date();
  const updatedStake = await db.collection(COLLECTIONS.STAKES).findOneAndUpdate(
    {
      _id: stake._id,
      lockedAmount: { $gte: amountHive },
      pendingUnstakes: { $elemMatch: { id: requestId, status: 'claiming' } },
    },
    {
      $inc: {
        lockedAmount: -amountHive,
      },
      $set: {
        'pendingUnstakes.$.status': 'claimed',
        'pendingUnstakes.$.claimedAt': claimedAt,
        'pendingUnstakes.$.claimTxSignature': txSignature,
        updatedAt: claimedAt,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedStake) {
    logger.error('Unstake claim transfer succeeded but ledger update failed', { tag: 'STAKING', requestId, txSignature });
    return NextResponse.json(
      { error: 'Treasury transfer succeeded but stake ledger update failed. Contact support.', txSignature },
      { status: 500 }
    );
  }

  const activeAmount = updatedStake.activeAmount || 0;
  const status = activeAmount > 0 ? 'active' : (updatedStake.lockedAmount || 0) > 0 ? 'cooldown' : 'none';
  const tier = getStakingTier(activeAmount);
  const tierInfo = getStakingTierInfo(activeAmount);
  await db.collection(COLLECTIONS.STAKES).updateOne(
    { _id: stake._id },
    { $set: { status, updatedAt: claimedAt } }
  );

  await db.collection(COLLECTIONS.STAKE_EVENTS).insertOne({
    stakerId: staker.stakerId,
    stakerType: staker.stakerType,
    solanaAddress,
    amount: amountHive,
    type: 'unstake_claimed',
    status: 'verified',
    requestId,
    txSignature,
    createdAt: claimedAt,
  });

  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'HiveUnstakeClaimed',
    actorName: staker.stakerType,
    metadata: {
      stakerId: staker.stakerId,
      stakerType: staker.stakerType,
      solanaAddress,
      amount: amountHive,
      requestId,
      txSignature,
    },
    createdAt: claimedAt,
  });

  return NextResponse.json({
    success: true,
    txSignature,
    claimedAmount: amountHive,
    stake: {
      activeAmount,
      lockedAmount: updatedStake.lockedAmount || 0,
      slashedAmount: updatedStake.slashedAmount || 0,
      pendingUnstakes: visiblePendingUnstakes(updatedStake),
      status,
      tier,
      tierInfo,
      solanaAddress,
    },
  });
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

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_STAKING_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Staking request body is too large.' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (body?.action === 'request_unstake') {
      return handleRequestUnstake(db, staker, body);
    }
    if (body?.action === 'claim_unstake') {
      return handleClaimUnstake(db, staker, body);
    }

    const { txSignature, solanaAddress, amountHive } = body;
    const amountHiveNumber = Number(amountHive);

    if (
      !txSignature ||
      typeof txSignature !== 'string' ||
      !TX_SIGNATURE_REGEX.test(txSignature) ||
      !solanaAddress ||
      typeof solanaAddress !== 'string' ||
      (typeof amountHive !== 'number' && typeof amountHive !== 'string') ||
      !Number.isFinite(amountHiveNumber) ||
      amountHiveNumber <= 0 ||
      amountHiveNumber > MAX_STAKE_HIVE ||
      !hasValidHivePrecision(amountHive)
    ) {
      return NextResponse.json(
        { error: `txSignature, solanaAddress, and a positive amountHive with up to ${HIVE_DECIMALS} decimals are required.` },
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

    const existingStake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: staker.stakerId });
    const projectedActiveStake = (existingStake?.activeAmount || 0) + amountHiveNumber;
    if (projectedActiveStake < MIN_ACTIVE_STAKE_HIVE) {
      return NextResponse.json(
        { error: `Minimum active stake is ${MIN_ACTIVE_STAKE_HIVE.toLocaleString()} HIVE.` },
        { status: 400 }
      );
    }

    const treasuryWallet = process.env.HIVE_TREASURY_WALLET || DEFAULT_HIVE_TREASURY_WALLET;

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
        amount: amountHiveNumber,
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
      amountHive,
      { maxAgeMinutes: MAX_STAKE_TX_AGE_MINUTES }
    );

    if (!verification.verified) {
      await db.collection(COLLECTIONS.STAKE_EVENTS).deleteOne({ txSignature, status: 'pending' });
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
            isStaked: activeAmount >= MIN_ACTIVE_STAKE_HIVE,
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
        pendingUnstakes: visiblePendingUnstakes(stakeResult),
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
