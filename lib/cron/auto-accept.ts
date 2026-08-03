/**
 * Auto-Accept Stale Bids
 * 
 * If a task has been Open long enough and has at least one pending bid,
 * accept the bid from the agent with the highest reputation.
 * Keeps the pipeline flowing when clients are unresponsive.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

const SCHEDULED_TASK_SOURCE = 'hive-scheduled-marketplace';

function getIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const USER_STALE_THRESHOLD_MS = getIntEnv('AUTO_ACCEPT_USER_STALE_HOURS', 72, 24, 168) * 60 * 60 * 1000;
const SYSTEM_STALE_THRESHOLD_MS = getIntEnv('AUTO_ACCEPT_SYSTEM_STALE_HOURS', 24, 1, 72) * 60 * 60 * 1000;

function isSystemGeneratedTask(task: unknown): boolean {
  if (!task || typeof task !== 'object') return false;
  const doc = task as Record<string, unknown>;
  return doc.systemGenerated === true ||
    doc.creationSurface === 'scheduled-seed' ||
    doc.activitySource === SCHEDULED_TASK_SOURCE ||
    (typeof doc.clientAddress === 'string' && doc.clientAddress.startsWith('did:privy:cl_'));
}

export interface AutoAcceptResult {
  tasksProcessed: number;
  bidsAccepted: number;
  errors: string[];
}

export async function autoAcceptStaleBids(): Promise<AutoAcceptResult> {
  const db = await getDb();
  const result: AutoAcceptResult = { tasksProcessed: 0, bidsAccepted: 0, errors: [] };

  const userStaleThreshold = new Date(Date.now() - USER_STALE_THRESHOLD_MS);
  const systemStaleThreshold = new Date(Date.now() - SYSTEM_STALE_THRESHOLD_MS);
  const maxTasksPerRun = getIntEnv('AUTO_ACCEPT_TASKS_PER_RUN', 5, 1, 20);

  // Find open tasks that have proposals and are stale enough for their source.
  const staleTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({
      status: 'Open',
      proposalsCount: { $gt: 0 },
      $or: [
        { createdAt: { $lt: userStaleThreshold } },
        {
          $and: [
            { createdAt: { $lt: systemStaleThreshold } },
            {
              $or: [
                { systemGenerated: true },
                { creationSurface: 'scheduled-seed' },
                { activitySource: SCHEDULED_TASK_SOURCE },
                { clientAddress: { $regex: /^did:privy:cl_/ } },
              ],
            },
          ],
        },
      ],
    })
    .limit(maxTasksPerRun)
    .toArray();

  console.log(`[AUTO-ACCEPT] Found ${staleTasks.length} stale task(s) with bids`);

  for (const task of staleTasks) {
    const taskId = task._id.toString();
    result.tasksProcessed++;

    try {
      // Get all pending bids for this task
      const bids = await db
        .collection(COLLECTIONS.BIDS)
        .find({ taskId, status: 'Pending' })
        .toArray();

      if (bids.length === 0) {
        // All bids have been rejected or withdrawn — skip
        continue;
      }

      // Look up agent reputation for each bid
      const bidsWithRep: Array<{ bid: any; reputation: number }> = [];
      for (const bid of bids) {
        let reputation = 0;
        if (bid.agentId && ObjectId.isValid(bid.agentId)) {
          try {
            const agent = await db
              .collection(COLLECTIONS.AGENTS)
              .findOne({ _id: new ObjectId(bid.agentId) });
            reputation = agent?.reputation || 0;
          } catch {
            // Invalid agentId — use 0
          }
        }
        bidsWithRep.push({ bid, reputation });
      }

      // Sort by reputation descending — best agent first
      bidsWithRep.sort((a, b) => b.reputation - a.reputation);
      const bestBid = bidsWithRep[0].bid;

      // Accept the best bid
      const now = new Date();
      await db.collection(COLLECTIONS.BIDS).updateOne(
        { _id: bestBid._id },
        { $set: { status: 'accepted', updatedAt: now } }
      );

      // Reject other pending bids
      await db.collection(COLLECTIONS.BIDS).updateMany(
        { taskId, _id: { $ne: bestBid._id }, status: 'Pending' },
        { $set: { status: 'rejected', updatedAt: now } }
      );

      // Update task status
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'In Progress',
            assignedAgent: bestBid.agentId,
            assignedAgentId: bestBid.agentId,
            assignedAgentName: bestBid.agentName || null,
            updatedAt: now,
          },
        }
      );

      // Log activity — attributed to the task's client
      const systemGenerated = isSystemGeneratedTask(task);
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'ProposalAccepted',
        taskId: task._id,
        actorName: task.clientName || 'Client',
        metadata: {
          taskTitle: task.title,
          agentName: bestBid.agentName,
          agentId: bestBid.agentId,
          bidAmount: bestBid.amount,
          autoAccepted: true,
          systemGenerated,
          source: systemGenerated ? SCHEDULED_TASK_SOURCE : 'client-stale-bid',
        },
        createdAt: now,
      });

      result.bidsAccepted++;
      console.log(
        `[AUTO-ACCEPT] Accepted ${bestBid.agentName}'s bid on "${task.title}" (rep: ${bidsWithRep[0].reputation})`
      );
    } catch (error: any) {
      result.errors.push(`Task ${taskId}: ${error.message}`);
      console.error(`[AUTO-ACCEPT] Error processing ${taskId}:`, error.message);
    }
  }

  return result;
}
