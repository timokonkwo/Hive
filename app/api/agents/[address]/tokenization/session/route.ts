import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { LaunchHttpError, launchReply, readLaunchBody, withLaunchAccess } from '@/lib/agent-tokenization/http';
import { reviewSession } from '@/lib/agent-tokenization/session';
import { SessionStore } from '@/lib/agent-tokenization/session-store';
import { SessionRuntime } from '@/lib/agent-tokenization/session-runtime';
import { sessionPreview, verifiedLaunchWallets } from '@/lib/agent-tokenization/session-preview';
import { profileRevision } from '@/lib/agent-tokenization/metadata';
import { isPlatform, purchaseLamports, type PlatformId } from '@/lib/agent-tokenization/platforms';
import type { LaunchMode } from '@/lib/agent-tokenization/types';
import { withAgentProfileLease } from '@/lib/agent-tokenization/profile-lease';
import { reviseSession } from '@/lib/agent-tokenization/session-edit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Params = { params: Promise<{ address: string }> };
export async function GET(req: NextRequest, { params }: Params) {
  return withLaunchAccess(req, params, async ({ db, preview }) => {
    const agent = await db.collection('agents').findOne({ _id: new ObjectId(preview.agentId) });
    if (!agent) throw new LaunchHttpError(404, 'Agent not found.');
    const details = await sessionPreview(db, agent, preview);
    const sameRole = details.session?.role === preview.role;
    return launchReply({ ...details, readOnly: !!details.session && !sameRole,
      ...(sameRole && details.session ? await new SessionRuntime(db).response(details.session) : {}) });
  });
}
export async function POST(req: NextRequest, { params }: Params) {
  return withLaunchAccess(req, params, async ({ db, preview, origin }) => {
    if (req.headers.get('origin') !== origin) throw new LaunchHttpError(403, 'Open Hive on its configured website to continue.');
    const body = await readLaunchBody(req, ['action', 'id', 'revision', 'sessionRevision', 'symbol', 'choices', 'platform', 'stepId', 'confirmation', 'signed']);
    if (body.action === 'create' || body.action === 'revise') {
      if (typeof body.id !== 'string' || typeof body.revision !== 'string' || typeof body.symbol !== 'string'
        || !Array.isArray(body.choices) || (body.action === 'create' && body.choices.length < 1) || body.choices.length > 3) throw new LaunchHttpError(400, 'Review the selected platforms.');
      const choices = body.choices.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LaunchHttpError(400, 'Invalid platform selection.');
        const c = value as Record<string, unknown>;
        if (Object.keys(c).some(key => !['platform', 'mode', 'signer', 'purchase'].includes(key)) || !isPlatform(c.platform)
          || !['connected', 'managed'].includes(String(c.mode)) || typeof c.signer !== 'string' || typeof c.purchase !== 'string') throw new LaunchHttpError(400, 'Invalid launch settings.');
        return c as { platform: PlatformId; mode: LaunchMode; signer: string; purchase: string };
      });
      const existing = (await new SessionStore(db).current(preview.agentId))?.session;
      if (body.action === 'create' && existing?.id === body.id) {
        // Only an identical review can replay a request ID; never change the reservation.
        const same = reviewSession({ id: body.id, agentId: preview.agentId, role: preview.role, profileRevision: body.revision,
          metadata: { ...existing.metadata, symbol: body.symbol }, choices, walletPolicy: existing.walletPolicy || 'verified',
          verifiedOwnerEvm: existing.targets.find(t => t.terms.platform === 'pons')?.terms.signer || null,
          verifiedOwnerSolana: existing.targets.find(t => t.terms.platform !== 'pons')?.terms.signer || null });
        if (same.digest !== existing.digest) throw new LaunchHttpError(409, 'This request ID belongs to another review.');
        return launchReply(await new SessionRuntime(db).response(existing));
      }
      const agent = await db.collection('agents').findOne({ _id: new ObjectId(preview.agentId) });
      if (!agent || body.revision !== profileRevision(agent)) throw new LaunchHttpError(409, 'Agent details changed. Review them again.');
      const details = await sessionPreview(db, agent, preview);
      if (choices.some(choice => !details.options.some(option => option.platform === choice.platform && option.available && !option.pending && !option.token))) {
        throw new LaunchHttpError(409, 'A selected platform is unavailable. Refresh the review.');
      }
      if (choices.some(choice => choice.platform === 'pump' && purchaseLamports(choice.purchase) !== 0n
        && !details.options.find(option => option.platform === 'pump')?.purchaseAvailable)) {
        throw new LaunchHttpError(409, 'pump.fun purchases are temporarily unavailable. Try again later.');
      }
      const wallets = verifiedLaunchWallets(agent);
      const session = reviewSession({ id: body.id, agentId: preview.agentId, role: preview.role, profileRevision: body.revision,
        metadata: { ...preview.metadata, symbol: body.symbol }, choices, verifiedOwnerEvm: wallets.evm, verifiedOwnerSolana: wallets.solana,
        allowEmpty: body.action === 'revise' });
      if (body.action === 'revise') {
        return withAgentProfileLease(db, `session:${preview.agentId}`, async () => withAgentProfileLease(db, preview.agentId, async () => {
          const runtime = new SessionRuntime(db), current = await runtime.require(preview.agentId, body.id, preview.role);
          if (body.sessionRevision !== current.revision) throw new LaunchHttpError(409, 'The launch changed. Refresh before saving.');
          const latest = await db.collection('agents').findOne({ _id: new ObjectId(preview.agentId) });
          if (!latest || profileRevision(latest) !== body.revision) throw new LaunchHttpError(409, 'Agent details changed. Refresh before saving.');
          const next = await reviseSession(db, current, session);
          return launchReply(await runtime.response(await new SessionStore(db).revise(current, next)));
        }));
      }
      return launchReply({ session: await new SessionStore(db).create(session), review: null });
    }
    return launchReply(await new SessionRuntime(db).act(preview, body));
  });
}
