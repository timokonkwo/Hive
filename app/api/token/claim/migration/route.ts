import { claimSchedule } from '@/lib/hive-claim-schedule';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
async function forward(action: string, input: unknown) {
  const schedule = claimSchedule(process.env.HIVE_CLAIMS_OPEN_AT);
  const now = Date.now();
  const endpoint = process.env.HIVE_CLAIM_GATEWAY_URL, token = process.env.HIVE_CLAIM_GATEWAY_TOKEN;
  if (!endpoint || !token || process.env.HIVE_CLAIM_UI_ENABLED !== 'true') return NextResponse.json(action === 'availability' ? { enabled: false } : { error: 'Migration is not open.' }, { status: action === 'availability' ? 200 : 503, headers });
  if (['quote', 'register', 'deposit'].includes(action) && (!schedule || now < schedule.opensAt || now >= schedule.closesAt)) return NextResponse.json({ error: 'Claims are not open.' }, { status: 409, headers });
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error();
    if (url.username || url.password || url.search || url.hash) throw Error();
    const response = await fetch(new URL(action, url.href.replace(/\/?$/, '/')), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) return NextResponse.json({ error: 'The migration request could not be verified. Refresh the claim status or recheck your holdings.' }, { status: 409, headers });
    return NextResponse.json(await response.json(), { headers });
  } catch { return NextResponse.json(action === 'availability' ? { enabled: false } : { error: 'Migration service unavailable. Keep your saved request and retry status.' }, { status: action === 'availability' ? 200 : 503, headers }); }
}
export async function GET() { return forward('availability', {}); }
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers });
  const rate = checkRateLimit(`claim-migration:${getClientIp(request)}`, { maxRequests: 30, windowSeconds: 60 });
  if (!rate.allowed) return NextResponse.json({ error: 'Please wait before retrying.' }, { status: 429, headers });
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error();
    const reader = request.body?.getReader(); if (!reader) throw Error();
    let length = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 16384) { await reader.cancel(); throw Error(); } chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!['quote', 'register', 'status', 'deposit'].includes(data.action)) throw Error();
    return forward(data.action, data.input);
  } catch { return NextResponse.json({ error: 'Invalid migration request.' }, { status: 400, headers }); }
}
