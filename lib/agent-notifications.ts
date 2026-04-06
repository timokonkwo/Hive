/**
 * Agent Notification System
 * 
 * When a task is created, notify all agents whose capabilities
 * match the task category. Pull-based — agents poll for notifications.
 * Works for all agent types: SDK, MCP, OpenClaw, custom.
 */

import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * Map task categories to capability keywords that agents might have.
 */
const CATEGORY_CAPABILITY_MAP: Record<string, string[]> = {
  'Development': ['web-development', 'code-review', 'smart-contract', 'solana', 'typescript', 'javascript', 'python'],
  'Security': ['security-review', 'smart-contract-audit', 'code-review', 'penetration-testing'],
  'Token Launch': ['smart-contract', 'solana', 'web-development', 'token-launch'],
  'Research': ['research', 'data-analysis', 'market-research'],
  'Analysis': ['data-analysis', 'market-research', 'reporting', 'analytics'],
  'Content': ['content-creation', 'copywriting', 'research', 'writing', 'blogging'],
  'Legal': ['research', 'content-creation', 'legal', 'compliance'],
  'Translation': ['translation', 'content-creation', 'localization'],
  'Social': ['social-media', 'community-management', 'marketing'],
  'Design': ['ui-design', 'graphic-design', 'branding', 'illustration'],
  'Other': [],
};

/**
 * Notify all matching agents about a new task.
 * Call this after a task is inserted into the DB.
 */
export async function notifyMatchingAgents(task: {
  taskId: string;
  title: string;
  category: string;
  budget: string;
  description: string;
}): Promise<{ notified: number }> {
  const db = await getDb();

  const relevantCaps = CATEGORY_CAPABILITY_MAP[task.category] || [];

  // Find active agents with matching capabilities
  const query: Record<string, any> = {
    status: 'active',
  };

  if (relevantCaps.length > 0) {
    query.capabilities = { $in: relevantCaps };
  }

  const matchingAgents = await db
    .collection(COLLECTIONS.AGENTS)
    .find(query)
    .project({ _id: 1, name: 1 })
    .limit(50) // Cap at 50 agents per notification burst
    .toArray();

  if (matchingAgents.length === 0) return { notified: 0 };

  // Insert notification records (one per agent)
  const notifications = matchingAgents.map((agent) => ({
    agentId: agent._id.toString(),
    type: 'new_task' as const,
    taskId: task.taskId,
    title: `New ${task.category} task: "${task.title}"`,
    preview: task.description.slice(0, 200),
    metadata: {
      taskTitle: task.title,
      category: task.category,
      budget: task.budget,
    },
    read: false,
    createdAt: new Date(),
  }));

  await db.collection('agent_notifications').insertMany(notifications);

  return { notified: matchingAgents.length };
}
