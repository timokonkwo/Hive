import { NextRequest } from 'next/server';
import { LaunchAuthorizations } from '@/lib/agent-tokenization/authorization';
import { LaunchHttpError, launchReply, readLaunchBody, requireLaunchRelease, withLaunchAccess } from '@/lib/agent-tokenization/http';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview, origin }) => {
    requireLaunchRelease();
    const body = await readLaunchBody(req, ['signer', 'symbol', 'purchase']);
    if (typeof body.signer !== 'string' || typeof body.symbol !== 'string' || typeof body.purchase !== 'string') throw new LaunchHttpError(400, 'Choose a wallet, ticker and opening purchase.');
    const challenge = await new LaunchAuthorizations(db, origin).issue(preview, body.signer, { symbol: body.symbol, purchase: body.purchase });
    return launchReply(challenge);
  });
}
