import { randomUUID } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';
import { createPublicClient, http } from 'viem';
import { SessionStore } from './session-store';
import { SessionConflict, continueSession, sessionComplete, nextTarget, transitionTarget, type LaunchSession, type TargetResult } from './session';
import { SolanaLaunchRuntime } from './solana-runtime';
import { LaunchStore, LaunchConflict } from './store';
import { runLaunchRecovery } from './worker';
import type { LaunchPreview } from './types';
import type { PlatformId } from './platforms';
import { solanaLaunchesEnabled, verifiedLaunchWallets } from './session-preview';
import { withAgentProfileLease } from './profile-lease';
import { approved, approveSession, estimateSession, reserveSpend, prepareSessionPons, confirmSessionPons } from './session-approval';
import { editablePlatforms } from './session-edit';
import { unpackPrepared } from './journal';
import { profilePreview, profileRevision } from './metadata';
import { broadcastManagedSubmission } from './managed';
import { ponsClient } from './session-approval';

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
    if (session.paused && target.error && !result.error) result = { ...result, error: target.error };
    if (target.phase === result.phase && (!result.intentId || target.intentId === result.intentId) && target.error === result.error) return session;
    if (target.phase === result.phase) return this.store.save(session, { ...session, revision: session.revision + 1,
      targets: session.targets.map(t => t === target ? { ...t, ...result } : t) });
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
    if (session.approval && sessionComplete(session)) session = await this.store.save(session, { ...session, approval: undefined, revision: session.revision + 1 });
    if (session.approval && Date.parse(session.approval.expiresAt) <= Date.now()) session = await this.store.save(session, { ...session, paused: true, approval: undefined, revision: session.revision + 1 });
    return session;
  }
  async response(session: LaunchSession) {
    const target = session.targets.find(t => t.terms.platform !== 'pons' && !['confirmed', 'failed', 'skipped', 'queued'].includes(t.phase));
    return { session, review: target ? await this.solana.review(target) : null, editablePlatforms: await editablePlatforms(this.db, session) };
  }
  /** One bounded unit of durable execution. Invoked by authenticated UI or scheduled recovery. */
  private async advance(session: LaunchSession, preview: LaunchPreview, assertHeld: () => Promise<void>) {
    if (!approved(session)) return session;
    let target = nextTarget(session);
    if (!target || ['submitted', 'confirming', 'blocked', 'failed'].includes(target.phase)) {
      if (target && ['submitted', 'confirming'].includes(target.phase) && target.terms.platform !== 'pons') await this.solana.rebroadcast(target);
      if (target?.terms.platform === 'pons' && target.terms.mode === 'managed' && ['submitted', 'confirming'].includes(target.phase)) {
        const intent = await new LaunchStore(this.db).current(session.agentId);
        if (intent?.managedSubmission) await broadcastManagedSubmission(ponsClient(), intent);
      }
      return session;
    }
    const agent = await this.db.collection('agents').findOne({ _id: new ObjectId(session.agentId) });
    if (!agent || agent.status !== 'active') throw new SessionConflict('This agent is no longer available for launching.');
    const platform = target.terms.platform;
    if (platform !== 'pons' && !solanaLaunchesEnabled(platform)) throw new SessionConflict('This platform is temporarily unavailable.');
    if (session.role === 'owner') {
      const wallets = verifiedLaunchWallets(agent);
      if ((platform === 'pons' ? wallets.evm?.toLowerCase() : wallets.solana) !== target.terms.signer) throw new SessionConflict('The verified launch wallet changed.');
    }
    if (target.phase === 'queued') {
      session = await this.update(session, platform, { phase: 'preparing', ...(platform !== 'pons' ? { intentId: target.intentId || randomUUID() } : {}) });
      target = session.targets.find(t => t.terms.platform === platform)!;
    }
    if (platform === 'pons') {
      if (target.terms.mode !== 'managed') return session;
      if (session.role !== 'admin') throw new SessionConflict('Only admins can use Hive deployer.');
      const prepared = await prepareSessionPons(this.db, session, preview);
      session = await this.update(session, platform, { phase: 'awaiting-signature', intentId: prepared.intent._id });
      if (!prepared.intent.prepared) throw new SessionConflict('Pons could not prepare this launch.');
      const reserved = reserveSpend(session, platform, prepared.intent.prepared.digest, unpackPrepared(prepared.intent.prepared).maximumTotal.toString());
      if (reserved !== session) session = await this.store.save(session, reserved);
      await assertHeld();
      await confirmSessionPons(this.db, prepared);
      return this.update(session, platform, { phase: 'submitted' });
    }
    const step = await this.solana.prepare(session, target, preview, { retryFailed: true });
    session = await this.update(session, platform, await this.solana.reconcile(session, target));
    if (!step || step.phase !== 'review' || target.terms.mode !== 'managed') return session;
    const reserved = reserveSpend(session, platform, `${step._id}:${step.review.digest}`, step.review.maximumDebit);
    if (reserved !== session) session = await this.store.save(session, reserved);
    await assertHeld();
    await this.solana.confirm(session, target, step._id, step.review.digest);
    return this.update(session, platform, { phase: 'submitted' });
  }
  async act(preview: LaunchPreview, body: Record<string, unknown>) {
    return withAgentProfileLease(this.db, `session:${preview.agentId}`, async assertHeld => {
      let session = await this.require(preview.agentId, body.id, preview.role);
      if (body.action === 'pause') {
        session = await this.store.save(session, { ...session, paused: true, editing: true, approval: undefined, estimate: undefined, revision: session.revision + 1,
          targets: session.targets.map(t => t.intentId ? { ...t, metadata: t.metadata || session.metadata } : t) });
        return this.response(session);
      }
      session = await this.reconcile(session);
      if (body.action === 'check') return this.response(session);
      if (body.action === 'estimate') {
        if (approved(session)) throw new SessionConflict('Pause before changing this launch.');
        const failed = session.targets.find(t => t.phase === 'failed');
        if (failed) session = await this.store.save(session, continueSession(session, { platform: failed.terms.platform, action: 'retry' }));
        if (session.editing && session.profileRevision !== profileRevision(await this.db.collection('agents').findOne({ _id: new ObjectId(session.agentId) }) || {})) throw new SessionConflict('Save the edited launch details before continuing.');
        // A saved setup may have finished since the last review. Check its next
        // unsigned transaction before asking for another execution approval.
        const target = session.targets.find(t => !['confirmed', 'skipped'].includes(t.phase));
        try {
          if (target?.intentId && target.terms.platform !== 'pons' && ['preparing', 'awaiting-signature'].includes(target.phase)) {
            await this.solana.prepare(session, target, preview, { retryFailed: true, refreshReview: true });
          }
        } catch (error) {
          if (!(error instanceof SessionConflict) && !(error instanceof LaunchConflict)) throw error;
          session = await this.store.save(session, { ...session, paused: true, approval: undefined, estimate: undefined, revision: session.revision + 1,
            targets: session.targets.map(t => t === target ? { ...t, error: error.message } : t) });
          return this.response(session);
        }
        const estimate = await estimateSession(session, preview);
        await assertHeld();
        session = await this.store.save(session, { ...session, estimate, revision: session.revision + 1,
          targets: session.targets.map(t => ({ ...t, error: undefined })) });
        return this.response(session);
      }
      if (body.action === 'approve') {
        if (!approved(session)) session = await this.store.save(session, approveSession(session, body.confirmation));
        return this.response(session);
      }
      if (body.action === 'advance') {
        try { session = await this.advance(session, preview, assertHeld); }
        catch (error) {
          // No blind retries after a signing/preparation error. Reconcile the journal before the next approval.
          session = await this.require(preview.agentId, body.id, preview.role);
          const message = error instanceof SessionConflict || error instanceof LaunchConflict ? error.message : 'Launch interrupted. Review the remaining platforms to continue.';
          const target = nextTarget(session);
          session = await this.store.save(session, { ...session, paused: true, approval: undefined, revision: session.revision + 1,
            targets: session.targets.map(t => t === target ? { ...t, error: message } : t) });
        }
        return this.response(session);
      }
      if (body.action === 'retry' || body.action === 'skip' || body.action === 'continue') {
        const platform = body.platform as PlatformId;
        const next = continueSession(session, body.action === 'continue' ? undefined : { platform, action: body.action });
        session = await this.store.save(session, next);
        if (body.action !== 'retry') return this.response(session);
      }
      if (sessionComplete(session)) return this.response(session);
      if (session.editing && ['prepare', 'retry', 'confirm'].includes(String(body.action))) throw new SessionConflict('Finish editing and review the launch first.');
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
          await this.solana.prepare(session, active, preview, { retryFailed: body.action === 'retry' });
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
        if (session.approval) {
          const step = await this.solana.pendingStep(target);
          if (!step) throw new SessionConflict('Prepare the transaction first.');
          const reserved = reserveSpend(session, platform, `${step._id}:${step.review.digest}`, step.review.maximumDebit);
          if (reserved !== session) session = await this.store.save(session, reserved);
        }
        await this.solana.confirm(session, target, body.stepId, body.confirmation, typeof body.signed === 'string' ? body.signed : undefined);
        await assertHeld();
        session = await this.update(session, platform, { phase: 'submitted' });
      } else throw new SessionConflict('Choose a launch action.');
      return this.response(session);
    });
  }
}

/** Legacy sessions only reconcile. Explicit, unexpired approvals can advance without an open browser. */
export async function recoverLaunchSessions(db: Db, budgetMs = 25_000, runtime = new SessionRuntime(db)) {
  const deadline = Date.now() + budgetMs;
  const records = await db.collection<{ _id: string; session: LaunchSession }>('agent_launch_sessions').find({ $or: [
    // A process can stop after persisting signed bytes but before updating the session.
    // Reconciliation only reads journals/receipts, including when the UI still says review.
    { 'session.targets.phase': { $in: ['preparing', 'awaiting-signature', 'submitted', 'confirming', 'blocked'] } }, { 'session.approval.digest': { $type: 'string' }, 'session.paused': false }, { projectionPending: true },
  ] }).sort({ recoveredAt: 1, updatedAt: 1 }).limit(5).toArray();
  let checked = 0, errors = 0;
  for (const record of records) {
    if (Date.now() >= deadline) break;
    try {
      let current: LaunchSession | undefined;
      await withAgentProfileLease(db, `session:${record._id}`, async () => {
        const session = await runtime.require(record._id, record.session.id, record.session.role);
        current = await runtime.reconcile(session);
      });
      if (current && approved(current) && Date.now() < deadline) {
        const agent = await db.collection('agents').findOne({ _id: new ObjectId(record._id) });
        if (agent) await runtime.act(profilePreview(record._id, agent, current.role), { action: 'advance', id: current.id });
      }
      checked++;
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
