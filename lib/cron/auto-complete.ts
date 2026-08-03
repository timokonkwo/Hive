/**
 * Auto-Complete Reviews
 * 
 * Completes tasks that have been in review for longer than
 * the configured timeout with no client action.
 * 
 * For Hive-owned agent submissions on Hive-owned tasks,
 * ~20% are randomly rejected to add realistic quality variance.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { calculateReputation } from '@/lib/reputation';

const SCHEDULED_TASK_SOURCE = 'hive-scheduled-marketplace';

function getIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const USER_REVIEW_TIMEOUT_MS = getIntEnv('AUTO_COMPLETE_USER_REVIEW_HOURS', 48, 6, 168) * 60 * 60 * 1000;
const SYSTEM_REVIEW_TIMEOUT_MS = getIntEnv('AUTO_COMPLETE_SYSTEM_REVIEW_HOURS', 6, 1, 72) * 60 * 60 * 1000;
const REJECTION_RATE = 0.20; // 20% of internal submissions get rejected

const REJECTION_REASONS = [
  { category: 'incomplete', reason: 'The deliverable is missing several key requirements from the task description. Please review the original spec and fill in the gaps.' },
  { category: 'poor_quality', reason: 'The work quality does not meet expectations. Several sections lack depth and specificity. Please revise with more detail.' },
  { category: 'formatting', reason: 'The formatting and structure need improvement. Please reorganize the content with proper headings, consistent formatting, and clearer sections.' },
  { category: 'off_topic', reason: 'Parts of the submission do not align with what was requested. Please re-read the task requirements and adjust accordingly.' },
  { category: 'incomplete', reason: 'The submission appears to be a partial draft. Several sections are underdeveloped. Please complete all deliverables before resubmitting.' },
  { category: 'poor_quality', reason: 'Some of the analysis lacks supporting data and citations. Please strengthen the evidence behind your conclusions.' },
];

function isSystemGeneratedTask(task: unknown): boolean {
  if (!task || typeof task !== 'object') return false;
  const doc = task as Record<string, unknown>;
  return doc.systemGenerated === true ||
    doc.creationSurface === 'scheduled-seed' ||
    doc.activitySource === SCHEDULED_TASK_SOURCE ||
    (typeof doc.clientAddress === 'string' && doc.clientAddress.startsWith('did:privy:cl_'));
}

export interface AutoCompleteResult {
  tasksCompleted: number;
  tasksRejected: number;
  errors: string[];
}

export async function autoCompleteStaleReviews(): Promise<AutoCompleteResult> {
  const db = await getDb();
  const result: AutoCompleteResult = { tasksCompleted: 0, tasksRejected: 0, errors: [] };

  const userStaleThreshold = new Date(Date.now() - USER_REVIEW_TIMEOUT_MS);
  const systemStaleThreshold = new Date(Date.now() - SYSTEM_REVIEW_TIMEOUT_MS);

  // Find tasks in "In Review" status with submitted work older than the configured timeout.
  const staleTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({
      status: 'In Review',
      $or: [
        { updatedAt: { $lt: userStaleThreshold } },
        {
          $and: [
            { updatedAt: { $lt: systemStaleThreshold } },
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

      // Check if this is an internal (Hive-owned) submission on a Hive-owned task
      const isHiveOwnedTask = isSystemGeneratedTask(task);
      let isHiveOwnedAgent = false;
      let agentDoc: any = null;
      if (agentId && ObjectId.isValid(agentId)) {
        agentDoc = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(agentId) });
        isHiveOwnedAgent = agentDoc?.isHiveOwned === true;
      }

      // 20% rejection rate for fully internal submissions
      if (isHiveOwnedTask && isHiveOwnedAgent && Math.random() < REJECTION_RATE) {
        const rejection = REJECTION_REASONS[Math.floor(Math.random() * REJECTION_REASONS.length)];

        // Reject submission
        await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
          { _id: submission._id },
          {
            $set: {
              status: 'Rejected',
              rejectionCategory: rejection.category,
              rejectionReason: rejection.reason,
              rejectedAt: now,
              updatedAt: now,
            },
          }
        );

        // Move task back to In Progress
        await db.collection(COLLECTIONS.TASKS).updateOne(
          { _id: task._id },
          {
            $set: { status: 'In Progress', updatedAt: now },
            $push: {
              rejections: {
                category: rejection.category,
                reason: rejection.reason,
                rejectedAt: now,
                rejectedBy: task.clientAddress,
              },
            } as any,
          }
        );

        // Reset bid to accepted so agent can resubmit
        await db.collection(COLLECTIONS.BIDS).updateOne(
          { _id: bid._id },
          { $set: { status: 'accepted', updatedAt: now } }
        );

        // Log activity
        await db.collection(COLLECTIONS.ACTIVITY).insertOne({
          type: 'WorkRejected',
          taskId,
          actorAddress: task.clientAddress,
          metadata: {
            taskTitle: task.title,
            rejectionCategory: rejection.category,
            reason: rejection.reason,
            assignedAgent: agentName,
            systemGenerated: isHiveOwnedTask,
            source: isHiveOwnedTask ? SCHEDULED_TASK_SOURCE : 'client-review-timeout',
          },
          createdAt: now,
        });

        result.tasksRejected++;
        console.log(`[AUTO-COMPLETE] "${task.title}" REJECTED (${rejection.category}) — ${agentName} will need to resubmit`);
        continue;
      }

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
            systemGenerated: isHiveOwnedTask,
            source: isHiveOwnedTask ? SCHEDULED_TASK_SOURCE : 'client-review-timeout',
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

          const agentIsVerified = isHiveOwnedAgent || agentDoc?.isVerified === true;
          const newReputation = calculateReputation(avgSatisfaction, completedTasks, totalProposals, agentIsVerified);

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
          systemGenerated: isHiveOwnedTask,
          source: isHiveOwnedTask ? SCHEDULED_TASK_SOURCE : 'client-review-timeout',
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
