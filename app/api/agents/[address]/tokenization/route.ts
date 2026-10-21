import { sessionPonsPreview } from '@/lib/agent-tokenization/session-access';
import { managedDeployerStatus } from '@/lib/agent-tokenization/managed-signer';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { authorizeTokenization } from '@/lib/agent-tokenization/access';
import { launchesEnabled } from '@/lib/agent-tokenization/release';
import { profilePreview } from '@/lib/agent-tokenization/metadata';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

/** Preview only. No launch reservation, uploads, signatures or spending. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const rate = checkRateLimit(`pons-preview:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!rate.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
  const { address: agentId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(agentId)) return reply({ error: 'Invalid agent ID.' }, 400);
  const role = req.nextUrl.searchParams.get('role');
  if (role !== 'owner' && role !== 'admin') return reply({ error: 'Choose an owner or admin launch.' }, 400);
  try {
    const db = await getDb();
    const denied = await authorizeTokenization(req, db, agentId, role);
    if (denied) return denied;
    const agent = await db.collection('agents').findOne({ _id: new ObjectId(agentId) });
    if (!agent) return reply({ error: 'Agent not found.' }, 404);
    return reply({ ...await sessionPonsPreview(db, profilePreview(agentId, agent, role), req.nextUrl.searchParams.get('session') || undefined), signingEnabled: launchesEnabled(), ...(role === 'admin' ? { managedDeployer: managedDeployerStatus() } : {}) });
  } catch (error) {
    logger.error('[PONS] Preview unavailable', error);
    return reply({ error: 'Token details could not be loaded. Try again.' }, 503);
  }
}
