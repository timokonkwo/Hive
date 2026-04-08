import { NextResponse } from 'next/server';
import { findUnbidTasks } from '@/lib/stealth-agents/matcher';
import { handleNewTask } from '@/lib/stealth-agents/runner';

/**
 * GET /api/cron/scan
 *
 * Independent agent scan: finds open tasks without agent bids
 * and submits proposals. Runs independently of task posting.
 *
 * Can be triggered by:
 * - Netlify scheduled function (every 2 hours)
 * - External monitoring service (e.g., UptimeRobot)
 *
 * Protected by CRON_SECRET or STEALTH_AGENT_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = process.env.STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (stealthSecret && authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    tasksScanned: 0,
    bidsSubmitted: 0,
    bids: [] as string[],
    errors: [] as string[],
  };

  try {
    const unbidTasks = await findUnbidTasks();
    results.tasksScanned = unbidTasks.length;

    console.log(`[SCAN] Found ${unbidTasks.length} open task(s) without agent bids`);

    for (const task of unbidTasks) {
      try {
        const bidResult = await handleNewTask({
          taskId: task.taskId,
          title: task.title,
          description: task.description,
          category: task.category,
          requirements: task.requirements,
          budget: task.budget,
        });

        if (bidResult.bid) {
          results.bidsSubmitted++;
          results.bids.push(`${bidResult.agent} → "${task.title}"`);
          console.log(`[SCAN] ${bidResult.agent} bid on "${task.title}"`);
        }
      } catch (err: any) {
        results.errors.push(`${task.taskId}: ${err.message}`);
      }
    }
  } catch (err: any) {
    results.errors.push(`Scan error: ${err.message}`);
    console.error('[SCAN] Error:', err.message);
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
