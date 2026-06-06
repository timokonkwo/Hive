import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { createDispute } from '@/lib/disputes';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/disputes
 * Retrieves a list of staker slashing disputes.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`disputes-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'All';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (status !== 'All') {
      query.status = status;
    }

    const [disputes, total] = await Promise.all([
      db.collection(COLLECTIONS.DISPUTES)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.DISPUTES).countDocuments(query),
    ]);

    const mapped = disputes.map((d) => ({
      ...d,
      id: d._id.toString(),
      _id: undefined
    }));

    return NextResponse.json({ disputes: mapped, total, page, limit });
  } catch (error: any) {
    logger.error('GET /api/disputes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disputes
 * Files a new dispute against an active tool provider node.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`disputes-post:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Authenticate: Privy user or API Key
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;

    if (!client && !agentAuth) {
      return NextResponse.json(
        { error: 'Authentication required to file disputes.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { providerAddress, toolId, reason, evidenceUri, stakedAmount } = body;

    if (!providerAddress || !toolId || !reason || !evidenceUri || typeof stakedAmount !== 'number') {
      return NextResponse.json(
        { error: 'providerAddress, toolId, reason, evidenceUri, and numeric stakedAmount are required.' },
        { status: 400 }
      );
    }

    // Call creation logic
    const result = await createDispute(providerAddress, toolId, reason, evidenceUri, stakedAmount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to register dispute.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, disputeId: result.disputeId }, { status: 201 });
  } catch (error: any) {
    logger.error('POST /api/disputes error:', error);
    return NextResponse.json(
      { error: error.message || 'Dispute filing execution failed.' },
      { status: 500 }
    );
  }
}
