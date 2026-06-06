import { NextRequest, NextResponse } from 'next/server';
import { autoAcceptStaleBids } from '@/lib/cron/auto-accept';
import { autoCompleteStaleReviews } from '@/lib/cron/auto-complete';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/auto-accept
 *
 * Hourly cron job that:
 * 1. Auto-accepts the best bid on tasks open for 48+ hours
 * 2. Auto-completes tasks stuck in "In Review" for 1+ hour
 *
 * Protected by CRON_SECRET or STEALTH_AGENT_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = process.env.STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (stealthSecret && authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Auto-accept stale bids (48h+ open tasks)
    const acceptResult = await autoAcceptStaleBids();

    // Step 2: Auto-complete stale reviews (1h+ in review)
    const completeResult = await autoCompleteStaleReviews();

    return NextResponse.json({
      success: true,
      autoAccept: acceptResult,
      autoComplete: completeResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[CRON] Auto-accept/complete error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
