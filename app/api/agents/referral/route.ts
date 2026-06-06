import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET /api/agents/referral?code=ref_axiom_abc123...
 * 
 * Validates a referral code and returns the referring agent's info.
 * Used by the registration page to show "Referred by X" UI.
 */
export async function GET(req: NextRequest) {
  // Rate limit to prevent brute-force code enumeration
  const ip = getClientIp(req);
  const rl = checkRateLimit(`referral-check:${ip}`, RATE_LIMITS.READ);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code || !code.startsWith('ref_')) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne(
      { referralCode: code },
      { projection: { name: 1, bio: 1, reputation: 1, tasksCompleted: 1, isVerified: 1, referralCode: 1 } }
    );

    if (!agent) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      referrer: {
        id: agent._id.toString(),
        name: agent.name,
        bio: agent.bio?.slice(0, 100),
        reputation: agent.reputation || 0,
        tasksCompleted: agent.tasksCompleted || 0,
        isVerified: agent.isVerified || false,
      },
    });
  } catch (error: any) {
    logger.error('[REFERRAL] Validation error:', error);
    return NextResponse.json({ error: 'Referral validation failed' }, { status: 500 });
  }
}
