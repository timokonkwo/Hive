/**
 * Stealth Agent Runner
 * 
 * Main orchestrator for the stealth agent system.
 * Handles two modes:
 *   1. Event-driven: instant bidding when a new task is created (called by the trigger endpoint)
 *   2. Cron sweep: periodic check for tasks that were missed
 * 
 * Also runs the fulfillment loop for accepted bids.
 */

import { findMatchingAgent, findUnbidTasks } from './matcher';
import { submitBid } from './bidder';
import { fulfillAcceptedBids } from './fulfiller';

/**
 * Handle a new task event (instant path).
 * Called by the internal trigger endpoint when a task is created.
 */
export async function handleNewTask(task: {
  taskId: string;
  title: string;
  description: string;
  category: string;
  requirements: string;
  budget: string;
}): Promise<{ bid: boolean; agent?: string; error?: string }> {
  try {
    const match = await findMatchingAgent(task.taskId, task.category);
    if (!match) {
      return { bid: false, error: 'No matching agent available' };
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
      bid: result.success,
      agent: match.agent.name,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[STEALTH] handleNewTask error:', error.message);
    return { bid: false, error: error.message };
  }
}

/**
 * Sweep for open tasks without stealth agent bids (cron path).
 * Also checks for accepted bids that need fulfillment.
 */
export async function runSweep(): Promise<{
  bidsSubmitted: number;
  fulfillmentsProcessed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let bidsSubmitted = 0;

  try {
    // 1. Find tasks that stealth agents haven't bid on
    const unbidTasks = await findUnbidTasks();

    console.log(`[STEALTH] Sweep: ${unbidTasks.length} unbid task(s) found`);

    for (const task of unbidTasks) {
      const result = await handleNewTask({
        taskId: task.taskId,
        title: task.title,
        description: task.description,
        category: task.category,
        requirements: task.requirements,
        budget: task.budget,
      });

      if (result.bid) {
        bidsSubmitted++;
      } else if (result.error && result.error !== 'No matching agent available') {
        errors.push(`${task.taskId}: ${result.error}`);
      }
    }
  } catch (error: any) {
    errors.push(`Sweep error: ${error.message}`);
  }

  // 2. Check for accepted bids that need fulfillment
  let fulfillmentsProcessed = false;
  try {
    await fulfillAcceptedBids();
    fulfillmentsProcessed = true;
  } catch (error: any) {
    errors.push(`Fulfillment error: ${error.message}`);
  }

  console.log(
    `[STEALTH] Sweep complete: ${bidsSubmitted} bid(s) submitted, fulfillments: ${fulfillmentsProcessed}`
  );

  return { bidsSubmitted, fulfillmentsProcessed, errors };
}
