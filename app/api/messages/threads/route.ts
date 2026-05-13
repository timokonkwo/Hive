import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { actorCanAccessTask, getAccessibleThread, getOrCreateThread, type MessageActor } from '@/lib/messages';

async function getActor(req: NextRequest, db: any): Promise<MessageActor | null> {
  if (req.headers.get('x-hive-api-key')) {
    const auth = await authenticateRequest(req.headers, db);
    if (auth) {
      return { type: 'agent', id: auth.agent.id, name: auth.agent.name || 'Agent' };
    }
  }

  const client = await authenticateClient(req);
  if (client) {
    const { searchParams } = new URL(req.url);
    return {
      type: 'client',
      id: client.userId,
      name: 'Client',
      verified: client,
      claimedAddress: searchParams.get('address'),
    };
  }

  return null;
}

function mapThread(thread: any) {
  return {
    id: thread._id.toString(),
    taskId: thread.taskId,
    taskTitle: thread.taskTitle,
    clientName: thread.clientName,
    agentId: thread.agentId || null,
    agentName: thread.agentName || null,
    lastMessage: thread.lastMessage || null,
    lastMessageAt: thread.lastMessageAt || null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`message-threads:${ip}`, RATE_LIMITS.READ);
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

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const query: Record<string, any> = {};

    if (actor.type === 'agent') {
      query.agentId = actor.id;
      if (taskId) query.taskId = taskId;
    } else {
      const ownershipFilters: Record<string, any>[] = [
        { clientPrivyUserId: actor.verified.userId },
        { clientAddress: actor.verified.userId },
      ];
      if (actor.claimedAddress) {
        ownershipFilters.push(
          { clientPrivyUserId: { $exists: false }, clientAddress: actor.claimedAddress },
          { clientPrivyUserId: null, clientAddress: actor.claimedAddress }
        );
      }

      const ownedTasks = await db.collection(COLLECTIONS.TASKS)
        .find({ $or: ownershipFilters })
        .project({ _id: 1 })
        .toArray();
      const ownedTaskIds = ownedTasks.map((task: any) => task._id.toString());
      if (taskId) {
        if (!ownedTaskIds.includes(taskId)) {
          return NextResponse.json({ threads: [] });
        }
        query.taskId = taskId;
      } else {
        query.taskId = { $in: ownedTaskIds };
      }
    }

    const threads = await db.collection(COLLECTIONS.MESSAGE_THREADS)
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ threads: threads.map(mapThread) });
  } catch (error) {
    console.error('GET /api/messages/threads error:', error);
    return NextResponse.json({ error: 'Failed to load message threads.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`message-post:${ip}`, RATE_LIMITS.MANAGE_BID);
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

    const body = await req.json();
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    const threadId = typeof body.threadId === 'string' ? body.threadId : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Valid taskId is required.' }, { status: 400 });
    }
    if (threadId && !ObjectId.isValid(threadId)) {
      return NextResponse.json({ error: 'threadId must be valid when provided.' }, { status: 400 });
    }
    if (content.length < 1 || content.length > 5000) {
      return NextResponse.json({ error: 'content must be 1-5000 characters.' }, { status: 400 });
    }

    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const allowed = await actorCanAccessTask(db, task, actor);
    if (!allowed) {
      return NextResponse.json({ error: 'You can only message on tasks you own or have proposed on.' }, { status: 403 });
    }

    let thread = null;
    if (threadId) {
      thread = await getAccessibleThread(db, threadId, actor);
      if (!thread || thread.taskId !== taskId) {
        return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
      }
    } else {
      thread = await getOrCreateThread(db, task, actor);
    }

    const now = new Date();
    const message = {
      threadId: thread._id.toString(),
      taskId,
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      content,
      createdAt: now,
    };
    const result = await db.collection(COLLECTIONS.MESSAGES).insertOne(message);

    await db.collection(COLLECTIONS.MESSAGE_THREADS).updateOne(
      { _id: thread._id },
      {
        $set: {
          lastMessage: content.slice(0, 240),
          lastMessageAt: now,
          updatedAt: now,
        },
        $inc: { messageCount: 1 },
      }
    );

    return NextResponse.json({
      thread: mapThread({ ...thread, lastMessage: content.slice(0, 240), lastMessageAt: now, updatedAt: now }),
      message: { id: result.insertedId.toString(), ...message },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/messages/threads error:', error);
    return NextResponse.json({ error: 'Failed to post message.' }, { status: 500 });
  }
}
