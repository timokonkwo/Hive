/**
 * Stealth Agent Matcher
 * 
 * Matches open tasks to the best stealth agent based on category and capabilities.
 * Prevents duplicate bids — an agent never bids twice on the same task.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { STEALTH_AGENTS, type StealthAgentConfig } from './config';

export interface MatchResult {
  agent: StealthAgentConfig;
  agentId: string;
  apiKey: string;
}

/**
 * Find the best stealth agent for a given task.
 * Returns null if no agent is suitable or all have already bid.
 */
export async function findMatchingAgent(
  taskId: string,
  taskCategory: string
): Promise<MatchResult | null> {
  const db = await getDb();

  // Find agents whose categories include this task's category
  const candidates = STEALTH_AGENTS.filter((a) =>
    a.categories.includes(taskCategory)
  );

  if (candidates.length === 0) {
    // Fallback: if no category match (e.g., "Other"), use Echo (catch-all)
    const fallback = STEALTH_AGENTS.find((a) => a.categories.includes('Other'));
    if (fallback) candidates.push(fallback);
    else return null;
  }

  // Look up each candidate in the DB to get their agentId and check if they already bid
  for (const candidate of candidates) {
    const agentDoc = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: candidate.name,
      isHiveOwned: true,
    });

    if (!agentDoc) continue;

    const agentId = agentDoc._id.toString();

    // Check if this agent already bid on this task
    const existingBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      agentId,
    });

    if (existingBid) continue; // Already bid, skip

    // Check if the task already has an accepted bid (someone else is working on it)
    const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: 'accepted',
    });

    if (acceptedBid) return null; // Task is already assigned

    return {
      agent: candidate,
      agentId,
      apiKey: agentDoc.rawApiKey || '', // We'll use internal DB access instead
    };
  }

  return null; // All candidates already bid
}

/**
 * Find all open tasks that stealth agents haven't bid on yet.
 * Used by the cron sweep.
 */
export async function findUnbidTasks(): Promise<
  Array<{ taskId: string; category: string; title: string; description: string; requirements: string; budget: string; deliverableSpecs: any[] }>
> {
  const db = await getDb();

  // Get all open tasks
  const openTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({ status: 'Open' })
    .sort({ createdAt: -1 })
    .limit(50) // Process newest 50 at most per sweep
    .toArray();

  // Get all stealth agent IDs
  const stealthAgents = await db
    .collection(COLLECTIONS.AGENTS)
    .find({ isHiveOwned: true })
    .project({ _id: 1 })
    .toArray();

  const stealthAgentIds = new Set(stealthAgents.map((a) => a._id.toString()));

  // Filter to tasks where no stealth agent has bid
  const unbidTasks: Array<{ taskId: string; category: string; title: string; description: string; requirements: string; budget: string; deliverableSpecs: any[] }> = [];

  for (const task of openTasks) {
    const taskId = task._id.toString();

    // Check if any stealth agent already bid on this task
    const existingBids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ taskId })
      .project({ agentId: 1 })
      .toArray();

    const biddingAgentIds = new Set(existingBids.map((b) => b.agentId));
    const allStealthBid = [...stealthAgentIds].every((id) =>
      biddingAgentIds.has(id)
    );

    // If not all stealth agents have bid, we should bid
    if (!allStealthBid) {
      unbidTasks.push({
        taskId,
        category: task.category || 'Other',
        title: task.title || '',
        description: task.description || '',
        requirements: task.requirements || '',
        budget: task.budget || 'Negotiable',
        deliverableSpecs: task.deliverableSpecs || [],
      });
    }
  }

  return unbidTasks;
}
