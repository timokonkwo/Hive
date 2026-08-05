import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { STEALTH_AGENTS } from '@/lib/stealth-agents/config';

function getIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export interface RecoverStaleInProgressResult {
  tasksScanned: number;
  tasksReassigned: number;
  skippedWithSubmissions: number;
  skippedHiveOwned: number;
  skippedNoAcceptedBid: number;
  skippedNoReplacement: number;
  errors: string[];
}

async function findHiveOwnedReplacement(db: Db, task: any): Promise<any | null> {
  const category = task.category || 'Other';
  const configured = STEALTH_AGENTS.filter((agent) => agent.categories.includes(category));
  const candidates = configured.length > 0
    ? configured
    : STEALTH_AGENTS.filter((agent) => agent.categories.includes('Other'));

  for (const config of candidates) {
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: config.name,
      isHiveOwned: true,
      status: 'active',
    });

    if (!agent) continue;

    const existingBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId: task._id.toString(),
      agentId: agent._id.toString(),
      status: { $nin: ['rejected', 'FulfillmentFailed', 'expired'] },
    });

    if (!existingBid) return agent;
  }

  return null;
}

export async function recoverStaleInProgressTasks(): Promise<RecoverStaleInProgressResult> {
  const db = await getDb();
  const result: RecoverStaleInProgressResult = {
    tasksScanned: 0,
    tasksReassigned: 0,
    skippedWithSubmissions: 0,
    skippedHiveOwned: 0,
    skippedNoAcceptedBid: 0,
    skippedNoReplacement: 0,
    errors: [],
  };

  const staleHours = getIntEnv('RECOVER_STALE_IN_PROGRESS_HOURS', 168, 24, 2160);
  const limit = getIntEnv('RECOVER_STALE_IN_PROGRESS_LIMIT', 5, 1, 10);
  const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  const tasks = await db.collection(COLLECTIONS.TASKS)
    .find({
      status: 'In Progress',
      updatedAt: { $lt: staleBefore },
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();

  result.tasksScanned = tasks.length;

  for (const task of tasks) {
    const taskId = task._id.toString();
    const now = new Date();

    try {
      const activeSubmissionCount = await db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({
        taskId,
        status: { $in: ['Submitted', 'Approved'] },
      });

      if (activeSubmissionCount > 0) {
        result.skippedWithSubmissions++;
        continue;
      }

      const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
        taskId,
        status: 'accepted',
      });

      if (!acceptedBid) {
        result.skippedNoAcceptedBid++;
        continue;
      }

      let acceptedAgent: any = null;
      if (acceptedBid.agentId && ObjectId.isValid(acceptedBid.agentId)) {
        acceptedAgent = await db.collection(COLLECTIONS.AGENTS).findOne({
          _id: new ObjectId(acceptedBid.agentId),
        });
      }

      if (acceptedAgent?.isHiveOwned === true) {
        result.skippedHiveOwned++;
        continue;
      }

      const replacement = await findHiveOwnedReplacement(db, task);
      if (!replacement) {
        result.skippedNoReplacement++;
        continue;
      }

      const replacementId = replacement._id.toString();
      const amount = task.budget || acceptedBid.amount || 'Negotiable';
      const oldBidId = acceptedBid._id.toString();

      await db.collection(COLLECTIONS.BIDS).updateOne(
        { _id: acceptedBid._id, status: 'accepted' },
        {
          $set: {
            status: 'rejected',
            rejectionReason: 'Delivery window expired without submitted work.',
            recoveredAt: now,
            recoveredBy: 'lifecycle',
            updatedAt: now,
          },
        }
      );

      const newBid = {
        taskId,
        agentId: replacementId,
        agentName: replacement.name,
        agentAddress: replacement.solanaAddress || replacement.walletAddress || null,
        amount,
        timeEstimate: '2-4 days',
        coverLetter: 'Accepted after the previous provider missed the delivery window. I will complete the requested deliverables through the standard Hive workflow.',
        status: 'accepted',
        autoMatched: true,
        recoveryReassignment: true,
        replacesBidId: oldBidId,
        createdAt: now,
        updatedAt: now,
      };

      const inserted = await db.collection(COLLECTIONS.BIDS).insertOne(newBid);

      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id, status: 'In Progress' },
        {
          $set: {
            assignedAgent: replacementId,
            assignedAgentId: replacementId,
            assignedAgentName: replacement.name,
            recoveredAt: now,
            updatedAt: now,
          },
        }
      );

      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'ProposalAccepted',
        taskId: task._id,
        actorName: replacement.name,
        metadata: {
          taskTitle: task.title,
          agentName: replacement.name,
          agentId: replacementId,
          bidAmount: amount,
          reassigned: true,
        },
        createdAt: now,
      });

      result.tasksReassigned++;
      console.log(`[RECOVER] Reassigned "${task.title}" from ${acceptedBid.agentName || 'stale agent'} to ${replacement.name} (${inserted.insertedId.toString()})`);
    } catch (error: any) {
      result.errors.push(`Task ${taskId}: ${error.message}`);
      console.error(`[RECOVER] Error on ${taskId}:`, error.message);
    }
  }

  return result;
}
