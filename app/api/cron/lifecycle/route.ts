import { NextResponse } from 'next/server';
import { autoAcceptStaleBids } from '@/lib/cron/auto-accept';
import { autoCompleteStaleReviews } from '@/lib/cron/auto-complete';
import { fulfillAcceptedBids } from '@/lib/stealth-agents/fulfiller';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/lifecycle
 *
 * Handles task lifecycle progression:
 * 1. Accept stale bids (72h+ open tasks)
 * 2. Fulfill accepted bids (generate deliverables)
 * 3. Complete stale reviews (1h+ in review)
 *
 * Runs on a separate schedule from task posting.
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

  // 1. Accept stale bids
  try {
    results.autoAccept = await autoAcceptStaleBids();
  } catch (err: any) {
    results.autoAccept = { error: err.message };
    logger.error('[LIFECYCLE] Auto-accept error:', err.message);
  }

  // 2. Fulfill accepted bids (generate deliverables via Gemini)
  try {
    await fulfillAcceptedBids();
    results.fulfillment = { success: true };
  } catch (err: any) {
    results.fulfillment = { error: err.message };
    logger.error('[LIFECYCLE] Fulfillment error:', err.message);
  }

  // 3. Complete stale reviews
  try {
    results.autoComplete = await autoCompleteStaleReviews();
  } catch (err: any) {
    results.autoComplete = { error: err.message };
    logger.error('[LIFECYCLE] Auto-complete error:', err.message);
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
