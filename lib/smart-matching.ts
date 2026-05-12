import type { Db } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';

export type TaskForMatching = {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  requirements?: string;
  tags?: string[];
  budget?: string;
  budgetAmount?: number;
};

export type AgentMatch = {
  agentId: string;
  agentName: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  matchedCapabilities: string[];
  capabilityScore: number;
  reputationScore: number;
  qualityScore: number;
  activityScore: number;
  priceScore: number;
  agent: any;
};

export const CATEGORY_CAPABILITY_MAP: Record<string, string[]> = {
  Development: ['web-development', 'code-review', 'smart-contract', 'solana', 'typescript', 'javascript', 'python'],
  Security: ['security-review', 'smart-contract-audit', 'code-review', 'penetration-testing'],
  'Token Launch': ['smart-contract', 'solana', 'web-development', 'token-launch'],
  Research: ['research', 'data-analysis', 'market-research'],
  Analysis: ['data-analysis', 'market-research', 'reporting', 'analytics'],
  Content: ['content-creation', 'copywriting', 'research', 'writing', 'blogging'],
  Legal: ['research', 'content-creation', 'legal', 'compliance'],
  Translation: ['translation', 'content-creation', 'localization'],
  Social: ['social-media', 'community-management', 'marketing'],
  Design: ['ui-design', 'graphic-design', 'branding', 'illustration'],
  Other: [],
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function parseBudgetAmount(task: TaskForMatching): number {
  if (typeof task.budgetAmount === 'number' && Number.isFinite(task.budgetAmount)) {
    return task.budgetAmount;
  }
  const match = String(task.budget || '').match(/([\d.]+)/);
  return match ? Number.parseFloat(match[1]) || 0 : 0;
}

function taskKeywords(task: TaskForMatching): string[] {
  const source = [
    task.title,
    task.description,
    task.requirements,
    ...(Array.isArray(task.tags) ? task.tags : []),
  ].join(' ');

  return Array.from(new Set(
    source
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .filter((word) => word.length >= 3)
  ));
}

function scorePriceFit(budgetAmount: number, completedTasks: number): number {
  if (!budgetAmount) return 8;
  if (budgetAmount >= 500) return completedTasks > 0 ? 10 : 6;
  if (budgetAmount >= 150) return completedTasks > 2 ? 10 : 8;
  return 10;
}

function confidenceFor(score: number): AgentMatch['confidence'] {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

async function getAgentStats(db: Db, agent: any) {
  const agentId = agent._id.toString();
  const name = agent.name || '';
  const assignmentAlternates = [agentId, name].filter(Boolean);

  const [completedTasks, totalBids, acceptedBids] = await Promise.all([
    db.collection(COLLECTIONS.TASKS).countDocuments({
      status: 'Completed',
      $or: [
        { assignedAgent: { $in: assignmentAlternates } },
        { assignedAgentName: name },
      ],
    }),
    db.collection(COLLECTIONS.BIDS).countDocuments({ agentId }),
    db.collection(COLLECTIONS.BIDS).countDocuments({ agentId, status: { $in: ['accepted', 'WorkSubmitted', 'Completed'] } }),
  ]);

  return { completedTasks, totalBids, acceptedBids };
}

export async function rankAgentsForTask(
  db: Db,
  task: TaskForMatching,
  options: { limit?: number; candidateLimit?: number; persist?: boolean } = {}
): Promise<AgentMatch[]> {
  const limit = Math.min(Math.max(options.limit || 10, 1), 25);
  const candidateLimit = Math.min(Math.max(options.candidateLimit || 75, limit), 150);
  const category = task.category || 'Other';
  const relevantCaps = CATEGORY_CAPABILITY_MAP[category] || [];
  const keywords = taskKeywords(task);
  const budgetAmount = parseBudgetAmount(task);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const query: Record<string, any> = {
    status: 'active',
    $or: [
      { updatedAt: { $gte: sevenDaysAgo } },
      { isVerified: true },
      { reputation: { $gt: 0 } },
    ],
  };

  if (relevantCaps.length > 0) {
    query.capabilities = { $in: relevantCaps };
  }

  let candidates = await db.collection(COLLECTIONS.AGENTS)
    .find(query)
    .sort({ isVerified: -1, reputation: -1, updatedAt: -1 })
    .limit(candidateLimit)
    .toArray();

  if (candidates.length === 0 && relevantCaps.length > 0) {
    const fallbackQuery = { ...query };
    delete fallbackQuery.capabilities;
    candidates = await db.collection(COLLECTIONS.AGENTS)
      .find(fallbackQuery)
      .sort({ isVerified: -1, reputation: -1, updatedAt: -1 })
      .limit(candidateLimit)
      .toArray();
  }

  const scored = await Promise.all(candidates.map(async (agent): Promise<AgentMatch> => {
    const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities.map(normalize) : [];
    const matchedCapabilities = capabilities.filter((cap: string) => relevantCaps.map(normalize).includes(cap));
    const keywordMatches = capabilities.filter((cap: string) => keywords.some((word) => cap.includes(word) || word.includes(cap)));
    const { completedTasks, totalBids, acceptedBids } = await getAgentStats(db, agent);

    const capabilityRatio = relevantCaps.length > 0
      ? matchedCapabilities.length / relevantCaps.length
      : Math.min(keywordMatches.length / 3, 1);
    const capabilityScore = Math.min(35, Math.round(capabilityRatio * 30) + Math.min(keywordMatches.length * 2, 5));
    const reputationScore = Math.min(20, Math.round(((agent.reputation || 0) / 100) * 20));
    const winRate = totalBids > 0 ? acceptedBids / totalBids : 0;
    const qualityScore = Math.min(20, Math.round(winRate * 10) + Math.min(completedTasks * 2, 10));
    const updatedAt = agent.updatedAt ? new Date(agent.updatedAt).getTime() : 0;
    const recentlyActive = updatedAt >= sevenDaysAgo.getTime();
    const activityScore = recentlyActive ? 10 : (agent.isVerified ? 6 : 3);
    const priceScore = scorePriceFit(budgetAmount, completedTasks);
    const verifiedBonus = agent.isVerified ? 5 : 0;
    const score = Math.min(100, capabilityScore + reputationScore + qualityScore + activityScore + priceScore + verifiedBonus);

    const reasons = [
      matchedCapabilities.length > 0
        ? `Matches ${matchedCapabilities.slice(0, 4).join(', ')} capability requirements`
        : 'No exact capability match; ranked by broader marketplace signals',
      completedTasks > 0 ? `${completedTasks} completed task${completedTasks === 1 ? '' : 's'}` : 'No completed-task history yet',
      totalBids > 0 ? `${Math.round(winRate * 100)}% proposal acceptance signal` : 'No proposal history yet',
      agent.isVerified ? 'Verified agent' : 'Unverified agent',
      recentlyActive ? 'Recently active' : 'Not recently active',
    ];

    return {
      agentId: agent._id.toString(),
      agentName: agent.name || 'Unnamed Agent',
      score,
      confidence: confidenceFor(score),
      reasons,
      matchedCapabilities,
      capabilityScore,
      reputationScore,
      qualityScore,
      activityScore,
      priceScore,
      agent,
    };
  }));

  const matches = scored
    .sort((a, b) => b.score - a.score || (b.agent.reputation || 0) - (a.agent.reputation || 0))
    .slice(0, limit);

  if (options.persist && task.id) {
    await db.collection(COLLECTIONS.TASK_MATCHES).updateOne(
      { taskId: task.id },
      {
        $set: {
          taskId: task.id,
          category,
          matches: matches.map(({ agent, ...match }) => ({
            ...match,
            agent: {
              id: match.agentId,
              name: match.agentName,
              reputation: agent.reputation || 0,
              capabilities: agent.capabilities || [],
              isVerified: !!agent.isVerified,
            },
          })),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  return matches;
}
