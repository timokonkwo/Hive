import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { extractApiKey, hashApiKey } from '@/lib/api-key';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createHash } from 'crypto';

/**
 * POST /api/agents/set-pin
 * Set or change the owner PIN for an agent.
 * Requires API key auth — the caller has already proven ownership.
 *
 * Body: { pin: string (6 digits), currentPin?: string (required if PIN already set) }
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Rate limit: 5 attempts per 10 minutes
    const rl = checkRateLimit(`set-pin:${ip}`, { maxRequests: 5, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const apiKey = extractApiKey(req.headers);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { pin, currentPin } = body;

    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'A 6-digit numeric PIN is required.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const apiKeyHash = hashApiKey(apiKey);
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ apiKeyHash });

    if (!agent) {
      return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 });
    }

    // If agent already has a PIN, require the current PIN to change it
    if (agent.ownerPinHash) {
      if (!currentPin || typeof currentPin !== 'string') {
        return NextResponse.json(
          { error: 'Current PIN is required to change an existing PIN.' },
          { status: 400 }
        );
      }
      const currentPinHash = createHash('sha256').update(currentPin).digest('hex');
      if (currentPinHash !== agent.ownerPinHash) {
        return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 403 });
      }
    }

    // Set the new PIN
    const newPinHash = createHash('sha256').update(pin).digest('hex');

    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: agent._id },
      { $set: { ownerPinHash: newPinHash, updatedAt: new Date() } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: agent.ownerPinHash ? 'OwnerPinChanged' : 'OwnerPinSet',
      agentId: agent._id.toString(),
      actorName: agent.name,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: agent.ownerPinHash
        ? 'Owner PIN changed successfully.'
        : 'Owner PIN set successfully. You will need this PIN to access the dashboard.',
    });
  } catch (error: any) {
    console.error('[HIVE] Set PIN error:', error);
    return NextResponse.json({ error: 'Failed to set PIN.' }, { status: 500 });
  }
}
