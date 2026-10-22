import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { Db } from 'mongodb';
import { BAGS_STANDARD_CONFIG, HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import { validSolanaAddress, profileUrl } from './platforms';
import { validTokenLogo } from './policy';
import type { AgentTokenMetadata } from './types';

const BASE_URL = 'https://public-api-v2.bags.fm/api/v1';
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SessionConflict('Bags returned an invalid response.');
  return value as Record<string, unknown>;
};

/** Small transport boundary; no remote error text, URLs or credentials escape it. */
export class BagsLaunchApi {
  constructor(private readonly key: string, private readonly fetcher: typeof fetch = fetch) {}
  async post(path: '/token-launch/create-token-info' | '/fee-share/config' | '/token-launch/create-launch-transaction' | '/fee-share/deployer/claim-txs', body: Record<string, unknown>) {
    if (!this.key) throw new SessionConflict('Bags launches are not configured.');
    const form = new FormData();
    if (path === '/token-launch/create-token-info') for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') throw new SessionConflict('Invalid metadata field.');
      form.append(key, value);
    }
    const metadata = path === '/token-launch/create-token-info';
    return this.request(path, { method: 'POST',
      headers: { 'x-api-key': this.key, ...(!metadata ? { 'Content-Type': 'application/json' } : {}) },
      body: metadata ? form : JSON.stringify(body) });
  }
  async deployerFees(wallet: string) {
    if (!this.key || !validSolanaAddress(wallet)) throw new SessionConflict('Bags fee collection is not configured.');
    return this.request(`/fee-share/deployer/claimable-positions?wallet=${encodeURIComponent(wallet)}`, { headers: { 'x-api-key': this.key } });
  }
  private async request(path: string, init: RequestInit) {
    const response = await this.fetcher(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!response.ok) throw new SessionConflict('Bags could not prepare this step. Check the saved launch before retrying.');
    // Bound the bytes before parsing a provider-controlled body.
    const reader = response.body?.getReader();
    if (!reader) throw new SessionConflict('Bags returned an empty response.');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.length;
        if (size > 256_000) { await reader.cancel(); throw new SessionConflict('Bags returned an oversized response.'); }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    const data = object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (data.success !== true || data.response === undefined) throw new SessionConflict('Bags could not prepare this step.');
    return data.response;
  }
}

export interface BagsPlanStep {
  transaction: VersionedTransaction;
  lifetime?: { blockhash: string; lastValidBlockHeight: number };
}

/** Standard SOL API uses base58, not the newer custom-quote plan's base64. */
export function readBagsTransaction(value: unknown): BagsPlanStep {
  const wrapped = typeof value === 'string' ? { transaction: value } : object(value);
  if (typeof wrapped.transaction !== 'string' || wrapped.transaction.length > 2000 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(wrapped.transaction)) throw new SessionConflict('Bags returned an invalid transaction.');
  let transaction: VersionedTransaction;
  try {
    const bytes = bs58.decode(wrapped.transaction);
    if (bytes.length > 1232) throw Error();
    transaction = VersionedTransaction.deserialize(bytes);
  } catch { throw new SessionConflict('Bags returned an unsupported transaction.'); }
  if (transaction.version !== 0 && transaction.version !== 'legacy') throw new SessionConflict('This Bags transaction version is not supported.');
  let lifetime: BagsPlanStep['lifetime'];
  if (wrapped.blockhash !== undefined) {
    const hash = object(wrapped.blockhash);
    if (hash.blockhash !== transaction.message.recentBlockhash || !Number.isSafeInteger(hash.lastValidBlockHeight) || Number(hash.lastValidBlockHeight) <= 0) throw new SessionConflict('Bags returned a mismatched transaction lifetime.');
    lifetime = { blockhash: transaction.message.recentBlockhash, lastValidBlockHeight: Number(hash.lastValidBlockHeight) };
  }
  return { transaction, ...(lifetime ? { lifetime } : {}) };
}

export function bagsFeeConfigRequest(mint: string, payer: string, recipient = HIVE_SOLANA_FEE_WALLET) {
  if (!validSolanaAddress(mint) || !validSolanaAddress(payer) || !validSolanaAddress(recipient)) throw new SessionConflict('Invalid Bags launch wallet or mint.');
  return { payer, baseMint: mint, claimersArray: [recipient], basisPointsArray: [10000],
    bagsConfigType: BAGS_STANDARD_CONFIG };
}

export async function prepareBagsConfiguration(api: BagsLaunchApi, mint: string, payer: string, recipient = HIVE_SOLANA_FEE_WALLET) {
  const response = object(await api.post('/fee-share/config', bagsFeeConfigRequest(mint, payer, recipient)));
  if (!validSolanaAddress(response.meteoraConfigKey) || !validSolanaAddress(response.feeShareAuthority) || typeof response.needsCreation !== 'boolean') {
    throw new SessionConflict('Bags returned an invalid fee configuration.');
  }
  // Do not flatten bundles into independent sends. A new response shape requires explicit handling.
  if (Array.isArray(response.bundles) && response.bundles.some(bundle => !Array.isArray(bundle) || bundle.length)) {
    throw new SessionConflict('This Bags configuration requires a bundled transaction plan.');
  }
  const steps = response.transactions === undefined ? [] : Array.isArray(response.transactions) ? response.transactions.map(readBagsTransaction) : null;
  if (!steps || steps.length > 8 || (response.needsCreation && steps.length === 0)
    || steps.some(step => !step.transaction.message.staticAccountKeys.slice(0,step.transaction.message.header.numRequiredSignatures).some(key=>key.toBase58() === payer))) throw new SessionConflict('Bags returned an invalid setup plan.');
  return { config: response.meteoraConfigKey, authority: response.feeShareAuthority, needsCreation: response.needsCreation, steps };
}

export async function prepareBagsLaunch(api: BagsLaunchApi, input: { mint: string; payer: string; config: string; uri: string; purchase: bigint }) {
  if (![input.mint, input.payer, input.config].every(validSolanaAddress) || input.purchase < 0n || input.purchase > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new SessionConflict('Invalid Bags launch terms.');
  }
  const step = readBagsTransaction(await api.post('/token-launch/create-launch-transaction', { tokenMint: input.mint, wallet: input.payer,
    configKey: input.config, ipfs: input.uri, initialBuyLamports: Number(input.purchase) }));
  if (!step.transaction.message.staticAccountKeys.slice(0,step.transaction.message.header.numRequiredSignatures).some(key=>key.toBase58() === input.payer)) throw new SessionConflict('Bags returned a different signer.');
  return step;
}

interface BagsMetadataReservation {
  _id: string; agentId: string; sessionId: string; metadata: AgentTokenMetadata; image: string;
  phase: 'requesting' | 'received' | 'ready'; response?: BagsMetadataResponse; mint?: string; uri?: string; createdAt: Date;
}
interface BagsMetadataResponse {
  tokenMint: string; tokenMetadata: string;
  tokenLaunch: { tokenMint: string; name: string; symbol: string; description: string; website: string; twitter: string; telegram: string };
}
/** Persist only public metadata, never provider account keys or other unknown fields. */
export function readBagsMetadataResponse(value: unknown): BagsMetadataResponse {
  const result = object(value), launch = object(result.tokenLaunch);
  if (!validSolanaAddress(result.tokenMint) || typeof result.tokenMetadata !== 'string') throw new SessionConflict('Bags returned invalid token metadata.');
  let url: URL;
  try { url = new URL(result.tokenMetadata); } catch { throw new SessionConflict('Bags returned an unsupported metadata URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || result.tokenMetadata.length > 200) throw new SessionConflict('Bags returned an unsupported metadata URL.');
  for (const key of ['tokenMint', 'name', 'symbol', 'description', 'website']) {
    if (typeof launch[key] !== 'string') throw new SessionConflict('Bags returned incomplete token metadata.');
  }
  const social = (key: string) => {
    if (launch[key] == null) return '';
    if (typeof launch[key] !== 'string') throw new SessionConflict('Bags returned invalid social links.');
    return launch[key] as string;
  };
  return { tokenMint: result.tokenMint, tokenMetadata: result.tokenMetadata, tokenLaunch: {
    tokenMint: launch.tokenMint as string, name: launch.name as string, symbol: launch.symbol as string,
    description: launch.description as string, website: launch.website as string, twitter: social('twitter'), telegram: social('telegram'),
  } };
}
export function verifyBagsMetadataResponse(response: BagsMetadataResponse, metadata: AgentTokenMetadata) {
  const launch = response.tokenLaunch;
  // Multipart encoders canonicalize line endings. Only this transport change is
  // equivalent; different words, spacing, names, links or tickers still fail closed.
  const lineEndings = (value: string) => value.replace(/\r\n|\r/g, '\n');
  if (launch.tokenMint !== response.tokenMint || launch.name !== metadata.name || launch.symbol !== metadata.symbol
    || lineEndings(launch.description) !== lineEndings(metadata.description) || launch.website !== metadata.socials.website || launch.twitter || launch.telegram) {
    throw new SessionConflict('Bags returned different token details. Check the saved launch before retrying.');
  }
  return { mint: new PublicKey(response.tokenMint).toBase58(), uri: response.tokenMetadata };
}
/** A lost mint-allocation response cannot silently allocate another mint on retry. */
export async function reserveBagsMetadata(db: Db, api: BagsLaunchApi, intentId: string, agentId: string, sessionId: string, metadata: AgentTokenMetadata, image: string) {
  if (!validTokenLogo(image) || metadata.socials.website !== profileUrl(agentId) || metadata.socials.twitter || metadata.socials.telegram) throw new SessionConflict('The metadata changed. Refresh the review.');
  const records = db.collection<BagsMetadataReservation>('agent_launch_bags_metadata');
  const existing = await records.findOne({ _id: intentId });
  let response = existing?.response;
  if (existing) {
    if (existing.agentId !== agentId || existing.sessionId !== sessionId || JSON.stringify(existing.metadata) !== JSON.stringify(metadata) || existing.image !== image) {
      throw new SessionConflict('The saved Bags metadata belongs to another review.');
    }
    if (existing.phase === 'ready' && existing.mint && existing.uri) return { mint: existing.mint, uri: existing.uri };
    if (!response) throw new SessionConflict('The Bags mint allocation is unresolved. Recover its response before retrying.');
  } else {
    await records.insertOne({ _id: intentId, agentId, sessionId, metadata, image, phase: 'requesting', createdAt: new Date() });
    response = readBagsMetadataResponse(await api.post('/token-launch/create-token-info', {
      name: metadata.name, symbol: metadata.symbol, description: metadata.description, imageUrl: image, website: profileUrl(agentId),
    }));
    // Save the identity before comparing fields, so validation failures and process
    // interruptions can recheck the same response without allocating another mint.
    const saved = await records.updateOne({ _id: intentId, phase: 'requesting' }, { $set: { phase: 'received', response } });
    if (saved.modifiedCount !== 1) throw new SessionConflict('The Bags reservation changed. Check its status.');
  }
  const result = verifyBagsMetadataResponse(response, metadata);
  const saved = await records.updateOne({ _id: intentId, phase: 'received' }, { $set: { phase: 'ready', ...result } });
  if (saved.modifiedCount !== 1) throw new SessionConflict('The Bags reservation changed. Check its status.');
  return result;
}
