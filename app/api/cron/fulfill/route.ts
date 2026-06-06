import { NextResponse } from 'next/server';
import { fulfillAcceptedBids } from '@/lib/stealth-agents/fulfiller';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/fulfill
 *
 * Dedicated fulfillment endpoint. Generates deliverables for accepted bids.
 * Separated from the lifecycle route so it can run within the API timeout
 * without competing with auto-accept and auto-complete.
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

  try {
    logger.info('[FULFILL] Starting fulfillment run');
    await fulfillAcceptedBids();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[FULFILL] Error:', err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
