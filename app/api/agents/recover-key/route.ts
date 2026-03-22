import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';

/**
 * POST /api/agents/recover-key
 * Recover (regenerate) an agent's API key.
 *
 * Methods:
 *   1. "recovery_code" — Use the recovery code given at registration
 *   2. "wallet" — Use a wallet already linked to the agent (signature verification)
 *   3. "agent_id" — Last resort: agent ID + name (heavily rate-limited)
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { method, agentId } = body;

    if (!method || !agentId) {
      return NextResponse.json(
        { error: 'method and agentId are required.' },
        { status: 400 }
      );
    }

    // Find agent
    const db = await getDb();
    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(agentId) });
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID format.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    // ── Method 1: Recovery Code ──
    if (method === 'recovery_code') {
      const rl = checkRateLimit(`recover-code:${ip}`, { maxRequests: 5, windowSeconds: 3600 }); // 5/hour
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
          { error: 'No recovery code set for this agent. This agent was registered before recovery codes were available.' },
          { status: 400 }
        );
      }

      const providedHash = createHash('sha256').update(recoveryCode).digest('hex');
      if (providedHash !== agent.recoveryCodeHash) {
        return NextResponse.json({ error: 'Invalid recovery code.' }, { status: 403 });
      }

      // Valid — regenerate API key
      return await regenerateKey(db, agent, agentId, 'recovery_code');
    }

    // ── Method 2: Wallet-based recovery ──
    if (method === 'wallet') {
      const rl = checkRateLimit(`recover-wallet:${ip}`, { maxRequests: 5, windowSeconds: 3600 }); // 5/hour
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

      // Check if wallet matches agent's linked wallet (EVM or Solana)
      const normalizedWallet = walletAddress.toLowerCase();
      const matchesEvm = agent.walletAddress && agent.walletAddress.toLowerCase() === normalizedWallet;
      const matchesSolana = agent.solanaAddress && agent.solanaAddress === walletAddress; // Solana is case-sensitive

      if (!matchesEvm && !matchesSolana) {
        return NextResponse.json(
          { error: 'Wallet address does not match any wallet linked to this agent.' },
          { status: 403 }
        );
      }

      // Valid — regenerate API key
      return await regenerateKey(db, agent, agentId, 'wallet');
    }

    // ── Method 3: Agent ID + Name (last resort) ──
    if (method === 'agent_id') {
      const rl = checkRateLimit(`recover-id:${ip}`, { maxRequests: 1, windowSeconds: 86400 }); // 1/24h
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `This recovery method is limited to once per 24 hours. Try again in ${rl.resetInSeconds}s.` },
          { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
        );
      }

      const { agentName } = body;
      if (!agentName || typeof agentName !== 'string') {
        return NextResponse.json({ error: 'agentName is required for this method.' }, { status: 400 });
      }

      // Case-insensitive name match
      if (agent.name.toLowerCase() !== agentName.toLowerCase()) {
        return NextResponse.json({ error: 'Agent name does not match.' }, { status: 403 });
      }

      // Valid — regenerate API key
      return await regenerateKey(db, agent, agentId, 'agent_id');
    }

    return NextResponse.json(
      { error: 'Invalid method. Use "recovery_code", "wallet", or "agent_id".' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[HIVE] Key recovery error:', error);
    return NextResponse.json({ error: 'Recovery failed.' }, { status: 500 });
  }
}

/**
 * Helper: generate a new API key AND owner PIN, update the agent, log the event.
 */
async function regenerateKey(db: any, agent: any, agentId: string, method: string) {
  const newRawApiKey = generateApiKey();
  const newApiKeyHash = hashApiKey(newRawApiKey);

  // Also regenerate owner PIN
  const newOwnerPin = String(Math.floor(100000 + Math.random() * 900000));
  const newOwnerPinHash = createHash('sha256').update(newOwnerPin).digest('hex');

  // Replace the old key hash and PIN hash with new ones
  await db.collection(COLLECTIONS.AGENTS).updateOne(
    { _id: new ObjectId(agentId) },
    {
      $set: {
        apiKeyHash: newApiKeyHash,
        ownerPinHash: newOwnerPinHash,
        updatedAt: new Date(),
      },
    }
  );

  // Log recovery event
  await db.collection(COLLECTIONS.ACTIVITY).insertOne({
    type: 'AgentKeyRecovered',
    agentId,
    actorName: agent.name,
    metadata: { method },
    createdAt: new Date(),
  });

  return NextResponse.json({
    api_key: newRawApiKey, // Only shown once!
    owner_pin: newOwnerPin, // Only shown once!
    agent_id: agentId,
    agent_name: agent.name,
    method,
    message: `API key and owner PIN regenerated for "${agent.name}". Save BOTH immediately — they will not be shown again. Your old credentials are now invalid.`,
  });
}
