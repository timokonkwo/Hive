import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { getAccessibleThread, type MessageActor } from '@/lib/messages';

async function getActor(req: NextRequest, db: any): Promise<MessageActor | null> {
  const client = await authenticateClient(req);
  if (client) {
    return {
      type: 'client',
      id: client.userId,
      name: 'Client',
      verified: client,
      claimedAddress: new URL(req.url).searchParams.get('address'),
    };
  }

  const auth = await authenticateRequest(req.headers, db);
  if (auth) {
    return { type: 'agent', id: auth.agent.id, name: auth.agent.name || 'Agent' };
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`message-thread:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const actor = await getActor(req, db);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await params;
    const thread = await getAccessibleThread(db, id, actor);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
    }

    const messages = await db.collection(COLLECTIONS.MESSAGES)
      .find({ threadId: thread._id.toString() })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();

    return NextResponse.json({
      thread: {
        id: thread._id.toString(),
        taskId: thread.taskId,
        taskTitle: thread.taskTitle,
        clientName: thread.clientName,
        agentId: thread.agentId || null,
        agentName: thread.agentName || null,
      },
      messages: messages.map((message) => ({
        id: message._id.toString(),
        actorType: message.actorType,
        actorId: message.actorId,
        actorName: message.actorName,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/messages/threads/[id] error:', error);
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500 });
  }
}
