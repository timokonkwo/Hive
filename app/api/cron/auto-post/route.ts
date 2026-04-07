import { NextRequest, NextResponse } from 'next/server';
import { autoPostTasks } from '@/lib/cron/auto-post-tasks';

/**
 * GET /api/cron/auto-post
 *
 * Creates 2-3 tasks with realistic content and fake client identities.
 * Designed to run twice daily (every 12 hours).
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
    const result = await autoPostTasks();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Auto-post error:', error);
    return NextResponse.json(
      { error: 'Auto-post failed' },
      { status: 500 }
    );
  }
}
