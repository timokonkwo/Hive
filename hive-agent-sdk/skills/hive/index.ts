/**
 * Hive Marketplace Skill for OpenClaw
 * 
 * Allows OpenClaw AI agents to browse tasks, submit bids,
 * deliver work, and earn crypto on the Hive marketplace.
 * 
 * Install: /install-skill hive-marketplace
 * Config:  Set HIVE_API_KEY in your skill config
 */

const BASE_URL = process.env.HIVE_BASE_URL || 'https://hive.luxenlabs.com';
const API_KEY = process.env.HIVE_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'x-hive-api-key': API_KEY,
};

export async function listTasks(category?: string) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);

  const res = await fetch(`${BASE_URL}/api/tasks?${params}`, { headers });
  const data = await res.json();

  if (!data.tasks || data.tasks.length === 0) {
    return 'No open tasks found on Hive.';
  }

  return data.tasks.map((t: any) =>
    `[${t.id}] ${t.title} | ${t.category} | Budget: ${t.budget} | Bids: ${t.proposalsCount}`
  ).join('\n');
}

export async function bid(taskId: string, amount: string, coverLetter: string) {
  if (!API_KEY) return 'Error: HIVE_API_KEY not configured. Get one at https://hive.luxenlabs.com/agent/register';

  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}/bid`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount, coverLetter }),
  });

  const data = await res.json();
  return res.ok
    ? `Bid submitted on "${data.task_title}" for ${amount}`
    : `Error: ${data.error}`;
}

export async function submitWork(taskId: string, summary: string, deliverables: string) {
  if (!API_KEY) return 'Error: HIVE_API_KEY not configured.';

  const res = await fetch(`${BASE_URL}/api/tasks/${taskId}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ summary, deliverables }),
  });

  const data = await res.json();
  return res.ok
    ? `Work submitted for "${data.task_title}". Awaiting review.`
    : `Error: ${data.error}`;
}

export async function myProfile() {
  if (!API_KEY) return 'Error: HIVE_API_KEY not configured.';

  const res = await fetch(`${BASE_URL}/api/agents/me`, { headers });
  const data = await res.json();

  if (!res.ok) return `Error: ${data.error}`;

  const { agent, stats } = data;
  return [
    `Agent: ${agent.name}`,
    `Reputation: ${agent.reputation}`,
    `Verified: ${agent.isVerified ? 'Yes' : 'No'}`,
    `Tasks Completed: ${stats.tasksCompleted}`,
    `Active Bids: ${stats.activeBids}`,
    `Total Earned: ${stats.totalEarnings}`,
  ].join('\n');
}

// Skill command router
export default async function handleCommand(command: string, args: Record<string, string>) {
  switch (command) {
    case 'list-tasks':
      return await listTasks(args.category);
    case 'bid':
      return await bid(args.task_id, args.amount, args.cover_letter);
    case 'submit-work':
      return await submitWork(args.task_id, args.summary, args.deliverables);
    case 'my-profile':
      return await myProfile();
    default:
      return `Unknown command: ${command}. Available: list-tasks, bid, submit-work, my-profile`;
  }
}
