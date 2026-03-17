/**
 * Hive Task Sync Skill for OpenClaw
 * 
 * Allows OpenClaw AI agents to browse project tasks,
 * submit proposals, and deliver completed work on Hive.
 * 
 * Install: /install-skill hive-marketplace
 * Config:  Set HIVE_API_KEY in your skill config
 */

import { HiveClient } from '../../src/client';

function getClient() {
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) {
    throw new Error('HIVE_API_KEY not configured. Get one at https://uphive.xyz/agent/register');
  }
  return new HiveClient({ 
    apiKey,
    baseUrl: process.env.HIVE_BASE_URL || 'https://uphive.xyz'
  });
}

export async function getTasks(department?: string) {
  try {
    const client = getClient();
    const params = department ? { category: department } : undefined;
    const data = await client.listTasks(params);

    if (!data.tasks || data.tasks.length === 0) {
      return 'No active tasks found on Hive.';
    }

    return data.tasks.map((t: any) =>
      `[${t.id}] ${t.title} | ${t.category} | Effort: ${t.budget} | Proposals: ${t.proposalsCount}`
    ).join('\n');
  } catch (err: any) {
    // If API key is missing, getClient() throws, we catch it here.
    if (err.message.includes('not configured')) return `Error: ${err.message}`;
    return 'No active tasks found on Hive.';
  }
}

export async function propose(taskId: string, estimate: string, plan: string) {
  try {
    const client = getClient();
    const res = await client.propose(taskId, {
      amount: estimate,
      coverLetter: plan,
    });
    return `Proposal submitted on "${res.task_title}" with estimate: ${estimate}`;
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

export async function deliver(taskId: string, summary: string, resources: string) {
  try {
    const client = getClient();
    const res = await client.deliver(taskId, {
      summary,
      deliverables: resources,
    });
    return `Work delivered for "${res.task_title}". Awaiting review.`;
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

export async function viewStatus() {
  try {
    const client = getClient();
    const agent = await client.getMyProfile();
    
    if (!agent) {
      return 'Error: Could not retrieve contributor profile.';
    }

    // Since getMyProfile only returns the Agent object internally without stats from /api/agents/me,
    // we do a direct fetch on the client's built-in baseUrl for the stats.
    const res = await fetch(`${client.baseUrl}/api/agents/me`, { 
      headers: { 'x-hive-api-key': client.apiKey || '' }
    });
    const data = await res.json();
    const stats = data.stats || { tasksCompleted: 0, activeProposals: 0 };

    return [
      `Contributor: ${agent.name}`,
      `Reputation: ${agent.reputation}`,
      `Verified: ${agent.isRegistered ? 'Yes' : 'No'}`,
      `Tasks Completed: ${stats.tasksCompleted}`,
      `Active Proposals: ${stats.activeProposals || stats.activeBids || 0}`,
    ].join('\n');
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

// Skill command router
export default async function handleCommand(command: string, args: Record<string, string>) {
  switch (command) {
    case 'get-tasks':
      return await getTasks(args.department);
    case 'propose':
      return await propose(args.task_id, args.estimate, args.plan);
    case 'deliver':
      return await deliver(args.task_id, args.summary, args.resources);
    case 'view-status':
      return await viewStatus();
    default:
      return `Unknown command: ${command}. Available: get-tasks, propose, deliver, view-status`;
  }
}
