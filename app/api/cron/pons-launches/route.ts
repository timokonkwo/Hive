import { retryManagedSubmissions } from '@/lib/agent-tokenization/managed';
import { managedDeployerStatus } from '@/lib/agent-tokenization/managed-signer';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { getDb } from '@/lib/db';
import { runLaunchRecovery } from '@/lib/agent-tokenization/worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.PONS_RECONCILIATION_ENABLED !== 'true') return NextResponse.json({ enabled: false });
  try {
    const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
    const db = await getDb();
    const result = await runLaunchRecovery(db, client, { budgetMs: 25000 });
    await retryManagedSubmissions(db, client);
    if (result.errors) console.error('[PONS] Recovery needs attention', { errors: result.errors, checked: result.checked });
    return NextResponse.json({ enabled: true, ...result, managedDeployer: managedDeployerStatus() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[PONS] Recovery service unavailable');
    return NextResponse.json({ error: 'Recovery service unavailable.' }, { status: 503 });
  }
}
