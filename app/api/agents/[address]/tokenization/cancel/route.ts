import { NextRequest } from 'next/server';
import { LaunchStore } from '@/lib/agent-tokenization/store';
import { LaunchHttpError, launchReply, readLaunchBody, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
/** Cancelling is allowed while launches are paused, but only before wallet exposure. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview }) => {
    const body = await readLaunchBody(req, ['id']);
    const store = new LaunchStore(db);
    const intent = await store.current(preview.agentId);
    if (!intent || typeof body.id !== 'string' || intent._id !== body.id) throw new LaunchHttpError(409, 'The launch changed. Refresh its status.');
    if (intent.mode === 'managed') throw new LaunchHttpError(409, 'Use the Hive deployer controls for this launch.');
    if (intent.phase !== 'cancelled') await store.cancelDraft(intent);
    return launchReply({ id: intent._id, phase: 'cancelled' });
  });
}
