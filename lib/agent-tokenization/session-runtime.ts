import { randomUUID } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';
import { createPublicClient, http } from 'viem';
import { SessionStore } from './session-store';
import { SessionConflict, continueSession, sessionComplete, nextTarget, transitionTarget, type LaunchSession, type TargetResult } from './session';
import { SolanaLaunchRuntime } from './solana-runtime';
import { LaunchStore } from './store';
import { runLaunchRecovery } from './worker';
import type { LaunchPreview } from './types';
import type { PlatformId } from './platforms';
import { solanaLaunchesEnabled, verifiedLaunchWallets } from './session-preview';
import { withAgentProfileLease } from './profile-lease';

export class SessionRuntime {
  private readonly store: SessionStore;
  private readonly solana: SolanaLaunchRuntime;
  constructor(private readonly db: Db) { this.store = new SessionStore(db); this.solana = new SolanaLaunchRuntime(db); }
  async require(agentId: string, id: unknown, role: string) {
    const session = (await this.store.current(agentId))?.session;
    if (!session || session.id !== id || session.role !== role) throw new SessionConflict('The launch session changed. Refresh its status.');
    return session;
  }
  private async update(session: LaunchSession, platform: PlatformId, result: TargetResult) {
    const target = session.targets.find(t => t.terms.platform === platform)!;
    if (target.phase === result.phase && (!result.intentId || target.intentId === result.intentId)) return session;
    return this.store.save(session, transitionTarget(session, platform, result));
  }
  async reconcile(session: LaunchSession) {
    for (const target of session.targets) {
      if (target.phase === 'confirmed') { await this.store.publish(session.agentId, target.terms.platform); continue; }
      if (['failed', 'skipped', 'queued'].includes(target.phase)) continue;
      if (target.terms.platform === 'pons') {
        const store = new LaunchStore(this.db), intent = await store.current(session.agentId);
        if (!intent || intent.preview.sessionId !== session.id) continue;
        if (!target.intentId && ['cancelled', 'reverted'].includes(intent.phase)) continue;
        if (target.intentId && target.intentId !== intent._id) throw new SessionConflict('The Pons journal changed.');
        const client = createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
        await runLaunchRecovery(this.db, client, { agentId: session.agentId, limit: 1, budgetMs: 8000 });
        const current = await store.current(session.agentId);
        if (!current) continue;
        const phase = current.phase === 'confirmed' ? 'confirmed' : (current.phase === 'cancelled' || current.phase === 'reverted') ? 'failed'
          : current.phase === 'draft' ? 'preparing' : current.phase;
        session = await this.update(session, 'pons', { phase, intentId: current._id,
          ...(current.token ? { token: { ...current.token, platform: 'pons', network: 'robinhood' } } : {}),
          ...(phase === 'failed' ? { error: 'The Pons transaction did not launch a token.' } : {}) });
      } else {
        session = await this.update(session, target.terms.platform, await this.solana.reconcile(session, target));
      }
      if (session.targets.find(t => t.terms.platform === target.terms.platform)?.phase === 'confirmed') await this.store.publish(session.agentId, target.terms.platform);
    }
    return session;
  }
  async response(session: LaunchSession) {
    const target = session.targets.find(t => t.terms.platform !== 'pons' && !['confirmed', 'failed', 'skipped', 'queued'].includes(t.phase));
    return { session, review: target ? await this.solana.review(target) : null };
  }
  async act(preview: LaunchPreview, body: Record<string, unknown>) {
    return withAgentProfileLease(this.db, `session:${preview.agentId}`, async assertHeld => {
      let session = await this.require(preview.agentId, body.id, preview.role);
      session = await this.reconcile(session);
      if (body.action === 'check') return this.response(session);
      if (body.action === 'retry' || body.action === 'skip' || body.action === 'continue') {
        const platform = body.platform as PlatformId;
        const next = continueSession(session, body.action === 'continue' ? undefined : { platform, action: body.action });
        session = await this.store.save(session, next);
        if (body.action !== 'retry') return this.response(session);
      }
      if (sessionComplete(session)) return this.response(session);
      const target = nextTarget(session) || session.targets.find(t => ['preparing', 'awaiting-signature', 'submitted', 'confirming'].includes(t.phase));
      if (!target) throw new SessionConflict('Resolve the current launch before continuing.');
      const platform = target.terms.platform;
      if (['prepare', 'retry', 'confirm'].includes(String(body.action))) {
        const agent = await this.db.collection('agents').findOne({ _id: new ObjectId(session.agentId) });
        if (!agent || agent.status !== 'active') throw new SessionConflict('This agent is not available for new launches. Saved transactions can still be checked.');
        if (session.role === 'owner') {
          const wallets = verifiedLaunchWallets(agent);
          const selected = platform === 'pons' ? wallets.evm?.toLowerCase() : wallets.solana;
          if (selected !== target.terms.signer) throw new SessionConflict('The verified agent wallet changed. Check saved transactions before continuing.');
        }
      }
      if (body.action === 'prepare' || body.action === 'retry') {
        if (platform !== 'pons' && !solanaLaunchesEnabled(platform)) throw new SessionConflict('This platform is not enabled for new transactions.');
        if (target.phase === 'queued') session = await this.update(session, platform, { phase: 'preparing', ...(platform !== 'pons' ? { intentId: target.intentId || randomUUID() } : {}) });
        const active = session.targets.find(t => t.terms.platform === platform)!;
        if (platform === 'pons') return { ...await this.response(session), pons: true };
        try {
          await this.solana.prepare(session, active, preview, body.action === 'retry');
          await assertHeld();
          session = await this.update(session, platform, await this.solana.reconcile(session, active));
        } catch (error) {
          // Preparation errors never prove a broadcast failed. Preserve the same mint/journal.
          if (error instanceof SessionConflict) throw error;
          throw new SessionConflict('Preparation could not finish. Check status, then resume this launch.');
        }
      } else if (body.action === 'rebroadcast') {
        if (platform === 'pons') throw new SessionConflict('Resume the Pons launch to retry submission.');
        await this.solana.rebroadcast(target);
      } else if (body.action === 'confirm') {
        if (platform === 'pons') throw new SessionConflict('Use the Pons transaction review.');
        if (!solanaLaunchesEnabled(platform)) throw new SessionConflict('New signatures are temporarily unavailable.');
        if (typeof body.stepId !== 'string' || typeof body.confirmation !== 'string') throw new SessionConflict('Review the transaction first.');
        await this.solana.confirm(session, target, body.stepId, body.confirmation, typeof body.signed === 'string' ? body.signed : undefined);
        await assertHeld();
        session = await this.update(session, platform, { phase: 'submitted' });
      } else throw new SessionConflict('Choose a launch action.');
      return this.response(session);
    });
  }
}

/** Scheduled recovery only reconciles saved results; it never allocates a mint, signs, or advances a queued target. */
export async function recoverLaunchSessions(db: Db, budgetMs = 25_000, runtime = new SessionRuntime(db)) {
  const deadline = Date.now() + budgetMs;
  const records = await db.collection<{ _id: string; session: LaunchSession }>('agent_launch_sessions').find({ $or: [
    // A process can stop after persisting signed bytes but before updating the session.
    // Reconciliation only reads journals/receipts, including when the UI still says review.
    { 'session.targets.phase': { $in: ['preparing', 'awaiting-signature', 'submitted', 'confirming', 'blocked'] } }, { projectionPending: true },
  ] }).sort({ recoveredAt: 1, updatedAt: 1 }).limit(5).toArray();
  let checked = 0, errors = 0;
  for (const record of records) {
    if (Date.now() >= deadline) break;
    try {
      await withAgentProfileLease(db, `session:${record._id}`, async () => {
        const session = await runtime.require(record._id, record.session.id, record.session.role);
        await runtime.reconcile(session);
      }); checked++;
    } catch { errors++; }
    finally {
      // Rotate unchanged reviews too, so abandoned tabs cannot starve submitted launches.
      await db.collection<{ _id: string; session: LaunchSession; recoveredAt?: Date }>('agent_launch_sessions').updateOne(
        { _id: record._id, 'session.id': record.session.id },
        { $set: { recoveredAt: new Date() } },
      );
    }
  }
  return { checked, errors };
}
