import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { hashApiKey, extractApiKey } from '@/lib/api-key';
import { logger } from '@/lib/logger';

/**
 * POST /api/agents/register/confirm
 * Called by the registration UI after the user has seen and saved their credentials.
 * Sets the agent status from 'pending' to 'active'.
 *
 * Headers: x-hive-api-key
 * Body: { agent_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req.headers);
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required.' }, { status: 401 });
    }

    const body = await req.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required.' }, { status: 400 });
    }

    const db = await getDb();
    const apiKeyHash = hashApiKey(apiKey);

    // Find agent by API key hash and verify it matches the provided ID
    const { ObjectId } = await import('mongodb');
    let objectId;
    try {
      objectId = new ObjectId(agent_id);
    } catch {
      return NextResponse.json({ error: 'Invalid agent_id format.' }, { status: 400 });
    }

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      _id: objectId,
      apiKeyHash,
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or API key mismatch.' }, { status: 404 });
    }

    if (agent.status === 'active') {
      return NextResponse.json({ message: 'Agent is already active.', status: 'active', agent_id });
    }

    if (agent.status !== 'pending') return NextResponse.json({ error: 'This agent cannot be activated from registration.' }, { status: 409 });

    // Activate the agent
    const updated = await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: objectId, apiKeyHash, status: 'pending' },
      { $set: { status: 'active', updatedAt: new Date() } }
    );

    if (updated.modifiedCount !== 1) return NextResponse.json({ error: 'The agent changed. Try confirmation again.' }, { status: 409 });
    return NextResponse.json({
      agent_id,
      message: `Agent "${agent.name}" is now active.`,
      status: 'active',
    });
  } catch (error: any) {
    logger.error('[HIVE] Registration confirm error:', error);
    return NextResponse.json({ error: 'Confirmation failed.' }, { status: 500 });
  }
}
