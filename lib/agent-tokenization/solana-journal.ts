import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { Db } from 'mongodb';
import { SessionConflict } from './session';

// Full getGenesisHash result, not the truncated CAIP-2 chain reference.
export const SOLANA_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export interface SealedValue { ciphertext: string; iv: string; tag: string }
function journalKey(): Buffer {
  const key = process.env.TOKENIZATION_JOURNAL_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new SessionConflict('Solana token launches are not configured.');
  return Buffer.from(key, 'hex');
}
/** Separate domains for mint secrets and already-authorized transactions. Never return either to the UI. */
export function sealValue(value: Uint8Array, context: string): SealedValue {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', journalKey(), iv);
  cipher.setAAD(Buffer.from(`hive-agent-launch-v1:${context}`));
  return { ciphertext: Buffer.concat([cipher.update(value), cipher.final()]).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
export function openValue(value: SealedValue, context: string): Uint8Array {
  const decipher = createDecipheriv('aes-256-gcm', journalKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(`hive-agent-launch-v1:${context}`));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]);
}
export function messageDigest(transaction: VersionedTransaction): string {
  return createHash('sha256').update(transaction.message.serialize()).digest('hex');
}
export function requiresSigner(transaction: VersionedTransaction, signer: string) {
  return transaction.message.staticAccountKeys.slice(0, transaction.message.header.numRequiredSignatures).some(key=>key.toBase58() === signer);
}
function validSignature(signature: Uint8Array, message: Uint8Array, address: PublicKey) {
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), address.toBuffer()]), format: 'der', type: 'spki' });
  return verify(null, message, key, signature);
}

/** Reject wallet/provider mutations and validate every signature, including a pre-signed mint. */
export function verifySignedTransaction(prepared: VersionedTransaction, bytes: Uint8Array): { transaction: VersionedTransaction; signature: string } {
  if (bytes.length > 1232) throw new SessionConflict('The signed transaction is too large.');
  const transaction = VersionedTransaction.deserialize(bytes);
  if (messageDigest(transaction) !== messageDigest(prepared)) throw new SessionConflict('The wallet changed the reviewed transaction.');
  const message = transaction.message.serialize();
  const required = transaction.message.header.numRequiredSignatures;
  if (transaction.signatures.length !== required || prepared.signatures.length !== required) throw new SessionConflict('The signing requirements changed.');
  for (let index = 0; index < required; index++) {
    const signature = transaction.signatures[index], previous = prepared.signatures[index];
    if (previous.some(byte => byte !== 0) && !Buffer.from(signature).equals(Buffer.from(previous))) throw new SessionConflict('An existing signature was replaced.');
    if (!validSignature(signature, message, transaction.message.staticAccountKeys[index])) throw new SessionConflict('The transaction is missing a valid signature.');
  }
  return { transaction, signature: bs58.encode(transaction.signatures[0]) };
}

export interface SolanaReview {
  transaction: string; // base64, partial signatures preserved
  digest: string;
  blockhash: string;
  lastValidBlockHeight?: number; // Only supplied by the builder that acquired this exact blockhash.
  maximumDebit: string;
  networkFee: string;
  expiresAt: string;
}
export interface SolanaStep {
  _id: string;
  agentId: string;
  sessionId: string;
  intentId: string;
  signer: string;
  mint: string;
  review: SolanaReview;
  revision: number;
  phase: 'review' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  expiredAt?: string;
  broadcastError?: string;
  signature?: string;
  submission?: SealedValue;
  slot?: number;
  createdAt: Date;
}

/** Translate structured RPC errors without exposing provider logs or credentials. */
function simulationFailure(error: unknown, transaction: VersionedTransaction, signer: string, balance: number): string {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const rent = record.InsufficientFundsForRent as { account_index?: number } | undefined;
  const index = rent?.account_index;
  const signerRent = Number.isInteger(index) && transaction.message.staticAccountKeys[index!]?.toBase58() === signer;
  const payer = transaction.message.staticAccountKeys[0]?.toBase58();
  const instruction = record.InstructionError;
  if (signerRent || (error === 'InsufficientFundsForFee' && payer === signer)) {
    const available = Number.isSafeInteger(balance) ? ` Balance: ${(balance / 1_000_000_000).toFixed(9)} SOL.` : '';
    return `The Solana launch wallet needs more SOL for fees and account rent.${available} Fund ${signer}, then continue.`;
  }
  if (rent || error === 'InsufficientFundsForFee') return 'A launch transaction account lacks SOL for fees or rent. The launch provider must resolve this before you continue.';
  if (Array.isArray(instruction) && Number.isInteger(instruction[0])) {
    const custom = instruction[1] && typeof instruction[1] === 'object' ? instruction[1].Custom : undefined;
    return `Solana rejected launch instruction ${instruction[0] + 1}${Number.isSafeInteger(custom) ? ` (code ${custom})` : ''}. Your completed steps are saved.`;
  }
  return 'Solana rejected this launch transaction. Your completed steps are saved.';
}

/** Pure simulation/read. Platform adapters must validate instruction meaning before calling this. */
export async function reviewSolanaTransaction(connection: Connection, transaction: VersionedTransaction,
  signer: string, maximumDebit: bigint, lifetime?: { blockhash: string; lastValidBlockHeight: number }): Promise<SolanaReview> {
  if (await connection.getGenesisHash() !== SOLANA_MAINNET_GENESIS) throw new SessionConflict('The RPC is not connected to Solana mainnet.');
  if (!requiresSigner(transaction, signer) || maximumDebit < 0n) throw new SessionConflict('The transaction signer or spending limit changed.');
  if (lifetime && (lifetime.blockhash !== transaction.message.recentBlockhash || !Number.isSafeInteger(lifetime.lastValidBlockHeight))) throw new SessionConflict('The transaction lifetime does not match.');
  const [blockhash, balance, fee, simulation] = await Promise.all([
    connection.isBlockhashValid(transaction.message.recentBlockhash, { commitment: 'confirmed' }),
    connection.getBalance(new PublicKey(signer), 'confirmed'),
    connection.getFeeForMessage(transaction.message, 'confirmed'),
    connection.simulateTransaction(transaction, { sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed',
      accounts: { encoding: 'base64', addresses: [signer] } }),
  ]);
  if (!blockhash.value || simulation.value.err === 'BlockhashNotFound') throw new SessionConflict('The transaction expired. Continue to prepare a fresh transaction.');
  if (simulation.value.err) throw new SessionConflict(simulationFailure(simulation.value.err, transaction, signer, balance));
  if (fee.value === null) throw new SessionConflict('The network could not estimate the transaction fee. Try again shortly.');
  const remaining = simulation.value.accounts?.[0]?.lamports;
  if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(fee.value) || !Number.isSafeInteger(remaining)) throw new SessionConflict('The launch cost could not be verified.');
  // Simulation includes the network fee. This is an affordability check, not an authorization to arbitrary programs.
  const debit = BigInt(balance) - BigInt(remaining!);
  if (debit < 0n || debit > maximumDebit) throw new SessionConflict('The wallet balance or launch cost changed.');
  return { transaction: Buffer.from(transaction.serialize()).toString('base64'), digest: messageDigest(transaction),
    blockhash: transaction.message.recentBlockhash, ...(lifetime ? { lastValidBlockHeight: lifetime.lastValidBlockHeight } : {}),
    maximumDebit: debit.toString(), networkFee: String(fee.value), expiresAt: new Date(Date.now() + 60_000).toISOString() };
}

export class SolanaJournal {
  private readonly steps;
  constructor(private readonly db: Db) { this.steps = db.collection<SolanaStep>('agent_launch_solana_steps'); }
  async get(id: string) { return this.steps.findOne({ _id: id }); }
  async reserve(step: SolanaStep) {
    if (step.phase !== 'review' || step.revision !== 0 || step.submission || step.signature) throw new SessionConflict('Invalid transaction review.');
    await this.steps.createIndex({ signature: 1 }, { unique: true, partialFilterExpression: { signature: { $type: 'string' } }, name: 'unique_solana_launch_signature' });
    try { await this.steps.insertOne(step); return step; }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const existing = await this.get(step._id);
        if (existing?.review.digest === step.review.digest && existing.sessionId === step.sessionId && existing.signer === step.signer) return existing;
        throw new SessionConflict('This transaction already has a review. Resume it.');
      }
      throw error;
    }
  }
  async refresh(step: SolanaStep, review: SolanaReview) {
    const saved = await this.steps.findOneAndUpdate({ _id: step._id, revision: step.revision, phase: 'review', submission: { $exists: false } }, {
      $set: { review }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!saved) throw new SessionConflict('The review changed. Check its status.');
    return saved;
  }
  /** Only a verified finalized failure permits a replacement message for this same step/mint. */
  async retryFailed(step: SolanaStep, review: SolanaReview) {
    if (!['failed', 'expired'].includes(step.phase) || !step.signature || (!step.slot && !step.expiredAt) || !step.submission || step.review.digest === review.digest) {
      throw new SessionConflict('The failed transaction needs a fresh review. Check status and try again.');
    }
    // Keep the failed signature and exact encrypted submission for audit/recovery.
    await this.db.collection<SolanaStep & {stepId:string}>('agent_launch_solana_attempts').updateOne({ _id: step.signature },
      { $setOnInsert: { ...step, _id:step.signature, stepId:step._id } },{upsert:true});
    const saved=await this.steps.findOneAndUpdate({_id:step._id,revision:step.revision,phase:step.phase,signature:step.signature},{
      $set:{review,phase:'review'},$unset:{signature:'',submission:'',slot:'',expiredAt:'',broadcastError:''},$inc:{revision:1},
    },{returnDocument:'after'});
    if(!saved) throw new SessionConflict('The transaction changed. Check its status.');
    return saved;
  }
  /** Explicit confirmed review + valid wallet signature. Persist before any network send. */
  async authorize(step: SolanaStep, confirmation: string, bytes: Uint8Array, connection: Connection) {
    if (confirmation !== step.review.digest) throw new SessionConflict('Review this transaction again.');
    if (step.submission) return step;
    if (step.phase !== 'review' || Date.parse(step.review.expiresAt) <= Date.now()) throw new SessionConflict('The review expired. Check the launch status.');
    if (!(await connection.isBlockhashValid(step.review.blockhash, { commitment: 'confirmed' })).value) throw new SessionConflict('The transaction expired. Check the launch status.');
    const prepared = VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64'));
    if (!requiresSigner(prepared, step.signer) || messageDigest(prepared) !== confirmation) throw new SessionConflict('The transaction journal does not match the review.');
    const verified = verifySignedTransaction(prepared, bytes);
    const submission = sealValue(bytes, `transaction:${step._id}`);
    const saved = await this.steps.findOneAndUpdate({ _id: step._id, revision: step.revision, phase: 'review', submission: { $exists: false } }, {
      $set: { submission, signature: verified.signature, phase: 'submitted' }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!saved) throw new SessionConflict('The transaction changed. Check its status.');
    return saved;
  }
  async broadcast(step: SolanaStep, connection: Connection) {
    if (!step.submission || !step.signature || step.phase !== 'submitted') throw new SessionConflict('No authorized transaction to submit.');
    if (await connection.getGenesisHash() !== SOLANA_MAINNET_GENESIS) throw new SessionConflict('The RPC is not connected to Solana mainnet.');
    const bytes = openValue(step.submission, `transaction:${step._id}`);
    const verified = verifySignedTransaction(VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64')), bytes);
    if (verified.signature !== step.signature) throw new SessionConflict('The saved transaction does not match.');
    try {
      const signature = await connection.sendRawTransaction(bytes, { skipPreflight: false, maxRetries: 2, preflightCommitment: 'confirmed' });
      if (signature !== step.signature) throw new SessionConflict('The RPC returned a different transaction.');
    } catch (error) {
      // Store only an allowlisted classification; provider errors may contain secrets.
      const message = error instanceof Error ? error.message : '';
      const broadcastError = /blockhash/i.test(message) ? 'Transaction expired before submission.'
        : /simulation|preflight/i.test(message) ? 'The network rejected the transaction simulation.'
        : 'Submission could not be confirmed. Retrying automatically.';
      await this.steps.updateOne({ _id: step._id, signature: step.signature, phase: 'submitted' }, { $set: { broadcastError } });
      // A lost response, timeout or expired blockhash is unresolved. Reconcile history; never replace the mint.
      return false;
    }
    return true;
  }
  async reconcile(step: SolanaStep, connection: Connection, witness?: Connection) {
    if (!step.signature || step.phase !== 'submitted') return step;
    if (await connection.getGenesisHash() !== SOLANA_MAINNET_GENESIS) throw new SessionConflict('The RPC is not connected to Solana mainnet.');
    const status = (await connection.getSignatureStatuses([step.signature], { searchTransactionHistory: true })).value[0];
    if (!status) {
      // A timeout is not failure. Replacement requires expired lifetime and independent history reads.
      const limit = step.review?.lastValidBlockHeight;
      if (!witness || !Number.isSafeInteger(limit) || await connection.getBlockHeight('finalized') <= limit!) return step;
      const absent = async (rpc: Connection) => {
        if (await rpc.getGenesisHash() !== SOLANA_MAINNET_GENESIS || await rpc.getBlockHeight('finalized') <= limit!) return false;
        if ((await rpc.isBlockhashValid(step.review.blockhash, { commitment: 'finalized' })).value) return false;
        if ((await rpc.getSignatureStatuses([step.signature!], { searchTransactionHistory: true })).value[0]) return false;
        return await rpc.getTransaction(step.signature!, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }) === null;
      };
      if (!await absent(connection) || !await absent(witness)) return step;
      const saved = await this.steps.findOneAndUpdate({ _id: step._id, revision: step.revision, phase: 'submitted' }, {
        $set: { phase: 'expired', expiredAt: new Date().toISOString() }, $inc: { revision: 1 },
      }, { returnDocument: 'after' });
      if (!saved) throw new SessionConflict('The transaction changed. Check its status.');
      return saved;
    }
    if (status.confirmationStatus !== 'finalized') return step;
    // Exact finalized message prevents attaching an unrelated transaction even from a compromised provider response.
    const receipt = await connection.getTransaction(step.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
    if (!receipt || !receipt.meta || receipt.slot !== status.slot || receipt.transaction.signatures[0] !== step.signature) return step;
    const expected = VersionedTransaction.deserialize(Buffer.from(step.review.transaction, 'base64'));
    if (!Buffer.from(receipt.transaction.message.serialize()).equals(Buffer.from(expected.message.serialize()))) throw new SessionConflict('The confirmed transaction differs from the review.');
    if (JSON.stringify(receipt.meta.err) !== JSON.stringify(status.err)) throw new SessionConflict('Transaction results disagree. Try checking again.');
    const phase = status.err ? 'failed' : 'confirmed';
    const saved = await this.steps.findOneAndUpdate({ _id: step._id, revision: step.revision, phase: 'submitted' }, {
      $set: { phase, slot: status.slot }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!saved) throw new SessionConflict('The transaction changed. Check its status.');
    return saved;
  }
}
