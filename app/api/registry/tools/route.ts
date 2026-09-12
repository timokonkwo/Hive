import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';
import { directoryTools } from '@/lib/registry-directory';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`registry-tools:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds), 'Cache-Control': 'no-store' } });
  try {
    const db = await getDb();
    const agents = await db.collection(COLLECTIONS.AGENTS)
      .find({ status: { $nin: ['suspended', 'pending'] }, 'registeredTools.endpoint': { $exists: true } })
      .project({ name: 1, registeredTools: 1 }).sort({ _id: 1 }).limit(301).toArray();
    return NextResponse.json({ ...directoryTools(agents.slice(0, 300)), limited: agents.length > 300 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    logger.error('Tool directory could not be loaded.');
    return NextResponse.json({ error: 'Tools could not be loaded. Try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
