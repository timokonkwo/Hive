import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verificationId, verificationAccess, verificationView, VerificationError, type VerificationAgent } from '@/lib/agent-verification';
import { xLookupConfigured } from '@/lib/x-post-proof';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(req: NextRequest) {
  const reply = (v: unknown, status = 200) => NextResponse.json(v, { status, headers });
  try {
    const limit = checkRateLimit(`verification-status:${getClientIp(req)}`, RATE_LIMITS.READ);
    if (!limit.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
    const id = new URL(req.url).searchParams.get('id');
    if (!verificationId(id)) return reply({ error: 'This agent link is invalid.' }, 400);
    const db = await getDb(), agent = await db.collection<VerificationAgent>('agents').findOne({ _id: new ObjectId(id) });
    if (!agent) return reply({ error: 'This agent was not found.' }, 404);
    const access = verificationAccess(req.headers, agent);
    return reply(verificationView(agent, !!access, xLookupConfigured()));
  } catch (error) { return reply({ error: error instanceof VerificationError ? error.message : 'Verification status could not be loaded.' }, error instanceof VerificationError ? error.status : 500); }
}
