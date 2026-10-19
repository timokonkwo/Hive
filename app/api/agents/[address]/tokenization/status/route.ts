import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authorizeTokenization } from '@/lib/agent-tokenization/access';
import { launchesEnabled } from '@/lib/agent-tokenization/release';
import { LaunchStore } from '@/lib/agent-tokenization/store';
import { runLaunchRecovery } from '@/lib/agent-tokenization/worker';
import { createPublicClient, http } from 'viem';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  if (!checkRateLimit(`pons-status:${getClientIp(req)}`, RATE_LIMITS.READ).allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
  const { address: agentId } = await params;
  const role = req.nextUrl.searchParams.get('role');
  if (!/^[a-f0-9]{24}$/i.test(agentId) || (role !== 'owner' && role !== 'admin')) return reply({ error: 'Invalid agent or launch role.' }, 400);
  try {
    const db = await getDb();
    const denied = await authorizeTokenization(req, db, agentId, role);
    if (denied) return denied;
    const store = new LaunchStore(db);
    let launch = await store.current(agentId);
    if (launch && process.env.PONS_RECONCILIATION_ENABLED === 'true'
      && (['awaiting-signature', 'submitted', 'confirming'].includes(launch.phase) || (launch.phase === 'confirmed' && !launch.projected))) {
      // Check only this authenticated agent. The shared lease and next-check time
      // fence concurrent browser polls and the scheduled worker. Never broadcast.
      const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 2500, retryCount: 0 }) });
      await runLaunchRecovery(db, client, { agentId, limit: 1, budgetMs: 8000 });
      launch = await store.current(agentId);
    }
    return reply({ signingEnabled: launchesEnabled(), launch: launch ? {
      id: launch._id, mode: launch.mode || 'connected', phase: launch.phase, signer: launch.signer, role: launch.preview.role,
      transactionHash: launch.transactionHash || null, cancellationHash: launch.cancellationHash || null,
      token: launch.phase === 'confirmed' ? launch.token || null : null,
      canRetry: launch.phase === 'reverted' || launch.phase === 'cancelled',
      canCancel: launch.phase === 'draft', updatedAt: launch.updatedAt.toISOString(),
    } : null });
  } catch { return reply({ error: 'Launch status is unavailable. Try again.' }, 503); }
}
