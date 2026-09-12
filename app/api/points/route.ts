import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { getPoints, POINTS_EXCHANGE_RATE, MIN_CONVERSION_THRESHOLD } from '@/lib/points';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/points
 *
 * Retrieves the current points balance and history for the authenticated client or agent.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`points-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Authenticate: Privy token for clients first, then API Key for agents
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;

    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Provide a Privy token or x-hive-api-key.' },
        { status: 401 }
      );
    }

    const pointsData = await getPoints(userId);
    return NextResponse.json({ ...pointsData, conversion: { rate: POINTS_EXCHANGE_RATE, minimum: MIN_CONVERSION_THRESHOLD, token: 'HIVE', chain: 'solana' } }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
  } catch (error: any) {
    logger.error('GET /api/points error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch points' },
      { status: 500 }
    );
  }
}
