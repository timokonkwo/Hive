import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { normalizeAgentWallet, verifyAgentWalletProof, consumeAgentWalletProof } from '@/lib/agent-wallet-proof';
import { logger } from '@/lib/logger';
const headers = { 'Cache-Control': 'private, no-store' };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
function view(a: Record<string, unknown>) {
  return { agentId: a.id, name: a.name, avatarSeed: a.avatarSeed || null, revision: a.walletRevision || 0,
    robinhood: { address: a.walletAddress || null, verifiedAt: a.walletAddressVerifiedAt || null },
    solana: { address: a.solanaAddress || null, verifiedAt: a.solanaAddressVerifiedAt || null } };
}
export async function GET(req: NextRequest) {
  try {
    const limit = checkRateLimit(`agent-wallet-read:${getClientIp(req)}`, RATE_LIMITS.READ);
    if (!limit.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
    const db = await getDb(), auth = await authenticateRequest(req.headers, db);
    if (!auth) return reply({ error: 'Sign in to manage this agent.' }, 401);
    if (req.nextUrl.searchParams.get('agentId') !== auth.agent.id) return reply({ error: 'This key belongs to another agent.' }, 403);
    return reply(view(auth.agent));
  } catch (error) { logger.error('[HIVE] Read agent wallets', error); return reply({ error: 'Wallets could not be loaded.' }, 500); }
}
export async function PATCH(req: NextRequest) {
  try {
    const limit = checkRateLimit(`agent-wallet-write:${getClientIp(req)}`, RATE_LIMITS.MANAGE_BID);
    if (!limit.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
    const db = await getDb(), auth = await authenticateRequest(req.headers, db);
    if (!auth) return reply({ error: 'Sign in to manage this agent.' }, 401);
    let body; try { body = await req.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }
    const a = auth.agent;
    if (!body || body.agentId !== a.id) return reply({ error: 'This key belongs to another agent.' }, 403);
    const { network, revision } = body;
    if (!['robinhood', 'solana'].includes(network) || !Number.isSafeInteger(revision) || revision < 0) return reply({ error: 'Refresh wallet settings before saving.' }, 400);
    const field = network === 'robinhood' ? 'walletAddress' : 'solanaAddress', verifiedField = field + 'VerifiedAt', previous = a[field] || null;
    if (revision !== (a.walletRevision || 0) || body.previous !== previous) return reply({ error: 'Wallet settings changed. Refresh before saving.' }, 409);
    const remove = body.address === null;
    if (remove && (network !== 'solana' || !previous)) return reply({ error: 'This wallet cannot be removed here.' }, 400);
    let address: string | null = null;
    if (!remove) {
      try {
        address = normalizeAgentWallet(network, body.address);
        if (network === 'robinhood' && previous && previous.toLowerCase() !== address) return reply({ error: 'The primary wallet cannot be replaced here. Use account recovery.' }, 409);
        const digest = await verifyAgentWalletProof({ agentId: a.id, network, address, previous, revision }, body.proof);
        await consumeAgentWalletProof(db, digest);
      } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Wallet verification failed.' }, 400); }
    }
    const verifiedAt = remove ? null : new Date();
    const saved = await db.collection('agents').updateOne({ _id: new ObjectId(a.id),
      walletRevision: a.walletRevision === undefined ? { $exists: false } : a.walletRevision,
      [field]: a[field] === undefined ? { $exists: false } : a[field],
    }, { $set: { [field]: address, [verifiedField]: verifiedAt, walletRevision: revision + 1, updatedAt: new Date() } });
    if (saved.matchedCount !== 1) return reply({ error: 'Wallet settings changed. Refresh and sign again.' }, 409);
    return reply({ success: true, ...view({ ...a, [field]: address, [verifiedField]: verifiedAt, walletRevision: revision + 1 }) });
  } catch (error) { logger.error('[HIVE] Save agent wallet', error); return reply({ error: 'The wallet change could not be confirmed. Refresh wallet settings.' }, 500); }
}
