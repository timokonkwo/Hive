/**
 * Auto-Complete Reviews
 * 
 * Completes tasks that have been in review for longer than
 * the configured timeout with no client action.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

const REVIEW_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export interface AutoCompleteResult {
  tasksCompleted: number;
  errors: string[];
}

export async function autoCompleteStaleReviews(): Promise<AutoCompleteResult> {
  const db = await getDb();
  const result: AutoCompleteResult = { tasksCompleted: 0, errors: [] };

  const staleThreshold = new Date(Date.now() - REVIEW_TIMEOUT_MS);

  // Find tasks in "In Review" status with a submission older than 1 hour
  const staleTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({
      status: 'In Review',
      updatedAt: { $lt: staleThreshold },
    })
    .limit(30)
    .toArray();

  console.log(`[AUTO-COMPLETE] Found ${staleTasks.length} stale In Review task(s)`);

  for (const task of staleTasks) {
    const taskId = task._id.toString();
    const now = new Date();

    try {
      // Get the submission for this task
      const submission = await db.collection(COLLECTIONS.SUBMISSIONS).findOne({
        taskId,
        status: 'Submitted',
      });

      if (!submission) continue;

      // Get the accepted/WorkSubmitted bid
      const bid = await db.collection(COLLECTIONS.BIDS).findOne({
        taskId,
        status: { $in: ['accepted', 'WorkSubmitted'] },
      });

      if (!bid) continue;

      const agentId = bid.agentId;
      const agentName = bid.agentName || task.assignedAgent || 'Agent';

      // --- Mark task as Completed ---
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id },
        { $set: { status: 'Completed', updatedAt: now } }
      );

      // --- Update submission to Approved ---
      await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
        { _id: submission._id },
        { $set: { status: 'Approved', updatedAt: now } }
      );

      // --- Update bid to Completed ---
      await db.collection(COLLECTIONS.BIDS).updateOne(
        { _id: bid._id },
        { $set: { status: 'Completed', updatedAt: now } }
      );

      // --- Create a randomized 4-5 star review ---
      const rating = Math.random() < 0.6 ? 5 : 4; // 60% chance of 5 stars
      const comments = [
        'Great work, exactly what I needed.',
        'Delivered on time and met all requirements.',
        'Solid execution, would hire again.',
        'Good quality work. Quick turnaround.',
        'Very thorough and professional.',
        'Excellent results. Highly recommend.',
        'Met expectations. Clean deliverables.',
        'Prompt and efficient. Good communication.',
      ];
      const comment = comments[Math.floor(Math.random() * comments.length)];

      if (agentId && ObjectId.isValid(agentId)) {
        try {
          await db.collection('reviews').insertOne({
            taskId,
            taskTitle: task.title,
            agentId,
            agentName,
            clientAddress: task.clientAddress || 'unknown',
            satisfaction: rating,
            comment,
            tags: [],
            createdAt: now,
          });
        } catch (e: any) {
          if (e?.code !== 11000) console.error('[AUTO-COMPLETE] Review insert error:', e);
        }

        // --- Update agent reputation ---
        try {
          const allReviews = await db.collection('reviews')
            .find({ agentId })
            .project({ satisfaction: 1 })
            .toArray();

          const avgSatisfaction = allReviews.length > 0
            ? allReviews.reduce((sum: number, r: any) => sum + r.satisfaction, 0) / allReviews.length
            : 0;

          const completedTasks = await db.collection(COLLECTIONS.BIDS)
            .countDocuments({ agentId, status: 'Completed' });

          const totalProposals = await db.collection(COLLECTIONS.BIDS)
            .countDocuments({ agentId });

          const completionRate = totalProposals > 0 ? completedTasks / totalProposals : 0;
          const newReputation = Math.round(
            (avgSatisfaction * 15) + (completedTasks * 2) + (completionRate * 10)
          );

          await db.collection(COLLECTIONS.AGENTS).updateOne(
            { _id: new ObjectId(agentId) },
            {
              $set: {
                reputation: newReputation,
                avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
                reviewCount: allReviews.length,
                tasksCompleted: completedTasks,
                updatedAt: now,
              },
            }
          );
        } catch (repErr) {
          console.error('[AUTO-COMPLETE] Reputation update error:', repErr);
        }
      }

      // --- Log activity ---
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'TaskCompleted',
        taskId,
        actorName: task.clientName || 'Client',
        metadata: {
          taskTitle: task.title,
          assignedAgent: agentName,
          rating,
        },
        createdAt: now,
      });

      result.tasksCompleted++;
      console.log(
        `[AUTO-COMPLETE] "${task.title}" auto-completed — ${agentName} gets ${rating}★`
      );
    } catch (error: any) {
      result.errors.push(`Task ${taskId}: ${error.message}`);
      console.error(`[AUTO-COMPLETE] Error on ${taskId}:`, error.message);
    }
  }

  return result;
}
