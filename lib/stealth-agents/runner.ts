/**
 * Stealth Agent Runner
 * 
 * Main orchestrator for the stealth agent system.
 * 
 * With the transition to direct routing, the bidding sweep is deprecated.
 * Tasks are now auto-assigned at creation time via instant matching.
 * This runner focuses on:
 *   1. Fulfilling auto-assigned tasks that are In Progress
 *   2. A lightweight fallback sweep for any tasks that slipped through
 *      without an instant match (e.g., no available agent at post time)
 */

import { findMatchingAgent, findUnbidTasks } from './matcher';
import { submitBid } from './bidder';
import { fulfillAcceptedBids } from './fulfiller';

/**
 * Handle an unmatched task that was posted without an instant match.
 * Uses smart matching to find and assign the best available agent.
 */
export async function handleUnmatchedTask(task: {
  taskId: string;
  title: string;
  description: string;
  category: string;
  requirements: string;
  budget: string;
}): Promise<{ matched: boolean; agent?: string; error?: string }> {
  try {
    const match = await findMatchingAgent(task.taskId, task.category);
    if (!match) {
      return { matched: false, error: 'No matching agent available' };
    }

    const result = await submitBid({
      taskId: task.taskId,
      taskTitle: task.title,
      taskDescription: task.description,
      taskRequirements: task.requirements,
      taskCategory: task.category,
      taskBudget: task.budget,
      agentId: match.agentId,
      agent: match.agent,
    });

    return {
      matched: result.success,
      agent: match.agent.name,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[STEALTH] handleUnmatchedTask error:', error.message);
    return { matched: false, error: error.message };
  }
}

/**
 * Run the fulfillment loop and a lightweight fallback sweep.
 * 
 * The primary task assignment now happens at task creation time
 * via instant matching. This sweep only catches edge cases where
 * a task was posted but no agent was available at that moment.
 */
export async function runSweep(): Promise<{
  bidsSubmitted: number;
  fulfillmentsProcessed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let bidsSubmitted = 0;

  // 1. Fulfillment is the primary job: check for assigned tasks that need work
  let fulfillmentsProcessed = false;
  try {
    await fulfillAcceptedBids();
    fulfillmentsProcessed = true;
  } catch (error: any) {
    errors.push(`Fulfillment error: ${error.message}`);
  }

  // 2. Lightweight fallback: catch any tasks that were posted without a match
  try {
    const unbidTasks = await findUnbidTasks();

    if (unbidTasks.length > 0) {
      console.log(`[STEALTH] Fallback sweep: ${unbidTasks.length} unmatched task(s) found`);

      for (const task of unbidTasks) {
        const result = await handleUnmatchedTask({
          taskId: task.taskId,
          title: task.title,
          description: task.description,
          category: task.category,
          requirements: task.requirements,
          budget: task.budget,
        });

        if (result.matched) {
          bidsSubmitted++;
        } else if (result.error && result.error !== 'No matching agent available') {
          errors.push(`${task.taskId}: ${result.error}`);
        }
      }
    }
  } catch (error: any) {
    errors.push(`Fallback sweep error: ${error.message}`);
  }

  console.log(
    `[STEALTH] Sweep complete: fulfillments=${fulfillmentsProcessed}, fallback matches=${bidsSubmitted}`
  );

  return { bidsSubmitted, fulfillmentsProcessed, errors };
}

/**
 * Backwards-compatible alias for callers still using the old name.
 * Maps to handleUnmatchedTask.
 */
export const handleNewTask = handleUnmatchedTask;
