/**
 * Agent Matcher
 * 
 * Matches open tasks to the best available agent based on category.
 * Ensures agent records exist in the database before matching.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { STEALTH_AGENTS, type StealthAgentConfig } from './config';

export interface MatchResult {
  agent: StealthAgentConfig;
  agentId: string;
  apiKey: string;
}

/** Tracks whether agents have been seeded this process lifecycle */
let agentsSeeded = false;

/**
 * Ensure all configured agents exist in the database.
 * Idempotent — safe to call on every invocation. Only does DB writes on first run.
 */
async function ensureAgentsExist(): Promise<void> {
  if (agentsSeeded) return; // Already checked this process

  const db = await getDb();
  for (const agent of STEALTH_AGENTS) {
    const exists = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: agent.name,
      isHiveOwned: true,
    });

    if (!exists) {
      await db.collection(COLLECTIONS.AGENTS).insertOne({
        name: agent.name,
        bio: agent.bio,
        capabilities: agent.capabilities,
        isHiveOwned: true,
        reputation: 50,
        avgSatisfaction: 0,
        reviewCount: 0,
        tasksCompleted: 0,
        status: 'active',
        walletAddress: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[AGENTS] Registered agent: ${agent.name}`);
    }
  }

  agentsSeeded = true;
}

/**
 * Find the best agent for a given task.
 * Returns null if no agent is suitable or all have already bid.
 */
export async function findMatchingAgent(
  taskId: string,
  taskCategory: string
): Promise<MatchResult | null> {
  await ensureAgentsExist();

  const db = await getDb();

  // Find agents whose categories include this task's category
  const candidates = STEALTH_AGENTS.filter((a) =>
    a.categories.includes(taskCategory)
  );

  if (candidates.length === 0) {
    // Fallback: use the agent that handles 'Other'
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

    // Check if the task already has an accepted bid
    const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: 'accepted',
    });

    if (acceptedBid) return null; // Task is already assigned

    return {
      agent: candidate,
      agentId,
      apiKey: agentDoc.rawApiKey || '',
    };
  }

  return null; // All candidates already bid
}

/**
 * Find open tasks that agents haven't bid on yet.
 * Used by the scan endpoint.
 */
export async function findUnbidTasks(): Promise<
  Array<{ taskId: string; category: string; title: string; description: string; requirements: string; budget: string; deliverableSpecs: any[] }>
> {
  await ensureAgentsExist();

  const db = await getDb();

  // Get open tasks (limit to 10 per scan to stay within timeout)
  const openTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({ status: 'Open' })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  // Get all platform agent IDs
  const platformAgents = await db
    .collection(COLLECTIONS.AGENTS)
    .find({ isHiveOwned: true })
    .project({ _id: 1 })
    .toArray();

  const platformAgentIds = new Set(platformAgents.map((a) => a._id.toString()));

  if (platformAgentIds.size === 0) return [];

  // Filter to tasks where not all agents have bid
  const unbidTasks: Array<{ taskId: string; category: string; title: string; description: string; requirements: string; budget: string; deliverableSpecs: any[] }> = [];

  for (const task of openTasks) {
    const taskId = task._id.toString();

    // Get existing bids on this task
    const existingBids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ taskId })
      .project({ agentId: 1 })
      .toArray();

    const biddingAgentIds = new Set(existingBids.map((b) => b.agentId));

    // Check if at least one platform agent hasn't bid yet
    const hasUnbidAgent = [...platformAgentIds].some((id) => !biddingAgentIds.has(id));

    if (hasUnbidAgent) {
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
