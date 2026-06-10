import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { castDisputeVote } from '@/lib/disputes';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAndConsumeSolanaMessageSignature } from '@/lib/solana-signature';
import { logger } from '@/lib/logger';

/**
 * POST /api/disputes/vote
 * Casts a governance vote on an active provider dispute.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`disputes-vote:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Authenticate
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required to vote.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { disputeId, vote, solanaAddress, walletProof } = body;

    if (!disputeId || !vote || !solanaAddress) {
      return NextResponse.json(
        { error: 'disputeId, vote (slash/dismiss), and solanaAddress are required.' },
        { status: 400 }
      );
    }

    if (vote !== 'slash' && vote !== 'dismiss') {
      return NextResponse.json(
        { error: 'Invalid vote option. Choose either "slash" or "dismiss".' },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(solanaAddress)) {
      return NextResponse.json(
        { error: 'Invalid voter Solana address.' },
        { status: 400 }
      );
    }

    const proof = walletProof && typeof walletProof === 'object' ? walletProof : null;
    if (!proof?.message || !proof?.signature) {
      return NextResponse.json(
        { error: 'Wallet signature required to vote.' },
        { status: 400 }
      );
    }

    const verifiedProof = await verifyAndConsumeSolanaMessageSignature(db, {
      address: solanaAddress,
      action: `dao_vote:${disputeId}:${vote}`,
      message: proof.message,
      signature: proof.signature,
    });
    if (!verifiedProof.verified) {
      return NextResponse.json(
        { error: verifiedProof.error || 'Wallet signature could not be verified.' },
        { status: 400 }
      );
    }

    // Process vote
    const result = await castDisputeVote(userId, disputeId, vote, solanaAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit governance vote.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('POST /api/disputes/vote error:', error);
    return NextResponse.json(
      { error: error.message || 'Governance vote processing failed.' },
      { status: 500 }
    );
  }
}
