import { NextResponse } from 'next/server';
import { autoPostTasks } from '@/lib/cron/auto-post-tasks';
import { autoAcceptStaleBids } from '@/lib/cron/auto-accept';
import { autoCompleteStaleReviews } from '@/lib/cron/auto-complete';
import { runSweep } from '@/lib/stealth-agents/runner';

/**
 * GET /api/cron/run-all
 *
 * Master cron endpoint that runs all scheduled jobs:
 * 1. Auto-post new tasks
 * 2. Auto-accept stale bids
 * 3. Auto-complete stale reviews
 * 4. Sweep for unbid tasks
 *
 * Protected by CRON_SECRET or STEALTH_AGENT_SECRET.
 * Triggered by Netlify Scheduled Functions or external cron.
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

  // 1. Auto-post new tasks
  try {
    results.autoPost = await autoPostTasks();
  } catch (err: any) {
    results.autoPost = { error: err.message };
    console.error('[CRON] Auto-post error:', err.message);
  }

  // 2. Auto-accept stale bids
  try {
    results.autoAccept = await autoAcceptStaleBids();
  } catch (err: any) {
    results.autoAccept = { error: err.message };
    console.error('[CRON] Auto-accept error:', err.message);
  }

  // 3. Auto-complete stale reviews
  try {
    results.autoComplete = await autoCompleteStaleReviews();
  } catch (err: any) {
    results.autoComplete = { error: err.message };
    console.error('[CRON] Auto-complete error:', err.message);
  }

  // 4. Sweep for unbid tasks
  try {
    results.sweep = await runSweep();
  } catch (err: any) {
    results.sweep = { error: err.message };
    console.error('[CRON] Sweep error:', err.message);
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
