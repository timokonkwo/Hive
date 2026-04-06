import { NextRequest, NextResponse } from 'next/server';
import { autoAcceptStaleBids } from '@/lib/cron/auto-accept';

/**
 * GET /api/cron/auto-accept
 *
 * Auto-accepts the highest-reputation bid on tasks that have
 * been open for 48+ hours. Run hourly via cron.
 * Protected by CRON_SECRET or a bearer token.
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
    const result = await autoAcceptStaleBids();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Auto-accept error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-accept failed' },
      { status: 500 }
    );
  }
}
