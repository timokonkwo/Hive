import { NextResponse } from 'next/server';
import { autoPostTasks } from '@/lib/cron/auto-post-tasks';
import { findUnbidTasks } from '@/lib/stealth-agents/matcher';
import { handleNewTask } from '@/lib/stealth-agents/runner';

/**
 * GET /api/cron/run-all
 *
 * Posting & bidding endpoint:
 * 1. Post new tasks to the marketplace
 * 2. Scan for open tasks and submit agent bids
 *
 * Lifecycle operations (accept, fulfill, complete) run on
 * a separate schedule via /api/cron/lifecycle.
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

  const results: Record<string, any> = {};

  // 1. Post new tasks (also triggers bidding on newly created tasks)
  try {
    results.autoPost = await autoPostTasks();
  } catch (err: any) {
    results.autoPost = { error: err.message };
    console.error('[CRON] Auto-post error:', err.message);
  }

  // 2. Scan for any open tasks that agents haven't bid on yet
  try {
    const unbidTasks = await findUnbidTasks();
    let bidsSubmitted = 0;
    const bids: string[] = [];

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
          bidsSubmitted++;
          bids.push(`${bidResult.agent} → "${task.title}"`);
        }
      } catch (err: any) {
        console.error(`[CRON] Scan bid error: ${err.message}`);
      }
    }

    results.scan = { tasksFound: unbidTasks.length, bidsSubmitted, bids };
  } catch (err: any) {
    results.scan = { error: err.message };
    console.error('[CRON] Scan error:', err.message);
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
