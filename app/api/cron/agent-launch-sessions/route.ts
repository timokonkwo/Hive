import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recoverLaunchSessions } from '@/lib/agent-tokenization/session-runtime';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET, supplied = Buffer.from(req.headers.get('authorization') || ''), expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED !== 'true') return NextResponse.json({ enabled: false });
  try { return NextResponse.json({ enabled: true, ...await recoverLaunchSessions(await getDb()) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Launch recovery is unavailable.' }, { status: 503 }); }
}
