import { createHash, randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { formatEther, verifyMessage, type Hex } from 'viem';
import { BASE_FEE_BPS, CREATOR_TAX_BPS, PONS_CHAIN_ID, PONS_FACTORY, feeRecipient, normalizeSymbol, purchaseWei, sameAddress, validAddress } from './policy';
import type { LaunchPreview } from './types';

export class LaunchAuthorizationError extends Error {}
export interface ReviewChoices { symbol: string; purchase: string }
export interface LaunchAuthorization {
  _id: string;
  origin: string;
  agentId: string;
  role: LaunchPreview['role'];
  signer: Hex;
  preview: LaunchPreview;
  choices: ReviewChoices;
  digest: string;
  issuedAt: Date;
  expiresAt: Date;
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function launchReview(preview: LaunchPreview, signer: string, input: ReviewChoices) {
  if (!/^[a-f0-9]{24}$/.test(preview.agentId) || !validAddress(signer) || preview.issues.length || preview.existingToken
    || !['owner', 'admin'].includes(preview.role)) throw new LaunchAuthorizationError('Refresh the agent token details before continuing.');
  const recipient = feeRecipient(preview.role, preview.requiredSigner, true);
  if (!recipient || !sameAddress(recipient, preview.recipient || '')
    || (preview.role === 'owner' && !sameAddress(signer, recipient))) throw new LaunchAuthorizationError('Select the verified agent wallet.');
  if (typeof input.symbol !== 'string' || typeof input.purchase !== 'string') throw new LaunchAuthorizationError('Choose a ticker and opening purchase.');
  let choices: ReviewChoices;
  try { choices = { symbol: normalizeSymbol(input.symbol), purchase: formatEther(purchaseWei(input.purchase)) }; }
  catch (error) { throw new LaunchAuthorizationError(error instanceof Error ? error.message : 'Invalid launch choices.'); }
  const value = { version: 1, chainId: PONS_CHAIN_ID, factory: PONS_FACTORY, agentId: preview.agentId, role: preview.role,
    signer: signer.toLowerCase(), recipient: recipient.toLowerCase(), metadata: preview.metadata, choices,
    baseFeeBps: BASE_FEE_BPS, creatorFeeBps: CREATOR_TAX_BPS, buybacks: false };
  return { choices, digest: digest(value) };
}

export function authorizationMessage(challenge: LaunchAuthorization): string {
  return [
    'Authorize agent token preparation on Hive',
    `Website: ${challenge.origin}`,
    `Agent: ${challenge.preview.metadata.name}`,
    `Agent ID: ${challenge.agentId}`,
    `Role: ${challenge.role}`,
    `Wallet: ${challenge.signer}`,
    `Network: Robinhood Chain (${PONS_CHAIN_ID})`,
    `Ticker: ${challenge.choices.symbol}`,
    `Opening purchase: ${challenge.choices.purchase} ETH`,
    `Creator fee recipient: ${challenge.preview.recipient}`,
    `Review: ${challenge.digest}`,
    `Request: ${challenge._id}`,
    `Issued: ${challenge.issuedAt.toISOString()}`,
    `Expires: ${challenge.expiresAt.toISOString()}`,
    '', 'This signature prepares your launch. It does not send a transaction or spend funds.',
  ].join('\n');
}

export class LaunchAuthorizations {
  private readonly records;
  constructor(db: Db, private readonly origin: string) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error('Invalid launch authorization origin.');
    this.records = db.collection<LaunchAuthorization>('pons_launch_authorizations');
  }

  async issue(preview: LaunchPreview, signer: string, choices: ReviewChoices, now = new Date()) {
    const review = launchReview(preview, signer, choices);
    const record: LaunchAuthorization = { _id: randomUUID(), origin: this.origin, agentId: preview.agentId, role: preview.role,
      signer: signer.toLowerCase() as Hex, preview, ...review, issuedAt: now, expiresAt: new Date(now.getTime() + 300_000) };
    // Challenges expire independently. Launch intents live in a separate collection with no TTL.
    await this.records.createIndex({ expiresAt: 1 }, { name: 'expired_launch_authorizations', expireAfterSeconds: 0 });
    await this.records.insertOne(record);
    return { id: record._id, message: authorizationMessage(record), expiresAt: record.expiresAt.toISOString() };
  }

  /** Caller must independently authenticate the current owner/admin on every request. */
  async verify(id: string, signature: unknown, preview: LaunchPreview, now = new Date()) {
    if (!/^[a-f0-9-]{36}$/.test(id) || typeof signature !== 'string' || !/^0x[a-f0-9]{130}$/i.test(signature)) throw new LaunchAuthorizationError('Sign the wallet authorization message.');
    const record = await this.records.findOne({ _id: id, agentId: preview.agentId, role: preview.role });
    if (!record || record.origin !== this.origin || record.issuedAt > now || record.expiresAt <= now) throw new LaunchAuthorizationError('The wallet authorization expired. Refresh and sign again.');
    const current = launchReview(preview, record.signer, record.choices);
    if (record.digest !== current.digest) throw new LaunchAuthorizationError('The agent or launch settings changed. Review and sign again.');
    // The launch flow uses direct EVM transactions; smart-account execution needs a separate adapter.
    let valid = false;
    try { valid = await verifyMessage({ address: record.signer, message: authorizationMessage(record), signature: signature as Hex }); }
    catch { /* Invalid signatures are authorization failures, not internal errors. */ }
    if (!valid) throw new LaunchAuthorizationError('The signature does not match the selected wallet.');
    return record;
  }
}
