import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/agents/update-fee-wallet
 *
 * Allows an authenticated agent owner to set their Solana wallet
 * for receiving 50% of trading fees on their agent's token.
 *
 * Auth: x-hive-api-key (agent's API key)
 * Rate limited: 5 requests per 10 minutes per IP
 */
export async function POST(req: NextRequest) {
  // Rate limit to prevent brute-force API key attempts
  const ip = getClientIp(req);
  const rl = checkRateLimit(`fee-wallet:${ip}`, { maxRequests: 5, windowSeconds: 600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }
  const apiKey = req.headers.get('x-hive-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required (x-hive-api-key header).' }, { status: 401 });
  }

  // Hash the API key to look up the agent
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  const db = await getDb();

  const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ apiKeyHash });
  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 });
  }

  // Verify agent is tokenized
  if (!agent.isTokenized || agent.tokenLaunchStatus !== 'launched') {
    return NextResponse.json(
      { error: 'Agent must have a launched token to set a fee wallet.' },
      { status: 400 }
    );
  }

  // Check if already set
  if (agent.creatorFeeWallet) {
    return NextResponse.json(
      { error: 'Fee wallet already set. This can only be done once.', currentWallet: agent.creatorFeeWallet },
      { status: 409 }
    );
  }

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { walletAddress } = body;
  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 });
  }

  // Validate Solana address
  const trimmedWallet = walletAddress.trim();
  try {
    const pubkey = new PublicKey(trimmedWallet);
    if (!PublicKey.isOnCurve(pubkey)) {
      return NextResponse.json({ error: 'Wallet address is not a valid on-curve Solana address.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid Solana wallet address format.' }, { status: 400 });
  }

  // Save the wallet — the on-chain fee share update will be done
  // via a background process that calls the Bags SDK to update
  // the fee share config from 100% Hive to 50/50.
  //
  // For now, we save the wallet and mark it for processing.
  // The actual on-chain update requires:
  //   1. sdk.feeShareAdmin.getUpdateConfigTransactions()
  //   2. Sign with HIVE_AGENT_LAUNCH_KEYPAIR
  //   3. Broadcast and confirm
  //
  // This can be triggered by the admin or a cron job.

  await db.collection(COLLECTIONS.AGENTS).updateOne(
    { _id: agent._id },
    {
      $set: {
        creatorFeeWallet: trimmedWallet,
        feeSharePending: true, // Flag for background processing
        updatedAt: new Date(),
      },
    }
  );

  // Log activity
  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'AgentFeeWalletSet',
    agentId: agent._id.toString(),
    actorName: agent.name,
    metadata: {
      walletAddress: trimmedWallet,
      tokenSymbol: agent.tokenSymbol,
      mintAddress: agent.tokenMintAddress,
    },
    createdAt: new Date(),
  });

  return NextResponse.json({
    message: `Fee wallet set for ${agent.name}. On-chain fee share update will be processed shortly.`,
    walletAddress: trimmedWallet,
    tokenSymbol: agent.tokenSymbol,
    note: 'Once processed, 50% of trading fees on your agent token will be sent to this wallet.',
  });
}
