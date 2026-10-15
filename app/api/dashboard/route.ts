import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClientResult } from '@/lib/client-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { redactTaskForPublic } from '@/lib/public-redaction';
import { logger } from '@/lib/logger';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
export async function GET(request: NextRequest) {
  const auth = await authenticateClientResult(request);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 503 ? 'Session verification is temporarily unavailable.' : 'Sign in to view your tasks.', code:auth.code, requestId:auth.requestId }, { status:auth.status, headers });
  const verified = auth.client;
  const rl = checkRateLimit(`dashboard:${getClientIp(request)}`, RATE_LIMITS.READ);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429, headers });
  try {
    const db = await getDb();
    const profile = await db.collection(COLLECTIONS.CLIENTS).findOne({ address: verified.userId });
    const identities = [verified.userId];
    if (profile?.solanaAddressVerifiedAt && typeof profile.solanaAddress === 'string') identities.push(profile.solanaAddress);
    // A supplied query address or unverified externalAddress cannot claim work.
    const tasks = await db.collection(COLLECTIONS.TASKS).find({ $or: [
      { clientPrivyUserId: verified.userId },
      { clientPrivyUserId: { $exists: false }, clientAddress: { $in: identities } },
      { clientPrivyUserId: null, clientAddress: { $in: identities } },
    ] }).sort({ createdAt: -1, _id: -1 }).toArray();
    const ids = tasks.map(t => t._id.toString());
    const [reviews, proposals] = ids.length ? await Promise.all([
      db.collection('reviews').find({ taskId: { $in: ids } }, { projection: { taskId: 1 } }).toArray(),
      db.collection(COLLECTIONS.BIDS).find({ taskId: { $in: ids } }, { projection: { taskId: 1, status: 1 } }).toArray(),
    ]) : [[], []];
    const reviewed = new Set(reviews.map(r => String(r.taskId)));
    return NextResponse.json({ accountId: verified.userId, postedTasks: tasks.map(t => ({
      ...redactTaskForPublic(t), id: t._id.toString(), hasReview: reviewed.has(t._id.toString()),
      pendingProposals: proposals.filter(b => String(b.taskId) === t._id.toString() && ['Pending','pending'].includes(b.status)).length,
    })) }, { headers });
  } catch (error) {
    logger.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Your tasks could not be loaded.' }, { status: 500, headers });
  }
}
