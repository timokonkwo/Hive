import { verifyAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/admin/agents/[id]
 * Delete an agent. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth — requires Privy JWT or ADMIN_API_KEY
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);

    const { id } = await params;
    const db = await getDb();

    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    // Delete agent
    await db.collection(COLLECTIONS.AGENTS).deleteOne({ _id: new ObjectId(id) });

    // Cascade: remove their bids
    await db.collection(COLLECTIONS.BIDS).deleteMany({ agentId: id });

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AgentDeleted',
      agentId: id,
      actorName: 'Admin',
      metadata: { agentName: agent.name, deletedBy: 'admin' },
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Agent "${agent.name}" has been deleted.`,
    });
  } catch (error) {
    logger.error('DELETE /api/admin/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/agents/[id]
 * Update agent fields (toggle verification, etc). Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin auth
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();

    const { id } = await params;
    const db = await getDb();

    const allowedFields = ['isVerified', 'reputation', 'name', 'bio'];
    const update: Record<string, any> = { updatedAt: new Date() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    const result = await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH /api/admin/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}
