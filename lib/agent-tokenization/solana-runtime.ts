import type { Db } from 'mongodb';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import type { LaunchPreview } from './types';
import { SessionConflict, type LaunchSession, type SessionTarget } from './session';
import { SolanaJournal, reviewSolanaTransaction, type SolanaStep } from './solana-journal';
import { reservePumpMint, buildPumpLaunch, verifyPumpLaunch } from './pump';
import { BagsLaunchApi, prepareBagsConfiguration, prepareBagsLaunch, reserveBagsMetadata } from './bags';
import { bagsAuthority, validateBagsTransaction, verifyBagsConfiguration, verifyBagsLaunch, type BagsTerms } from './bags-validation';
import { persistTokenAvatar } from './avatar';
import { persistSolanaMetadata } from './solana-metadata';
import { signManagedSolana } from './solana-signer';
import { withAgentProfileLease } from './profile-lease';
import { bagsSetupStepId, refreshBagsSetupPlan, restoreBagsSetupStep, type BagsSetupPlan } from './bags-setup';

interface SolanaIntent {
  _id: string; sessionId: string; agentId: string; platform: 'pump' | 'bags'; image?: string; mint?: string; uri?: string;
  config?: string; authority?: string; setupSteps: string[]; launchStep?: string; createdAt: Date;
  bagsPlan?: BagsSetupPlan;
}
export const launchConnection = () => new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
  commitment: 'confirmed', confirmTransactionInitialTimeout: 15_000, disableRetryOnRateLimit: true,
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
});
export class SolanaLaunchRuntime {
  private readonly intents;
  private readonly journal;
  constructor(private readonly db: Db, private readonly connection: Connection = launchConnection()) {
    this.intents = db.collection<SolanaIntent>('agent_launch_solana_intents'); this.journal = new SolanaJournal(db);
  }
  async current(target: SessionTarget) { return target.intentId ? this.intents.findOne({ _id: target.intentId }) : null; }
  async pendingStep(target: SessionTarget) {
    const intent = await this.current(target); if (!intent) return null;
    for (const id of [...intent.setupSteps, ...(intent.launchStep ? [intent.launchStep] : [])]) {
      const step = await this.journal.get(id);
      if (!step) return null; // Reserved step identity; preparation may have stopped before persistence.
      if (step.phase !== 'confirmed') return step;
    }
    return null;
  }
  private terms(intent: SolanaIntent, session: LaunchSession, target: SessionTarget): BagsTerms {
    if (!intent.mint || !intent.uri || !intent.config || !intent.authority) throw new SessionConflict('Bags setup is incomplete.');
    return { mint: intent.mint, uri: intent.uri, config: intent.config, authority: intent.authority,
      payer: target.terms.signer, metadata: session.metadata, purchase: BigInt(target.terms.purchase) };
  }
  private async save(intent: SolanaIntent) { await this.intents.replaceOne({ _id: intent._id, sessionId: intent.sessionId }, intent); return intent; }
  async prepare(session: LaunchSession, target: SessionTarget, preview: LaunchPreview, retryFailed = false) {
    session = { ...session, metadata: target.metadata || session.metadata };
    if (target.terms.platform === 'pons' || !target.intentId) throw new SessionConflict('Invalid Solana launch.');
    const platform = target.terms.platform;
    let intent = await this.current(target);
    if (!intent) {
      intent = { _id: target.intentId, sessionId: session.id, agentId: session.agentId, platform, setupSteps: [], createdAt: new Date() };
      await this.intents.insertOne(intent);
    }
    if (intent.sessionId !== session.id || intent.platform !== platform) throw new SessionConflict('The launch identity changed.');
    const pending = await this.pendingStep(target);
    if (pending?.phase === 'submitted' || (pending?.phase === 'failed' && !retryFailed)) return pending;
    if (pending?.phase === 'review' && Date.parse(pending.review.expiresAt) > Date.now()) return pending;
    if (!intent.image) { intent.image = await persistTokenAvatar({ ...preview, metadata: session.metadata }); await this.save(intent); }
    let built: { transaction: VersionedTransaction; lifetime?: { blockhash: string; lastValidBlockHeight: number } };
    let stage: 'setup' | 'launch' = 'launch';
    let setupId: string | undefined;
    if (platform === 'pump') {
      const mint = await reservePumpMint(this.db, intent._id, session.agentId, session.id);
      intent.mint = mint.publicKey.toBase58();
      if (!intent.uri) { intent.uri = (await persistSolanaMetadata(session.agentId, session.metadata, intent.image)).uri; await this.save(intent); }
      built = await buildPumpLaunch(this.connection, { mint, payer: new PublicKey(target.terms.signer), metadata: session.metadata, uri: intent.uri, purchase: BigInt(target.terms.purchase) });
    } else {
      const api = new BagsLaunchApi(process.env.BAGS_AGENT_API_KEY || '');
      if (!intent.mint || !intent.uri) {
        const result = await reserveBagsMetadata(this.db, api, intent._id, session.agentId, session.id, session.metadata, intent.image);
        intent.mint = result.mint; intent.uri = result.uri; await this.save(intent);
      }
      const completed = new Set<BagsSetupPlan['steps'][number]['kind']>();
      for (const step of intent.bagsPlan?.steps || []) {
        if ((await this.journal.get(bagsSetupStepId(intent._id,step.kind)))?.phase === 'confirmed') completed.add(step.kind);
      }
      let next = intent.bagsPlan?.steps.find(step=>!completed.has(step.kind));
      if (!intent.bagsPlan || (next && (['failed', 'expired'].includes(pending?.phase || '') || !(await this.connection.isBlockhashValid(restoreBagsSetupStep(next).transaction.message.recentBlockhash,{commitment:'confirmed'})).value))) {
        intent.bagsPlan = await refreshBagsSetupPlan(this.connection,api,{mint:intent.mint,uri:intent.uri!,payer:target.terms.signer,
          metadata:session.metadata,purchase:BigInt(target.terms.purchase)},intent.bagsPlan,completed);
        intent.config = intent.bagsPlan.config; intent.authority = intent.bagsPlan.authority;
        intent.setupSteps = intent.bagsPlan.steps.map(step=>bagsSetupStepId(intent!._id,step.kind));
        await this.save(intent);
        next = intent.bagsPlan.steps.find(step=>!completed.has(step.kind));
      }
      if (next) {
        built = restoreBagsSetupStep(next); stage = 'setup'; setupId = bagsSetupStepId(intent._id,next.kind);
        await validateBagsTransaction(this.connection,built.transaction,this.terms(intent,session,target),stage);
      } else {
        await verifyBagsConfiguration(this.connection, this.terms(intent, session, target));
        built = await prepareBagsLaunch(api, { mint: intent.mint, uri: intent.uri!, config: intent.config!, payer: target.terms.signer, purchase: BigInt(target.terms.purchase) });
        await validateBagsTransaction(this.connection, built.transaction, this.terms(intent, session, target), stage);
      }
    }
    const purchase = stage === 'setup' ? 0n : BigInt(target.terms.purchase);
    // Hard implementation ceiling, not a charge: the review exposes the exact simulated debit.
    const review = await reviewSolanaTransaction(this.connection, built.transaction, target.terms.signer, purchase + 100_000_000n, built.lifetime);
    if (pending) return ['failed', 'expired'].includes(pending.phase) ? this.journal.retryFailed(pending,review) : this.journal.refresh(pending, review);
    const id = stage === 'launch' ? (intent.launchStep || `${intent._id}:launch`)
      : setupId!;
    if (stage === 'setup' && !intent.setupSteps.includes(id)) intent.setupSteps.push(id);
    if (stage === 'launch') intent.launchStep = id;
    await this.save(intent); // Persist the reference before exposing or storing a transaction.
    const step = await this.journal.reserve({ _id: id, agentId: session.agentId, sessionId: session.id, intentId: intent._id,
      signer: target.terms.signer, mint: intent.mint!, review, revision: 0, phase: 'review', createdAt: new Date() });
    return step;
  }
  async confirm(session: LaunchSession, target: SessionTarget, stepId: string, digest: string, signed?: string) {
    return withAgentProfileLease(this.db, `solana-signer:${target.terms.signer}`, async assertHeld => {
      const step = await this.journal.get(stepId);
      if (!step || step.sessionId !== session.id || step.intentId !== target.intentId || step.signer !== target.terms.signer || digest !== step.review.digest) throw new SessionConflict('The transaction review changed.');
      if (step.submission) { if (step.phase === 'submitted') await this.journal.broadcast(step, this.connection); return step; }
      const prepared = VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64'));
      await reviewSolanaTransaction(this.connection, prepared, step.signer, BigInt(step.review.maximumDebit));
      let bytes: Uint8Array;
      if (target.terms.mode === 'managed') {
        if (session.role !== 'admin' || signed) throw new SessionConflict('Invalid managed-wallet confirmation.');
        bytes = signManagedSolana(prepared);
      } else {
        if (typeof signed !== 'string' || signed.length > 1700 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signed)) throw new SessionConflict('Sign this transaction with the selected wallet.');
        bytes = Buffer.from(signed, 'base64');
      }
      await assertHeld();
      const saved = await this.journal.authorize(step, digest, bytes, this.connection);
      await this.journal.broadcast(saved, this.connection);
      return saved;
    });
  }
  async reconcile(session: LaunchSession, target: SessionTarget) {
    session = { ...session, metadata: target.metadata || session.metadata };
    const intent = await this.current(target); if (!intent) return { phase: 'preparing' as const };
    const pending = await this.pendingStep(target);
    if (pending) {
      const witnessUrl = process.env.SOLANA_CONFIRMATION_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const witness = this.connection.rpcEndpoint !== witnessUrl ? new Connection(witnessUrl, {
        commitment: 'finalized', disableRetryOnRateLimit: true,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      }) : undefined;
      const step = await this.journal.reconcile(pending, this.connection, witness);
      if (step.phase === 'expired') return { phase: 'awaiting-signature' as const };
      if (step.phase === 'failed') return { phase: 'failed' as const, error: 'The transaction failed. Your completed launches are saved.' };
      if (step.phase === 'submitted') return { phase: 'confirming' as const };
      if (step.phase === 'review') return { phase: 'awaiting-signature' as const };
    }
    const launched = intent.launchStep ? await this.journal.get(intent.launchStep) : null;
    if (launched?.phase === 'confirmed') {
      const token = intent.platform === 'pump' ? await verifyPumpLaunch(this.connection, launched, session.metadata, intent.uri!)
        : await verifyBagsLaunch(this.connection, launched, this.terms(intent, session, target));
      return { phase: 'confirmed' as const, token };
    }
    return { phase: 'awaiting-signature' as const }; // Next setup/launch step requires another explicit review.
  }
  async rebroadcast(target: SessionTarget) {
    const step = await this.pendingStep(target);
    if (!step || step.phase !== 'submitted') throw new SessionConflict('There is no saved submission to retry.');
    await this.journal.broadcast(step, this.connection);
  }
  async review(target: SessionTarget) {
    const step = await this.pendingStep(target);
    if (!step || step.phase !== 'review') return null;
    const intent = await this.current(target);
    return { id: step._id, platform: target.terms.platform, stage: intent?.launchStep === step._id ? 'launch' : 'setup',
      signer: step.signer, mode: target.terms.mode, ...step.review };
  }
}
