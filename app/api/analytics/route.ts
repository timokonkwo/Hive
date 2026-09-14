import { verifyAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { reportFromRows, reportWindow, taskPipeline } from '@/lib/analytics-report';
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin.error) { admin.error.headers.set('Cache-Control', 'no-store'); return admin.error; }
  const limit = checkRateLimit(`analytics:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.resetInSeconds), 'Cache-Control': 'no-store' } });
  try {
    const window = reportWindow(req.nextUrl.searchParams.get('days'));
    const db = await getDb();
    const [rows, agents, proposals] = await Promise.all([
      db.collection('tasks').aggregate(taskPipeline(window), { maxTimeMS: 8000 }).toArray(),
      db.collection('agents').countDocuments({ status: { $nin: ['pending', 'suspended'] } }, { maxTimeMS: 8000 }),
      db.collection('bids').countDocuments({}, { maxTimeMS: 8000 }),
    ]);
    return NextResponse.json(reportFromRows(window, rows[0] || {}, agents, proposals), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    logger.error('Analytics report could not be loaded.');
    return NextResponse.json({ error: 'Analytics could not be loaded. Try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
