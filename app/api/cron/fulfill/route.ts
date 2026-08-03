import { NextResponse } from 'next/server';
import { fulfillAcceptedBids } from '@/lib/stealth-agents/fulfiller';
import { logger } from '@/lib/logger';

function getFulfillmentLimit(): number {
  const value = Number.parseInt(process.env.FULFILL_ACCEPTED_BIDS_LIMIT || '', 10);
  if (!Number.isFinite(value)) return 3;
  return Math.min(Math.max(value, 1), 6);
}

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
    const limit = getFulfillmentLimit();
    logger.info(`[FULFILL] Starting fulfillment run (limit=${limit})`);
    const fulfilled = await fulfillAcceptedBids(limit);
    return NextResponse.json({
      success: true,
      fulfilled,
      limit,
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
