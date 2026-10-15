import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type Db } from 'mongodb';
import { getDb } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { authorizeTokenization } from './access';
import { profilePreview } from './metadata';
import { LaunchAuthorizationError } from './authorization';
import { LaunchConflict } from './store';
import { reviewedLaunchRelease, launchesEnabled } from './release';
import type { LaunchPreview } from './types';

export class LaunchHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export const launchReply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function readLaunchBody(req: NextRequest, allowedKeys: string[], maxBytes = 8192) {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new LaunchHttpError(415, 'Send a JSON request.');
  const reader = req.body?.getReader();
  if (!reader) throw new LaunchHttpError(400, 'Missing request body.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new LaunchHttpError(413, 'Request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new LaunchHttpError(400, 'Invalid JSON request.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).some(key => !allowedKeys.includes(key))) throw new LaunchHttpError(400, 'Invalid launch request.');
  return parsed as Record<string, unknown>;
}

export function requireLaunchRelease() {
  if (!launchesEnabled() || !reviewedLaunchRelease?.reviewed) throw new LaunchHttpError(503, 'Token launches are not available yet.');
  return reviewedLaunchRelease;
}

type Context = { db: Db; preview: LaunchPreview; origin: string; refreshPreview: () => Promise<LaunchPreview> };
export async function withLaunchAccess(req: NextRequest, params: Promise<{ address: string }>, operation: (context: Context) => Promise<NextResponse>) {
  try {
    if (!checkRateLimit(`pons-launch:${getClientIp(req)}`, { maxRequests: 20, windowSeconds: 60 }).allowed) throw new LaunchHttpError(429, 'Too many requests. Try again shortly.');
    const { address } = await params;
    const role = req.nextUrl.searchParams.get('role');
    if (!/^[a-f0-9]{24}$/i.test(address) || (role !== 'owner' && role !== 'admin')) throw new LaunchHttpError(400, 'Invalid agent or launch role.');
    const agentId = address.toLowerCase();
    const origin = process.env.PONS_APP_ORIGIN || 'https://uphive.xyz';
    const supplied = req.headers.get('origin');
    if (supplied && supplied !== origin) throw new LaunchHttpError(403, 'Open Hive on its configured website to continue.');
    const db = await getDb();
    const denied = await authorizeTokenization(req, db, agentId, role);
    if (denied) return denied;
    const refreshPreview = async () => {
      const agent = await db.collection('agents').findOne({ _id: new ObjectId(agentId) });
      if (!agent) throw new LaunchHttpError(404, 'Agent not found.');
      return profilePreview(agentId, agent, role);
    };
    return await operation({ db, preview: await refreshPreview(), origin, refreshPreview });
  } catch (error) {
    if (error instanceof LaunchHttpError) return launchReply({ error: error.message }, error.status);
    if (error instanceof LaunchAuthorizationError) return launchReply({ error: error.message }, 400);
    if (error instanceof LaunchConflict) return launchReply({ error: error.message }, 409);
    // Provider exceptions can contain URLs/credentials. Never return or log their raw payloads.
    return launchReply({ error: 'The launch could not be prepared. Check its status before trying again.' }, 503);
  }
}
