import { NextRequest } from 'next/server';
import { createPublicClient, http, toHex } from 'viem';
import { LaunchStore } from '@/lib/agent-tokenization/store';
import { reviewSavedLaunch } from '@/lib/agent-tokenization/resume';
import { requireLaunchRelease, LaunchHttpError, launchReply, readLaunchBody, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: Promise<{ address:string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview }) => {
    const body = await readLaunchBody(req,['id','action']);
    if (typeof body.id !== 'string' || !['resume','cancel'].includes(String(body.action))) throw new LaunchHttpError(400,'Choose a saved launch action.');
    const action = body.action as 'resume'|'cancel';
    const release = action === 'resume' ? requireLaunchRelease() : null;
    const store = new LaunchStore(db), intent = await store.current(preview.agentId);
    if (!intent || intent._id !== body.id) throw new LaunchHttpError(409,'The launch changed. Refresh its status.');
    if (intent.mode === 'managed') throw new LaunchHttpError(409, 'Use the Hive deployer controls for this launch.');
    const client = createPublicClient({ transport:http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',{timeout:8000,retryCount:0}) });
    const result = await reviewSavedLaunch(client,store,intent,action,release);
    const tx=result.transaction;
    return launchReply({ id:intent._id, phase:intent.phase, action, expiresAt:result.expiresAt.toString(), maximumNetworkFee:result.maximumNetworkFee.toString(), maximumTotal:result.maximumTotal.toString(),
      transaction:{chainId:toHex(tx.chainId),from:tx.from,to:tx.to,data:tx.data,value:toHex(tx.value),nonce:toHex(tx.nonce),gas:toHex(tx.gas),maxFeePerGas:toHex(tx.maxFeePerGas),maxPriorityFeePerGas:toHex(tx.maxPriorityFeePerGas)} });
  });
}
