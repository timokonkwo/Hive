import { NextRequest } from 'next/server';
import { createPublicClient, http, toHex } from 'viem';
import { persistTokenAvatar } from '@/lib/agent-tokenization/avatar';
import { prepareAuthorizedLaunch } from '@/lib/agent-tokenization/preparation';
import { unpackPrepared } from '@/lib/agent-tokenization/journal';
import { LaunchHttpError, launchReply, readLaunchBody, requireLaunchRelease, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview, origin, refreshPreview }) => {
    const release = requireLaunchRelease();
    const body = await readLaunchBody(req, ['challengeId', 'signature']);
    if (typeof body.challengeId !== 'string') throw new LaunchHttpError(400, 'Authorize the selected wallet first.');
    const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
    const intent = await prepareAuthorizedLaunch(db, client, { origin, preview, challengeId: body.challengeId, signature: body.signature }, {
      release, persistAvatar: persistTokenAvatar, refreshPreview,
    });
    const prepared = intent.prepared ? unpackPrepared(intent.prepared) : null;
    if (intent.phase !== 'awaiting-signature' || !prepared || prepared.expiresAt * 1000n <= BigInt(Date.now())) {
      return launchReply({ id: intent._id, phase: intent.phase, transaction: null, transactionHash: intent.transactionHash || null });
    }
    const tx = prepared.transaction;
    return launchReply({ id: intent._id, phase: intent.phase, expiresAt: prepared.expiresAt.toString(),
      maximumNetworkFee: prepared.maximumNetworkFee.toString(), maximumTotal: prepared.maximumTotal.toString(),
      transaction: { chainId: toHex(tx.chainId), from: tx.from, to: tx.to, data: tx.data, value: toHex(tx.value), nonce: toHex(tx.nonce),
        gas: toHex(tx.gas), maxFeePerGas: toHex(tx.maxFeePerGas), maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas) } });
  });
}
