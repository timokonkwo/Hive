import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb, COLLECTIONS } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const privateHeaders = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' };
const reply = (body: unknown, status = 200, headers = {}) => NextResponse.json(body, { status, headers: { ...privateHeaders, ...headers } });
/** Recovery replaces only the API key. The offline recovery code and owner PIN remain unchanged. */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`recover-code:${getClientIp(req)}`, { maxRequests: 5, windowSeconds: 3600 });
  if (!limit.allowed) return reply({ error: `Too many attempts. Try again in ${limit.resetInSeconds} seconds.` }, 429, { 'Retry-After': String(limit.resetInSeconds) });
  let body;
  try { body = await req.json(); } catch { return reply({ error: 'Enter an agent name and recovery code.' }, 400); }
  if (!body || body.method !== 'recovery_code' || typeof body.agentName !== 'string' || body.agentName.trim().length < 2 || body.agentName.trim().length > 100 || typeof body.recoveryCode !== 'string' || !/^[a-f0-9]{32}$/.test(body.recoveryCode.trim())) {
    return reply({ error: 'Enter an agent name and the 32-character recovery code.' }, 400);
  }
  try {
    const db = await getDb();
    const name = body.agentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const recoveryCodeHash = createHash('sha256').update(body.recoveryCode.trim()).digest('hex');
    // Proof is part of the lookup; reject ambiguous legacy records instead of choosing one.
    const matches = await db.collection(COLLECTIONS.AGENTS).find({ name: { $regex: new RegExp(`^${name}$`, 'i') }, recoveryCodeHash, status: { $ne: 'pending' } }).limit(2).toArray();
    if (matches.length !== 1) return reply({ error: 'The agent name and recovery code do not match.' }, 403);
    const agent = matches[0];
    const apiKey = generateApiKey();
    const result = await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: agent._id, apiKeyHash: agent.apiKeyHash ?? null, recoveryCodeHash, name: agent.name, status: { $ne: 'pending' } },
      { $set: { apiKeyHash: hashApiKey(apiKey), updatedAt: new Date() } }
    );
    if (result.matchedCount !== 1) return reply({ error: 'Agent access changed during this request. Check your access before trying again.' }, 409);
    try {
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({ type: 'AgentKeyRecovered', agentId: agent._id.toString(), actorName: agent.name, metadata: { method: 'recovery_code' }, createdAt: new Date() });
    } catch { logger.error('[HIVE] Recovery activity could not be recorded.'); }
    return reply({ success: true, agent_id: agent._id.toString(), agent_name: agent.name, api_key: apiKey, method: 'recovery_code' });
  } catch {
    // Database errors may contain operation payloads. Never log credential material.
    logger.error('[HIVE] Key recovery could not be confirmed.');
    return reply({ error: 'Recovery could not be confirmed. The previous key may have changed.' }, 500);
  }
}
