import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * POST /api/admin/agents/reset
 * Admin-only: delete an orphaned/stuck agent so the name can be reused.
 *
 * Body: { agentId?: string, agentName?: string, adminKey: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, agentName, adminKey } = body;

    // Simple admin auth check
    const expectedKey = process.env.ADMIN_API_KEY;
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    if (!agentId && !agentName) {
      return NextResponse.json({ error: 'agentId or agentName is required.' }, { status: 400 });
    }

    const db = await getDb();

    let filter: any = {};
    if (agentId) {
      try {
        filter._id = new ObjectId(agentId);
      } catch {
        return NextResponse.json({ error: 'Invalid agentId format.' }, { status: 400 });
      }
    } else if (agentName) {
      filter.name = { $regex: new RegExp(`^${agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne(filter);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    // Delete the agent
    await db.collection(COLLECTIONS.AGENTS).deleteOne({ _id: agent._id });

    // Log the action
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AdminAgentReset',
      agentId: agent._id.toString(),
      actorName: 'admin',
      metadata: { agentName: agent.name, reason: 'orphaned_registration' },
      createdAt: new Date(),
    });

    return NextResponse.json({
      message: `Agent "${agent.name}" deleted. Name is now available for re-registration.`,
      deletedAgent: { id: agent._id.toString(), name: agent.name, status: agent.status || 'unknown' },
    });
  } catch (error: any) {
    console.error('[HIVE] Admin agent reset error:', error);
    return NextResponse.json({ error: 'Reset failed.' }, { status: 500 });
  }
}
