import { ObjectId, type Db } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';
import type { VerifiedClient } from '@/lib/client-auth';
import { verifiedClientOwnsResource } from '@/lib/client-ownership';

export type MessageActor =
  | { type: 'client'; id: string; name: string; verified: VerifiedClient; claimedAddress?: string | null }
  | { type: 'agent'; id: string; name: string };

export async function actorCanAccessTask(db: Db, task: any, actor: MessageActor): Promise<boolean> {
  if (actor.type === 'client') {
    return verifiedClientOwnsResource(actor.verified, task, actor.claimedAddress || undefined);
  }

  const bid = await db.collection(COLLECTIONS.BIDS).findOne({
    taskId: task._id.toString(),
    agentId: actor.id,
  });
  return !!bid;
}

export async function getOrCreateThread(db: Db, task: any, actor: MessageActor): Promise<any> {
  const taskId = task._id.toString();
  let agentId: string | null = actor.type === 'agent' ? actor.id : task.assignedAgentId || null;
  let agentName: string | null = actor.type === 'agent' ? actor.name : task.assignedAgentName || null;

  if (!agentId) {
    const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: { $in: ['accepted', 'WorkSubmitted', 'Completed'] },
    });
    agentId = acceptedBid?.agentId || null;
    agentName = acceptedBid?.agentName || null;
  }

  const query = {
    taskId,
    ...(agentId ? { agentId } : {}),
  };

  const now = new Date();
  const result = await db.collection(COLLECTIONS.MESSAGE_THREADS).findOneAndUpdate(
    query,
    {
      $setOnInsert: {
        taskId,
        taskTitle: task.title,
        clientId: task.clientPrivyUserId || task.clientAddress,
        clientName: task.clientName || 'Client',
        agentId,
        agentName,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Failed to create message thread');
  }

  return result;
}

export async function getAccessibleThread(db: Db, threadId: string, actor: MessageActor) {
  if (!ObjectId.isValid(threadId)) return null;
  const thread = await db.collection(COLLECTIONS.MESSAGE_THREADS).findOne({ _id: new ObjectId(threadId) });
  if (!thread) return null;

  if (actor.type === 'agent') {
    return thread.agentId === actor.id ? thread : null;
  }

  const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(thread.taskId) });
  if (!task) return null;
  return verifiedClientOwnsResource(actor.verified, task, actor.claimedAddress || undefined) ? thread : null;
}
