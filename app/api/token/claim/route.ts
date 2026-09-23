import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { publicSolanaAddress } from '@/lib/hive-reimbursement';
import { getReimbursementLookup } from '@/lib/hive-reimbursement-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const rate = checkRateLimit(`reimbursement:${getClientIp(request)}`, { maxRequests: 20, windowSeconds: 60 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many lookups. Please try again in a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': String(rate.resetInSeconds) } });
  const values = new URL(request.url).searchParams.getAll('owner');
  let owner: string;
  try { if (values.length !== 1) throw Error(); owner = publicSolanaAddress(values[0].trim()); }
  catch { return NextResponse.json({ error: 'Enter a valid public Solana wallet address.' }, { status: 400, headers }); }
  try { return NextResponse.json(await getReimbursementLookup(owner), { headers }); }
  catch { return NextResponse.json({ error: 'The snapshot lookup is unavailable. Please try again.' }, { status: 503, headers }); }
}
