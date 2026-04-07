/**
 * Seed Existing Tasks with Stealth Agent Bids
 * 
 * One-time script: picks 30% of open tasks and has stealth agents bid on them.
 * Run with: npx tsx scripts/seed-existing-tasks.ts
 * 
 * Requires the dev server to be running (for the internal API trigger).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const STEALTH_SECRET = process.env.STEALTH_AGENT_SECRET;

async function main() {
  if (!STEALTH_SECRET) {
    console.error('STEALTH_AGENT_SECRET is not set. Add it to .env.local');
    process.exit(1);
  }

  console.log('[SEED] Fetching open tasks...');

  // Fetch open tasks from the API
  const tasksRes = await fetch(`${SITE_URL}/api/tasks?status=Open&limit=100`);
  if (!tasksRes.ok) {
    console.error('[SEED] Failed to fetch tasks:', await tasksRes.text());
    process.exit(1);
  }

  const tasksData = await tasksRes.json();
  const tasks = tasksData.tasks || tasksData;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log('[SEED] No open tasks found. Nothing to do.');
    return;
  }

  console.log(`[SEED] Found ${tasks.length} open task(s)`);

  // Select 30% randomly
  const count = Math.max(1, Math.ceil(tasks.length * 0.3));
  const shuffled = tasks.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  console.log(`[SEED] Selected ${selected.length} task(s) (30%) for stealth agent bidding`);

  let successes = 0;
  let failures = 0;

  for (const task of selected) {
    const taskId = task.id || task._id;
    try {
      console.log(`[SEED] Triggering bid for: "${task.title}" (${taskId})`);

      const triggerRes = await fetch(`${SITE_URL}/api/internal/agent-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stealth-secret': STEALTH_SECRET,
        },
        body: JSON.stringify({
          taskId,
          title: task.title || 'Untitled',
          description: task.description || '',
          category: task.category || 'Other',
          requirements: task.requirements || '',
          budget: task.budget || 'Negotiable',
        }),
      });

      const result = await triggerRes.json();

      if (triggerRes.ok) {
        console.log(`  ✓ ${result.agent || 'Agent'} bid submitted`);
        successes++;
      } else {
        console.log(`  ✗ ${result.error || 'Failed'}`);
        failures++;
      }

      // Small delay between triggers (500ms)
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
      failures++;
    }
  }

  console.log(`\n[SEED] Done. Successes: ${successes}, Failures: ${failures}`);
}

main().catch(console.error);
