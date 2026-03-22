import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { hashApiKey, extractApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createHash } from 'crypto';

/**
 * POST /api/agents/verify-pin
 * Verifies that the caller has both the API key AND the owner PIN.
 * This is required for dashboard access — agents use the API key for
 * operational API calls but the PIN gates owner-only management surfaces.
 *
 * Body: { pin: string }
 * Headers: x-hive-api-key
 *
 * Returns: { verified: true, agent: { id, name, ... } } or 403
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Strict rate limit: 5 attempts per 10 minutes per IP
    const rl = checkRateLimit(`verify-pin:${ip}`, { maxRequests: 5, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    // Require API key in header
    const apiKey = extractApiKey(req.headers);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'A 6-digit owner PIN is required.' },
        { status: 400 }
      );
    }

    // Authenticate via API key
    const db = await getDb();
    const apiKeyHash = hashApiKey(apiKey);
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ apiKeyHash });

    if (!agent) {
      return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 });
    }

    // Verify PIN
    if (!agent.ownerPinHash) {
      // Agent was registered before PIN system — allow access with API key only
      // but warn that they should update
      return NextResponse.json({
        verified: true,
        legacy: true,
        agent: {
          id: agent._id.toString(),
          name: agent.name,
          bio: agent.bio,
          capabilities: agent.capabilities || [],
          reputation: agent.reputation || 0,
          avgSatisfaction: agent.avgSatisfaction || 0,
          reviewCount: agent.reviewCount || 0,
          isVerified: agent.isVerified || false,
          walletAddress: agent.walletAddress || null,
          solanaAddress: agent.solanaAddress || null,
          website: agent.website || null,
          createdAt: agent.createdAt,
        },
        message: 'This agent was registered before the PIN system. Dashboard access granted with API key only. Re-register or contact support to set a PIN.',
      });
    }

    const providedPinHash = createHash('sha256').update(pin).digest('hex');
    if (providedPinHash !== agent.ownerPinHash) {
      return NextResponse.json({ error: 'Invalid owner PIN.' }, { status: 403 });
    }

    return NextResponse.json({
      verified: true,
      agent: {
        id: agent._id.toString(),
        name: agent.name,
        bio: agent.bio,
        capabilities: agent.capabilities || [],
        reputation: agent.reputation || 0,
        avgSatisfaction: agent.avgSatisfaction || 0,
        reviewCount: agent.reviewCount || 0,
        isVerified: agent.isVerified || false,
        walletAddress: agent.walletAddress || null,
        solanaAddress: agent.solanaAddress || null,
        website: agent.website || null,
        createdAt: agent.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[HIVE] Verify PIN error:', error);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
