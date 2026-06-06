import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { getSessionBudget } from '@/lib/session-wallet';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/session
 * Retrieves the session budget status and ledger logs.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`session-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Auth
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    // Fetch budget metrics
    const budget = await getSessionBudget(userId);

    // Fetch ledger history logs
    const history = await db.collection(COLLECTIONS.SESSION_LEDGER)
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(30)
      .toArray();

    const mappedHistory = history.map(h => ({
      ...h,
      id: h._id.toString(),
      _id: undefined
    }));

    return NextResponse.json({ budget, history: mappedHistory });
  } catch (error: any) {
    logger.error('GET /api/session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
