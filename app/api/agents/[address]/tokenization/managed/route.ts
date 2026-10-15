import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { persistTokenAvatar } from '@/lib/agent-tokenization/avatar';
import { LaunchStore } from '@/lib/agent-tokenization/store';
import { prepareManagedLaunch, refreshManagedLaunch, confirmManagedLaunch, discardManagedLaunch, managedQuote, broadcastManagedSubmission } from '@/lib/agent-tokenization/managed';
import { LaunchHttpError, launchReply, readLaunchBody, requireLaunchRelease, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview, origin, refreshPreview }) => {
    if (preview.role !== 'admin') throw new LaunchHttpError(403, 'Only admins can use Hive deployer.');
    if (req.headers.get('origin') !== origin) throw new LaunchHttpError(403, 'Open Hive on its configured website to continue.');
    const body = await readLaunchBody(req, ['action', 'id', 'symbol', 'purchase', 'confirmation']);
    const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
    if (body.action === 'prepare') {
      if (typeof body.symbol !== 'string' || typeof body.purchase !== 'string') throw new LaunchHttpError(400, 'Choose a ticker and opening purchase.');
      const launch = await prepareManagedLaunch(db, client, preview, { symbol: body.symbol, purchase: body.purchase }, {
        release: requireLaunchRelease(), persistAvatar: persistTokenAvatar, refreshPreview,
      });
      return launchReply(managedQuote(launch));
    }
    const store = new LaunchStore(db), launch = await store.current(preview.agentId);
    if (!launch || body.id !== launch._id || launch.mode !== 'managed') throw new LaunchHttpError(409, 'The launch changed. Refresh its status.');
    if (body.action === 'discard') {
      await discardManagedLaunch(db, launch);
      return launchReply({ id: launch._id, phase: 'cancelled' });
    }
    if (body.action === 'retry') {
      if (!['submitted', 'confirming', 'awaiting-signature'].includes(launch.phase)) return launchReply({ id: launch._id, phase: launch.phase });
      const broadcast = await broadcastManagedSubmission(client, launch);
      return launchReply({ id: launch._id, phase: launch.phase, transactionHash: launch.transactionHash, broadcast });
    }
    if (body.action !== 'refresh' && body.action !== 'confirm') throw new LaunchHttpError(400, 'Choose a launch action.');
    const services = { release: requireLaunchRelease(), persistAvatar: persistTokenAvatar, refreshPreview };
    if (body.action === 'refresh') return launchReply(managedQuote(await refreshManagedLaunch(db, client, launch, services)));
    const saved = await confirmManagedLaunch(db, client, launch, body.confirmation, services);
    return launchReply({ id: saved._id, phase: saved.phase, transactionHash: saved.transactionHash });
  });
}
