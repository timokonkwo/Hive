import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { LaunchStore } from '@/lib/agent-tokenization/store';
import { validHash } from '@/lib/agent-tokenization/policy';
import { acceptBroadcast, acceptCancellation } from '@/lib/agent-tokenization/worker';
import { LaunchHttpError, launchReply, readLaunchBody, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
/** Records a wallet broadcast; this endpoint never signs or sends a transaction. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview }) => {
    const body = await readLaunchBody(req, ['id', 'transactionHash', 'action']);
    if (typeof body.id !== 'string' || !validHash(body.transactionHash)) throw new LaunchHttpError(400, 'Provide the saved launch and transaction hash.');
    const store = new LaunchStore(db);
    const intent = await store.current(preview.agentId);
    if (!intent || intent._id !== body.id) throw new LaunchHttpError(409, 'The launch changed. Refresh its status.');
    if (intent.phase === 'confirmed' && intent.transactionHash?.toLowerCase() === body.transactionHash.toLowerCase()) return launchReply({ id: intent._id, phase: intent.phase });
    if (!['awaiting-signature', 'submitted', 'confirming'].includes(intent.phase)) throw new LaunchHttpError(409, 'This launch cannot accept another transaction. Refresh its status.');
    if (intent.mode === 'managed') throw new LaunchHttpError(409, 'Use the Hive deployer controls for this launch.');
    const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
    if (body.action !== undefined && body.action !== 'cancel' && body.action !== 'resume') throw new LaunchHttpError(400, 'Invalid transaction action.');
    const saved = await (body.action === 'cancel' ? acceptCancellation : acceptBroadcast)(client, store, intent, body.transactionHash);
    return launchReply({ id: saved._id, phase: saved.phase });
  });
}
