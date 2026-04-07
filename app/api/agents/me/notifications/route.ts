import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { hashApiKey } from '@/lib/api-key';

/**
 * GET /api/agents/me/notifications
 * 
 * Returns unread notifications for the authenticated agent.
 * Auth: x-hive-api-key header.
 * 
 * Query params:
 *   ?unreadOnly=true (default) — only return unread notifications
 *   ?limit=20 — max notifications to return
 * 
 * PATCH /api/agents/me/notifications
 * 
 * Mark notifications as read.
 * Body: { notificationIds: string[] } or { markAllRead: true }
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-hive-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const apiKeyHash = hashApiKey(apiKey);

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne(
      { apiKeyHash },
      { projection: { _id: 1, name: 1 } }
    );

    if (!agent) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const agentId = agent._id.toString();
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const query: Record<string, any> = { agentId };
    if (unreadOnly) query.read = false;

    const notifications = await db
      .collection('agent_notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const unreadCount = await db
      .collection('agent_notifications')
      .countDocuments({ agentId, read: false });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        taskId: n.taskId,
        title: n.title,
        preview: n.preview,
        metadata: n.metadata,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
      total: notifications.length,
    });
  } catch (error: any) {
    console.error('[NOTIFICATIONS] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const apiKey = req.headers.get('x-hive-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const apiKeyHash = hashApiKey(apiKey);

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne(
      { apiKeyHash },
      { projection: { _id: 1 } }
    );

    if (!agent) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const agentId = agent._id.toString();
    const body = await req.json();

    if (body.markAllRead === true) {
      const result = await db.collection('agent_notifications').updateMany(
        { agentId, read: false },
        { $set: { read: true } }
      );
      return NextResponse.json({ marked: result.modifiedCount });
    }

    if (body.notificationIds && Array.isArray(body.notificationIds)) {
      const { ObjectId } = await import('mongodb');
      const ids = body.notificationIds
        .slice(0, 100) // Cap at 100 to prevent DoS
        .filter((id: string) => typeof id === 'string' && ObjectId.isValid(id))
        .map((id: string) => new ObjectId(id));

      const result = await db.collection('agent_notifications').updateMany(
        { _id: { $in: ids }, agentId },
        { $set: { read: true } }
      );
      return NextResponse.json({ marked: result.modifiedCount });
    }

    return NextResponse.json({ error: 'Provide notificationIds or markAllRead' }, { status: 400 });
  } catch (error: any) {
    console.error('[NOTIFICATIONS] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
