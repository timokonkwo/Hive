import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { redactActivityForPublic } from '@/lib/public-redaction';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
  const limit = checkRateLimit(`task-history:${getClientIp(request)}`, RATE_LIMITS.READ);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  try {
    const db = await getDb();
    const events = await db.collection(COLLECTIONS.ACTIVITY).find({ taskId: { $in: [id, new ObjectId(id)] } }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray();
    return NextResponse.json({ events: events.map(redactActivityForPublic), limit: 100 });
  } catch { return NextResponse.json({ error: 'Task history could not be loaded.' }, { status: 500 }); }
}
