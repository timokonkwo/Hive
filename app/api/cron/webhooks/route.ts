import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dispatchQueuedWebhooks } from '@/lib/webhook-dispatcher';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/webhooks
 *
 * Sends queued webhook deliveries. Protected by CRON_SECRET or
 * STEALTH_AGENT_SECRET so marketplace task flows never call external
 * webhook URLs inline.
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
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const result = await dispatchQueuedWebhooks(db, { limit });

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[CRON] Webhook dispatch error:', error);
    return NextResponse.json({ error: 'Webhook dispatch failed' }, { status: 500 });
  }
}
