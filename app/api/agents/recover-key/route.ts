import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { ObjectId } from 'mongodb';

/**
 * POST /api/agents/recover-key
 * Recover (regenerate) an agent's API key using agent name as the identifier.
 *
 * Methods:
 *   1. "recovery_code" — Use the recovery code given at registration
 *   2. "wallet" — Connect a wallet already linked to the agent
 *
 * Body: { method, agentName, recoveryCode?, walletAddress? }
 *
 * NOTE: This only regenerates the API key. Owner PIN is untouched and cannot be recovered.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { method, agentName } = body;

    if (!method) {
      return NextResponse.json({ error: 'method is required.' }, { status: 400 });
    }

    if (!agentName || typeof agentName !== 'string' || agentName.trim().length < 2) {
      return NextResponse.json({ error: 'agentName is required (at least 2 characters).' }, { status: 400 });
    }

    if (!['recovery_code', 'wallet'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Use "recovery_code" or "wallet".' },
        { status: 400 }
      );
    }

    // Find agent by name (case-insensitive, exact match)
    const db = await getDb();
    const escapedName = agentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      status: { $ne: 'pending' },
    });

    if (!agent) {
      return NextResponse.json({ error: 'No active agent found with that name.' }, { status: 404 });
    }

    const agentId = agent._id.toString();

    // ── Method 1: Recovery Code ──
    if (method === 'recovery_code') {
      const rl = checkRateLimit(`recover-code:${ip}`, { maxRequests: 5, windowSeconds: 3600 });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${rl.resetInSeconds}s.` },
          { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
        );
      }

      const { recoveryCode } = body;
      if (!recoveryCode || typeof recoveryCode !== 'string') {
        return NextResponse.json({ error: 'recoveryCode is required.' }, { status: 400 });
      }

      if (!agent.recoveryCodeHash) {
        return NextResponse.json(
          { error: 'No recovery code set for this agent.' },
          { status: 400 }
        );
      }

      const { createHash } = await import('crypto');
      const providedHash = createHash('sha256').update(recoveryCode).digest('hex');
      if (providedHash !== agent.recoveryCodeHash) {
        return NextResponse.json({ error: 'Invalid recovery code.' }, { status: 403 });
      }

      return await regenerateKey(db, agent, agentId, 'recovery_code');
    }

    // ── Method 2: Wallet-based recovery ──
    if (method === 'wallet') {
      const rl = checkRateLimit(`recover-wallet:${ip}`, { maxRequests: 5, windowSeconds: 3600 });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${rl.resetInSeconds}s.` },
          { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
        );
      }

      const { walletAddress } = body;
      if (!walletAddress || typeof walletAddress !== 'string') {
        return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 });
      }

      const normalizedWallet = walletAddress.toLowerCase();
      const matchesEvm = agent.walletAddress && agent.walletAddress.toLowerCase() === normalizedWallet;
      const matchesSolana = agent.solanaAddress && agent.solanaAddress === walletAddress;

      if (!matchesEvm && !matchesSolana) {
        return NextResponse.json(
          { error: 'Wallet does not match any wallet linked to this agent.' },
          { status: 403 }
        );
      }

      return await regenerateKey(db, agent, agentId, 'wallet');
    }

    return NextResponse.json({ error: 'Invalid method.' }, { status: 400 });
  } catch (error: any) {
    console.error('[HIVE] Key recovery error:', error);
    return NextResponse.json({ error: 'Recovery failed.' }, { status: 500 });
  }
}

/**
 * Helper: generate a new API key, update the agent, log the event.
 * NOTE: This does NOT touch the owner PIN. PINs are set by humans and cannot be recovered.
 */
async function regenerateKey(db: any, agent: any, agentId: string, method: string) {
  const newRawApiKey = generateApiKey();
  const newApiKeyHash = hashApiKey(newRawApiKey);

  await db.collection(COLLECTIONS.AGENTS).updateOne(
    { _id: new ObjectId(agentId) },
    { $set: { apiKeyHash: newApiKeyHash, updatedAt: new Date() } }
  );

  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'AgentKeyRecovered',
    agentId,
    actorName: agent.name,
    metadata: { method },
    createdAt: new Date(),
  });

  return NextResponse.json({
    api_key: newRawApiKey,
    agent_name: agent.name,
    method,
    message: `API key regenerated for "${agent.name}". Save it now — it will not be shown again. Your owner PIN is unchanged.`,
  });
}
