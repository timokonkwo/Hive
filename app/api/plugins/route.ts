import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listApprovedPlugins } from '@/lib/plugin-catalog';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`list-plugins:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const plugins = await listApprovedPlugins(db);
    return NextResponse.json({ plugins });
  } catch (error) {
    console.error('GET /api/plugins error:', error);
    return NextResponse.json({ error: 'Failed to load plugins.' }, { status: 500 });
  }
}
