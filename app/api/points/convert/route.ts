import { NextRequest, NextResponse } from 'next/server';
import { COLLECTIONS, getDb } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { convertPointsToHive, MIN_CONVERSION_THRESHOLD } from '@/lib/points';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { PublicKey } from '@solana/web3.js';
import { logger } from '@/lib/logger';

const MAX_POINTS_CONVERT_BODY_BYTES = 4 * 1024;
const MAX_POINTS_CONVERT = 1_000_000_000;

/**
 * POST /api/points/convert
 *
 * Converts user points to on-chain $HIVE tokens.
 * Request Body: { points: number, solanaAddress: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Strict rate limiting for conversion attempts
    const rl = checkRateLimit(`points-convert:${ip}`, { windowSeconds: 60, maxRequests: 5 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Authenticate: Privy token for clients, API Key for agents
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;

    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Provide a Privy token or x-hive-api-key.' },
        { status: 401 }
      );
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_POINTS_CONVERT_BODY_BYTES) {
      return NextResponse.json({ error: 'Conversion request body is too large.' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { points, solanaAddress } = body;

    if (!points || typeof points !== 'number' || !Number.isSafeInteger(points) || points <= 0 || points > MAX_POINTS_CONVERT) {
      return NextResponse.json(
        { error: 'Points must be a positive safe integer.' },
        { status: 400 }
      );
    }

    if (points < MIN_CONVERSION_THRESHOLD) {
      return NextResponse.json(
        { error: `Minimum conversion threshold is ${MIN_CONVERSION_THRESHOLD} points.` },
        { status: 400 }
      );
    }

    if (!solanaAddress || typeof solanaAddress !== 'string') {
      return NextResponse.json(
        { error: 'Solana recipient address is required.' },
        { status: 400 }
      );
    }

    // Validate Solana address format
    try {
      new PublicKey(solanaAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address format.' },
        { status: 400 }
      );
    }

    if (client) {
      const profile = await db.collection(COLLECTIONS.CLIENTS).findOne({ address: userId });
      if (!profile?.solanaAddressVerifiedAt || profile.solanaAddress !== solanaAddress) {
        return NextResponse.json(
          { error: 'Points can only be converted to your verified linked Solana wallet.' },
          { status: 403 }
        );
      }
    } else if (agentAuth) {
      if (!agentAuth.agent?.solanaAddressVerifiedAt || agentAuth.agent.solanaAddress !== solanaAddress) {
        return NextResponse.json(
          { error: 'Points can only be converted to the agent verified Solana wallet.' },
          { status: 403 }
        );
      }
    }

    const result = await convertPointsToHive(userId, points, solanaAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Conversion failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pointsConverted: points,
      hiveTokensTransferred: result.hiveAmount,
      txSignature: result.txSignature,
    });
  } catch (error: any) {
    logger.error('POST /api/points/convert error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process point conversion' },
      { status: 500 }
    );
  }
}
