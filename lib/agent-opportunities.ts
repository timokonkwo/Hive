import type { Db } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';
import { CATEGORY_CAPABILITY_MAP } from '@/lib/smart-matching';

type AgentForOpportunity = {
  id: string;
  capabilities?: string[];
  reputation?: number;
  isVerified?: boolean;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function parseBudgetAmount(task: any): number {
  if (typeof task.budgetAmount === 'number') return task.budgetAmount;
  const match = String(task.budget || '').match(/([\d.]+)/);
  return match ? Number.parseFloat(match[1]) || 0 : 0;
}

export async function rankTasksForAgent(
  db: Db,
  agent: AgentForOpportunity,
  options: { limit?: number; candidateLimit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit || 10, 1), 25);
  const candidateLimit = Math.min(Math.max(options.candidateLimit || 75, limit), 150);
  const agentCaps = (agent.capabilities || []).map(normalize);

  const tasks = await db.collection(COLLECTIONS.TASKS)
    .find({ status: 'Open' })
    .sort({ createdAt: -1 })
    .limit(candidateLimit)
    .toArray();

  const existingBids = await db.collection(COLLECTIONS.BIDS)
    .find({ agentId: agent.id })
    .project({ taskId: 1 })
    .toArray();
  const bidTaskIds = new Set(existingBids.map((bid) => bid.taskId));

  return tasks
    .filter((task) => !bidTaskIds.has(task._id.toString()) && (task.assignmentMode !== 'direct' || task.requestedAgentId === agent.id))
    .map((task) => {
      const categoryCaps = (CATEGORY_CAPABILITY_MAP[task.category || 'Other'] || []).map(normalize);
      const matchedCapabilities = agentCaps.filter((cap) => categoryCaps.includes(cap));
      const capabilityRatio = categoryCaps.length > 0
        ? matchedCapabilities.length / categoryCaps.length
        : 0.35;
      const budgetAmount = parseBudgetAmount(task);
      const budgetScore = Math.min(20, budgetAmount >= 500 ? 20 : budgetAmount >= 150 ? 15 : budgetAmount > 0 ? 10 : 8);
      const capabilityScore = Math.min(45, Math.round(capabilityRatio * 45));
      const reputationScore = Math.min(15, Math.round(((agent.reputation || 0) / 100) * 15));
      const verifiedScore = agent.isVerified ? 10 : 0;
      const freshnessScore = Math.max(0, 10 - Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
      const score = Math.min(100, capabilityScore + budgetScore + reputationScore + verifiedScore + freshnessScore);

      const reasons = [
        matchedCapabilities.length > 0
          ? `Matches your ${matchedCapabilities.slice(0, 4).join(', ')} capabilities`
          : 'No exact capability match; ranked by category and market signals',
        budgetAmount > 0 ? `Budget signal: $${budgetAmount}` : 'Budget negotiable',
        freshnessScore >= 8 ? 'Recently posted' : 'Older open task',
      ];

      return {
        taskId: task._id.toString(),
        title: task.title,
        category: task.category,
        budget: task.budget || 'Negotiable',
        budgetAmount,
        proposalsCount: task.proposalsCount || 0,
        createdAt: task.createdAt,
        score,
        confidence: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
        matchedCapabilities,
        reasons,
        url: `/marketplace/${task._id.toString()}`,
      };
    })
    .sort((a, b) => b.score - a.score || b.budgetAmount - a.budgetAmount)
    .slice(0, limit);
}
