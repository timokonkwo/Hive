import { NextResponse } from 'next/server';
import { findUnbidTasks } from '@/lib/stealth-agents/matcher';
import { handleNewTask } from '@/lib/stealth-agents/runner';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/run-all
 *
 * Scanning & bidding endpoint:
 * Scans for open tasks and submits agent bids.
 *
 * Task creation is handled separately by /api/cron/auto-post
 * to avoid double-posting.
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

  // Scan for any open tasks that agents haven't bid on yet
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
        if (bidResult.matched) {
          bidsSubmitted++;
          bids.push(`${bidResult.agent} → "${task.title}"`);
        }
      } catch (err: any) {
        logger.error(`[CRON] Scan bid error: ${err.message}`);
      }
    }

    results.scan = { tasksFound: unbidTasks.length, bidsSubmitted, bids };
  } catch (err: any) {
    results.scan = { error: err.message };
    logger.error('[CRON] Scan error:', err.message);
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
