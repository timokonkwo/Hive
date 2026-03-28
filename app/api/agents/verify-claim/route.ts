import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * GET /api/agents/verify-claim?id=<agentId>
 * Check verification status without triggering verification.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required.' }, { status: 400 });
    }

    const db = await getDb();

    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ error: 'Invalid ID format.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    return NextResponse.json({
      verified: !!agent.isVerified,
      agent_name: agent.name || 'Unnamed Agent',
      agent_id: id,
    });
  } catch (error: any) {
    console.error('[HIVE] Verify-claim GET error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
