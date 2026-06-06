import { NextRequest, NextResponse } from 'next/server';
import { STEALTH_AGENT_SECRET } from '@/lib/stealth-agents/config';
import { runSweep } from '@/lib/stealth-agents/runner';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/stealth-sweep
 *
 * Cron endpoint that sweeps for open tasks and fulfills accepted bids.
 * Call every 10 minutes via Vercel Cron, GitHub Actions, or external ping.
 * Protected by CRON_SECRET or STEALTH_AGENT_SECRET.
 */
export async function GET(req: NextRequest) {
  // Verify authorization — Vercel cron uses CRON_SECRET, manual calls use stealth secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSweep();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[STEALTH] Cron sweep error:', error);
    return NextResponse.json(
      { error: error.message || 'Sweep failed' },
      { status: 500 }
    );
  }
}
