import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createFeeReader } from '@/lib/analytics-fees';
const read = createFeeReader(fetch, () => (process.env.BAGS_API_KEY || '').trim());
export async function GET(req: NextRequest) {
  const limit = checkRateLimit(`analytics-fees:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(limit.resetInSeconds), 'Cache-Control': 'no-store' } });
  return NextResponse.json(await read(), { headers: { 'Cache-Control': 'no-store' } });
}
