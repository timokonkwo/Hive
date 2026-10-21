import { randomBytes, randomUUID } from 'node:crypto';
import { ObjectId, type Db, type Filter } from 'mongodb';
import type { Hex } from 'viem';
import { PONS_CHAIN_ID, creatorTaxBps, feeRecipient, purchaseWei, sameAddress, validAddress, validHash, validTokenLogo } from './policy';
import { packPrepared, unpackPrepared, type PreparedEnvelope, type PreparedLaunch } from './journal';
import type { LaunchPreview, TokenAssociation } from './types';
import type { ReviewChoices } from './authorization';

export type IntentPhase = 'draft' | 'awaiting-signature' | 'submitted' | 'confirming' | 'confirmed' | 'reverted' | 'cancelled';
export interface LaunchIntent {
  _id: string;
  agentId: string;
  chainId: typeof PONS_CHAIN_ID;
  signer: string;
  mode?: 'connected' | 'managed';
  managedPending?: boolean;
  managedSubmission?: { ciphertext: string; iv: string; tag: string };
  preview: LaunchPreview;
  salt: Hex;
  phase: IntentPhase;
  active: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  reviewDigest?: string;
  choices?: ReviewChoices;
  logoURI?: string;
  cancellationHash?: Hex;
  cancellationReview?: PreparedEnvelope;
  prepared?: PreparedEnvelope;
  nonce?: number;
  transactionHash?: Hex;
  receiptConfirmed?: boolean;
  nextBlock?: string;
  token?: TokenAssociation;
  tokenAddress?: string;
  projected?: boolean;
  launchedAt?: Date;
  leaseId?: string;
  leaseUntil?: Date;
  nextCheckAt?: Date;
  lastError?: string;
  cancellationEvidence?: { blockNumber: string; blockHash: Hex; consumedNonce: number };
}
export class LaunchConflict extends Error {}
const duplicate = (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 11000;

/** No TTL indexes: an exposed transaction must never expire out of recovery. */
export class LaunchStore {
  private readonly intents;
  constructor(private readonly db: Db) { this.intents = db.collection<LaunchIntent>('pons_launch_intents'); }

  async ensureIndexes() {
    await this.intents.createIndexes([
      { key: { chainId: 1, signer: 1 }, name: 'one_managed_signer_launch', unique: true, partialFilterExpression: { managedPending: true } },
      { key: { agentId: 1, chainId: 1 }, name: 'one_active_agent_launch', unique: true, partialFilterExpression: { active: true } },
      { key: { chainId: 1, signer: 1, nonce: 1 }, name: 'one_signer_nonce', unique: true, partialFilterExpression: { nonce: { $exists: true } } },
      { key: { chainId: 1, tokenAddress: 1 }, name: 'one_token_association', unique: true, partialFilterExpression: { tokenAddress: { $exists: true } } },
      { key: { phase: 1, nextCheckAt: 1, leaseUntil: 1 }, name: 'reconciliation_queue' },
    ]);
  }

  /** Internal service boundary. Caller must authenticate agent/admin AND verify wallet proof. */
  async reserve(preview: LaunchPreview, signer: string, now = new Date(), authorization?: { id: string; digest: string; choices: ReviewChoices; mode?: 'connected' | 'managed' }) {
    if (!/^[a-f0-9]{24}$/i.test(preview.agentId) || !validAddress(signer) || preview.issues.length || preview.existingToken) throw Error('The agent is not ready to launch.');
    if (preview.role !== 'owner' && preview.role !== 'admin') throw Error('Invalid launch role.');
    const recipient = feeRecipient(preview.role, preview.requiredSigner, true);
    if (!recipient || !sameAddress(recipient, preview.recipient || '') || (preview.role === 'owner' && !sameAddress(signer, recipient))) throw Error('The launch wallet or recipient changed.');
    await this.ensureIndexes();
    const intent: LaunchIntent = {
      _id: authorization?.id || randomUUID(), mode: authorization?.mode || 'connected', ...(authorization?.mode === 'managed' ? { managedPending: true } : {}), ...(authorization ? { reviewDigest: authorization.digest, choices: authorization.choices } : {}), agentId: preview.agentId.toLowerCase(), chainId: PONS_CHAIN_ID, signer: signer.toLowerCase(), preview,
      salt: `0x${randomBytes(32).toString('hex')}`, phase: 'draft', active: true, revision: 0, createdAt: now, updatedAt: now,
    };
    try { await this.intents.insertOne(intent); }
    catch (error) {
      if (duplicate(error)) {
        if (authorization) {
          const existing = await this.intents.findOne({ _id: authorization.id, agentId: intent.agentId, signer: intent.signer,
            reviewDigest: authorization.digest, active: true });
          if (existing && (existing.mode || 'connected') === (authorization.mode || 'connected')) return existing; // Lost response/replayed proof resumes the same reservation.
        }
        throw new LaunchConflict(authorization?.mode === 'managed' ? 'Hive deployer already has an unfinished launch. Finish or discard it first.' : 'This agent already has a launch. Resume it instead.');
      }
      throw error;
    }
    return intent;
  }

  async lockPreparation(intent: LaunchIntent, now = new Date()) {
    const result = await this.intents.findOneAndUpdate({ _id: intent._id, revision: intent.revision, phase: 'draft', active: true,
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
      { $set: { leaseId: randomUUID(), leaseUntil: new Date(now.getTime() + 120_000) } }, { returnDocument: 'after' });
    if (!result) throw new LaunchConflict('This launch is already being prepared. Check its status shortly.');
    return result;
  }

  async saveLogo(intent: LaunchIntent, logoURI: string) {
    if (!intent.leaseId || !validTokenLogo(logoURI)) throw Error('Preparation requires a lease and a stored token image.');
    const result = await this.intents.findOneAndUpdate({ _id: intent._id, revision: intent.revision, phase: 'draft', leaseId: intent.leaseId },
      { $set: { logoURI }, $inc: { revision: 1 } }, { returnDocument: 'after' });
    if (!result) throw new LaunchConflict('The launch changed. Refresh its status.');
    return result;
  }

  async releasePreparation(intent: LaunchIntent) {
    if (!intent.leaseId) return;
    await this.intents.updateOne({ _id: intent._id, revision: intent.revision, phase: 'draft', leaseId: intent.leaseId },
      { $unset: { leaseId: '', leaseUntil: '' } });
  }

  async saveReplacementReview(intent: LaunchIntent, action: 'resume' | 'cancel', prepared: PreparedLaunch) {
    if (!intent.prepared) throw new LaunchConflict('No saved transaction to review.');
    const original = unpackPrepared(intent.prepared), tx = prepared.transaction;
    if (tx.chainId !== PONS_CHAIN_ID || tx.nonce !== intent.nonce || !sameAddress(tx.from, intent.signer)
      || prepared.expiresAt * 1000n <= BigInt(Date.now())
      || (action === 'cancel' ? !sameAddress(tx.to,intent.signer) || tx.value !== 0n || tx.data !== '0x'
        : !sameAddress(tx.to,original.transaction.to) || tx.value !== original.transaction.value || tx.data !== original.transaction.data)
      || packPrepared({...prepared,transaction:original.transaction,expiresAt:original.expiresAt,
        maximumNetworkFee:original.maximumNetworkFee,maximumTotal:original.maximumTotal}).digest !== intent.prepared.digest) {
      throw new LaunchConflict('The replacement does not match the saved launch.');
    }
    return this.intents.findOneAndUpdate({ _id:intent._id, revision:intent.revision,
      phase:{ $in:['awaiting-signature','submitted','confirming'] } }, {
      $set: { [action === 'cancel' ? 'cancellationReview' : 'prepared']:packPrepared(prepared), updatedAt:new Date() },
      $inc:{ revision:1 },
    }, { returnDocument:'after' });
  }

  async recordCancellation(intent: LaunchIntent, hash: Hex) {
    if (!validHash(hash)) throw Error('Invalid transaction hash.');
    const saved = await this.intents.findOneAndUpdate({ _id:intent._id, revision:intent.revision,
      phase:{ $in:['awaiting-signature','submitted','confirming'] } }, {
      $set:{ cancellationHash:hash, phase:'confirming', nextCheckAt:new Date(), updatedAt:new Date() }, $inc:{ revision:1 },
    }, { returnDocument:'after' });
    if (!saved) throw new LaunchConflict('The launch changed. Check its status.');
    return saved;
  }

  async current(agentId: string) {
    return this.intents.findOne({ agentId: agentId.toLowerCase(), chainId: PONS_CHAIN_ID }, { sort: { createdAt: -1, _id: -1 } });
  }

  /** Persist exact calldata and acquire the nonce before returning anything signable. */
  async expose(intent: LaunchIntent, prepared: PreparedLaunch, now = new Date()) {
    const { candidate, transaction, prediction } = prepared;
    if (prepared.expiresAt * 1000n <= BigInt(now.getTime())) throw Error('The launch quote expired. Refresh it.');
    if (!Number.isSafeInteger(transaction.nonce) || transaction.nonce < 0 || transaction.chainId !== PONS_CHAIN_ID
      || !sameAddress(candidate.from, intent.signer) || !sameAddress(transaction.from, intent.signer)
      || transaction.data !== candidate.data || transaction.value !== candidate.value || !sameAddress(transaction.to, candidate.to)
      || candidate.params.salt !== intent.salt || !sameAddress(candidate.params.creatorFeeRecipient, intent.preview.recipient || '')
      || candidate.params.creatorTaxBps !== creatorTaxBps(intent.preview.feePolicyVersion)
      || candidate.params.name !== intent.preview.metadata.name || candidate.params.description !== intent.preview.metadata.description
      || candidate.params.socials.website !== intent.preview.metadata.socials.website
      || (intent.choices && (candidate.params.symbol !== intent.choices.symbol || candidate.budget !== purchaseWei(intent.choices.purchase)))
      || (intent.logoURI && candidate.params.logo !== intent.logoURI)
      || !validAddress(prediction.token) || !validAddress(prediction.curve)) throw Error('The prepared launch differs from the saved review.');
    try {
      const updated = await this.intents.findOneAndUpdate({ _id: intent._id, revision: intent.revision, phase: 'draft', active: true,
        leaseId: intent.leaseId || { $exists: false } }, {
        $set: { prepared: packPrepared(prepared), nonce: transaction.nonce, phase: 'awaiting-signature', nextBlock: candidate.blockNumber.toString(), nextCheckAt: now, updatedAt: now },
        $inc: { revision: 1 }, $unset: { leaseId: '', leaseUntil: '' },
      }, { returnDocument: 'after' });
      if (!updated) throw new LaunchConflict('The launch changed. Reload it before signing.');
      return updated;
    } catch (error) { if (duplicate(error)) throw new LaunchConflict('This wallet already has a launch using that nonce. Resume it first.'); throw error; }
  }

  async cancelDraft(intent: LaunchIntent, now = new Date()) {
    const result = await this.intents.updateOne({ _id: intent._id, revision: intent.revision, phase: 'draft' }, {
      $set: { phase: 'cancelled', active: false, managedPending: false, updatedAt: now }, $inc: { revision: 1 },
    });
    if (!result.matchedCount) throw new LaunchConflict('This launch may already have reached the wallet. Check its status.');
  }

  /** Only called after the RPC confirms this hash belongs to the saved call and nonce. */
  async recordHash(intent: LaunchIntent, hash: Hex, now = new Date()) {
    if (!validHash(hash)) throw Error('Invalid transaction hash.');
    const result = await this.intents.findOneAndUpdate({ _id: intent._id, revision: intent.revision, phase: { $in: ['awaiting-signature', 'submitted', 'confirming'] } }, {
      $set: { transactionHash: hash, phase: 'submitted', updatedAt: now, nextCheckAt: now }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!result) throw new LaunchConflict('The launch changed. Reload its status.');
    return result;
  }

  async claim(now = new Date(), agentId?: string) {
    if (agentId !== undefined && !/^[a-f0-9]{24}$/i.test(agentId)) throw Error('Invalid recovery agent.');
    const query: Filter<LaunchIntent> = { chainId: PONS_CHAIN_ID, ...(agentId ? { agentId: agentId.toLowerCase() } : {}), $and: [
      { $or: [{ mode: { $ne: 'managed' } }, { managedSubmission: { $exists: true } }] },
      { $or: [{ phase: { $in: ['awaiting-signature', 'submitted', 'confirming'] } }, { phase: 'confirmed', projected: { $ne: true } }] },
      { $or: [{ nextCheckAt: { $lte: now } }, { nextCheckAt: { $exists: false } }] },
      { $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
    ] };
    return this.intents.findOneAndUpdate(query, { $set: { leaseId: randomUUID(), leaseUntil: new Date(now.getTime() + 120_000) } }, {
      returnDocument: 'after', sort: { nextCheckAt: 1, createdAt: 1 },
    });
  }

  async finish(intent: LaunchIntent, patch: Partial<Pick<LaunchIntent, 'phase' | 'transactionHash' | 'receiptConfirmed' | 'nextBlock' | 'token' | 'cancellationEvidence' | 'lastError'>>, now = new Date()) {
    if (!intent.leaseId) throw Error('Reconciliation requires a worker lease.');
    const terminal = patch.phase === 'reverted' || patch.phase === 'cancelled';
    const updated = await this.intents.findOneAndUpdate({ _id: intent._id, revision: intent.revision, leaseId: intent.leaseId }, {
      $set: { ...patch, ...((terminal || patch.phase === 'confirmed') ? { managedPending: false } : {}), active: !terminal, updatedAt: now, nextCheckAt: new Date(now.getTime() + 60_000),
        ...(patch.token?.launchedAt ? { launchedAt: new Date(patch.token.launchedAt) } : {}),
        ...(patch.token ? { tokenAddress: patch.token.address.toLowerCase(), projected: false } : {}) },
      $unset: { leaseId: '', leaseUntil: '', ...(!patch.lastError ? { lastError: '' as const } : {}) },
      $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    return updated; // A stale worker cannot overwrite a newer worker or hash update.
  }

  /** Idempotent outbox: a crash after confirmation cannot lose the public profile update. */
  async publish(intent: LaunchIntent) {
    if (intent.phase !== 'confirmed' || !intent.token) throw Error('Only confirmed launches can update an agent profile.');
    const token = intent.token;
    const result = await this.db.collection('agents').updateOne({ _id: new ObjectId(intent.agentId), $or: [
      { ponsToken: null },
      { 'ponsToken.chainId': token.chainId, 'ponsToken.address': token.address, 'ponsToken.transactionHash': token.transactionHash },
    ] }, { $set: { ponsToken: token } });
    if (!result.matchedCount) throw Error('The agent is missing or already has another token. Operator review is required.');
    await this.intents.updateOne({ _id: intent._id, phase: 'confirmed', tokenAddress: token.address.toLowerCase() }, { $set: { projected: true } });
  }
}
