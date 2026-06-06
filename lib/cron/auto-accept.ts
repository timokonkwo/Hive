/**
 * Auto-Accept Stale Bids
 * 
 * If a task has been Open for 72+ hours and has at least one pending bid,
 * accept the bid from the agent with the highest reputation.
 * Keeps the pipeline flowing when clients are unresponsive.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours

export interface AutoAcceptResult {
  tasksProcessed: number;
  bidsAccepted: number;
  errors: string[];
}

export async function autoAcceptStaleBids(): Promise<AutoAcceptResult> {
  const db = await getDb();
  const result: AutoAcceptResult = { tasksProcessed: 0, bidsAccepted: 0, errors: [] };

  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Find open tasks created more than 48 hours ago that have proposals
  const staleTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({
      status: 'Open',
      createdAt: { $lt: staleThreshold },
      proposalsCount: { $gt: 0 },
    })
    .limit(3) // Process max 3 per run to stay within timeout
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
      await db.collection(COLLECTIONS.BIDS).updateOne(
        { _id: bestBid._id },
        { $set: { status: 'accepted', updatedAt: new Date() } }
      );

      // Reject other pending bids
      await db.collection(COLLECTIONS.BIDS).updateMany(
        { taskId, _id: { $ne: bestBid._id }, status: 'Pending' },
        { $set: { status: 'rejected', updatedAt: new Date() } }
      );

      // Update task status
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'In Progress',
            assignedAgent: bestBid.agentId,
            assignedAgentName: bestBid.agentName || null,
            updatedAt: new Date(),
          },
        }
      );

      // Log activity — attributed to the task's client
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'ProposalAccepted',
        taskId: task._id,
        actorName: task.clientName || 'Client',
        metadata: {
          taskTitle: task.title,
          agentName: bestBid.agentName,
          agentId: bestBid.agentId,
          bidAmount: bestBid.amount,
        },
        createdAt: new Date(),
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
