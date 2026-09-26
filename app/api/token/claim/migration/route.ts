import { localClaimTestOwner } from '@/lib/hive-local-claim-test';
import { claimSchedule, CLAIM_OPENING_TIME } from '@/lib/hive-claim-schedule';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
async function forward(action: string, input: unknown, localOwner: string | null = null) {
  const schedule = claimSchedule(process.env.HIVE_CLAIMS_OPEN_AT ?? CLAIM_OPENING_TIME);
  const now = Date.now();
  const endpoint = process.env.HIVE_CLAIM_GATEWAY_URL, token = process.env.HIVE_CLAIM_GATEWAY_TOKEN;
  if (!endpoint || !token || process.env.HIVE_CLAIM_UI_ENABLED !== 'true') return NextResponse.json(action === 'availability' ? { enabled: false } : { error: 'Migration is not open.' }, { status: action === 'availability' ? 200 : 503, headers });
  const candidate = input as { owner?: string; request?: { owner?: string } } | null;
  const inputOwner = candidate?.owner ?? candidate?.request?.owner;
  if (localOwner && action !== 'availability' && inputOwner !== localOwner) return NextResponse.json({ error: 'This local test is limited to the configured wallet.' }, { status: 403, headers });
  if (!localOwner && ['quote', 'register', 'deposit'].includes(action) && (!schedule || now < schedule.opensAt || now >= schedule.closesAt)) return NextResponse.json({ error: 'Claims are not open.' }, { status: 409, headers });
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error();
    if (url.username || url.password || url.search || url.hash) throw Error();
    const response = await fetch(new URL(action, url.href.replace(/\/?$/, '/')), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      if(action === 'availability') return NextResponse.json({enabled:false},{headers});
      if(response.status === 429 || response.status >= 500) return NextResponse.json({code:'SERVICE_UNAVAILABLE',error:'Claim service temporarily unavailable. Try again.',recovery:'check_status'},{status:503,headers});
      const issue = await response.json().catch(() => ({}));
      const safeCodes = ['REGISTRATION_NOT_FOUND', 'CLAIM_WINDOW', 'SERVICE_UNAVAILABLE', 'BALANCE_CHANGED', 'CLAIM_EXISTS', 'AUTHORIZATION_REQUIRED', 'CLAIM_UNVERIFIED'];
      return NextResponse.json(safeCodes.includes(issue.code) ? { code: issue.code, error: issue.error, recovery: issue.recovery } : { code: 'CLAIM_UNVERIFIED', error: 'Your claim could not be verified. Check its status to continue.', recovery: 'check_status' }, { status: response.status === 503 ? 503 : 409, headers });
    }
    const payload = await response.json();
    return NextResponse.json(action === 'availability' && localOwner && payload.enabled === true ? { ...payload, localTestOwner: localOwner } : payload, { headers });
  } catch { return NextResponse.json(action === 'availability' ? { enabled: false } : { error: 'Connection interrupted. Your claim is saved. Try again.' }, { status: action === 'availability' ? 200 : 503, headers }); }
}
export async function GET(request: Request) { return forward('availability', {}, localClaimTestOwner(request.url)); }
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Netlify can retain the immutable deploy origin after promotion to the custom domain.
  const hiveDeploy = url.protocol === 'https:' && (url.hostname === 'hive-protocol.netlify.app' || url.hostname.endsWith('--hive-protocol.netlify.app'));
  const publicHiveOrigin = hiveDeploy && origin === 'https://uphive.xyz';
  if (origin !== url.origin && !publicHiveOrigin) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers });
  const rate = checkRateLimit(`claim-migration:${getClientIp(request)}`, { maxRequests: 30, windowSeconds: 60 });
  if (!rate.allowed) return NextResponse.json({ error: 'Please wait before retrying.' }, { status: 429, headers });
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error();
    const reader = request.body?.getReader(); if (!reader) throw Error();
    let length = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 16384) { await reader.cancel(); throw Error(); } chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!['quote', 'register', 'status', 'deposit'].includes(data.action)) throw Error();
    return forward(data.action, data.input, localClaimTestOwner(request.url));
  } catch { return NextResponse.json({ error: 'Invalid migration request.' }, { status: 400, headers }); }
}
