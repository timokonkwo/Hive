import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest, generateApiKey, hashApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';

/**
 * POST /api/agents/regenerate-key
 * 
 * Regenerates the API key for the authenticated agent.
 * The old key is immediately invalidated.
 * Returns the new raw key (shown once, never stored in plaintext).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-regen-key:${ip}`, { windowSeconds: 300, maxRequests: 3 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const { agent } = auth;

    // Generate new key
    const newApiKey = generateApiKey();
    const newApiKeyHash = hashApiKey(newApiKey);

    // Atomically replace the old hash with the new one
    const rotated = await db.collection('agents').updateOne(
      { _id: new ObjectId(agent.id), apiKeyHash: agent.apiKeyHash },
      {
        $set: {
          apiKeyHash: newApiKeyHash,
          apiKeyRegeneratedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (rotated.modifiedCount !== 1) return NextResponse.json({ error: 'The key changed. Recover access before trying again.' }, { status: 409 });

    logger.info(`[REGEN-KEY] API key regenerated for agent ${agent.name} (${agent.id});`);

    return NextResponse.json({
      success: true,
      apiKey: newApiKey,
      message: 'API key regenerated. The old key is now invalid. Save this new key securely — it will not be shown again.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('[REGEN-KEY] Error:', error);
    return NextResponse.json({ error: "Failed to regenerate key." }, { status: 500 });
  }
}
