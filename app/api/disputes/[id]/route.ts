import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { publicCase } from '@/lib/dispute-view';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(`dispute-detail:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: 'Invalid case.' }, { status: 400 });
  try { const db = await getDb(); const d = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: new ObjectId(id) }); if (!d) return NextResponse.json({ error: 'Case not found.' }, { status: 404 }); return NextResponse.json({ dispute: publicCase(d) }, { headers: { 'Cache-Control': 'no-store' } }); } catch { return NextResponse.json({ error: 'The case could not be loaded.' }, { status: 503 }); }
}
