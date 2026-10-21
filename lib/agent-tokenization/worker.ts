import { getAbiItem, type Hex, type PublicClient } from 'viem';
import type { Db } from 'mongodb';
import { factoryAbi } from './abi';
import { unpackPrepared } from './journal';
import { PONS_CHAIN_ID, PONS_FACTORY, sameAddress, validHash } from './policy';
import { reconcileLaunchReceipt, type LaunchReceiptState } from './receipt';
import { LaunchStore, type LaunchIntent } from './store';

type RecoveryPatch = Parameters<LaunchStore['finish']>[1];
const event = getAbiItem({ abi: factoryAbi, name: 'TokenLaunched' });
const emptyCode = (code: Hex | undefined) => !code || code === '0x';
const patchFor = (state: LaunchReceiptState, hash: Hex): RecoveryPatch => state.state === 'confirmed'
  ? { phase: 'confirmed', transactionHash: hash, token: state.token }
  : state.state === 'reverted' ? { phase: 'reverted', transactionHash: hash }
    : { phase: state.state === 'confirming' ? 'confirming' : 'submitted', transactionHash: hash, receiptConfirmed: state.receiptConfirmed === true };

/** Bounded, read-only chain recovery. All writes are made through the leased journal. */
export async function recoverLaunch(client: PublicClient, intent: LaunchIntent): Promise<RecoveryPatch> {
  if (!intent.prepared || intent.nonce === undefined) throw Error('This launch has no saved transaction.');
  const prepared = unpackPrepared(intent.prepared);
  const expected = { candidate: prepared.candidate, prediction: prepared.prediction, nonce: intent.nonce };
  if (!sameAddress(expected.candidate.from, intent.signer) || expected.candidate.params.salt !== intent.salt
    || intent.nonce !== prepared.transaction.nonce) throw Error('Saved launch identity does not match its transaction.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Recovery is connected to the wrong chain.');
  let known: RecoveryPatch | undefined;
  if (intent.transactionHash) {
    const state = await reconcileLaunchReceipt(client, expected, intent.transactionHash);
    if (state.state === 'confirmed' || state.state === 'reverted') return patchFor(state, intent.transactionHash);
    known = patchFor(state, intent.transactionHash);
  }
  const finalized = await client.getBlock({ blockTag: 'finalized' });
  if (finalized.number === null || !finalized.hash) throw Error('Finalized chain state is unavailable.');
  const fromBlock = BigInt(intent.nextBlock || expected.candidate.blockNumber.toString());
  if (fromBlock > finalized.number) return known || { phase: 'awaiting-signature' };
  const toBlock = fromBlock + 1999n < finalized.number ? fromBlock + 1999n : finalized.number;
  const before = await client.getBlock({ blockNumber: toBlock });
  const logs = await client.getLogs({ address: PONS_FACTORY, event,
    args: { token: expected.prediction.token, deployer: expected.candidate.from }, fromBlock, toBlock, strict: true });
  const after = await client.getBlock({ blockNumber: toBlock });
  if (!before.hash || before.hash !== after.hash) return known || { phase: 'confirming' };
  const candidates = logs.filter(log => !log.removed && log.transactionHash);
  if (candidates.length > 1) throw Error('More than one launch matched. Operator review is required.');
  if (candidates.length === 1) {
    const hash = candidates[0].transactionHash;
    return patchFor(await reconcileLaunchReceipt(client, expected, hash), hash);
  }
  if (toBlock === finalized.number) {
    const [nonce, code] = await Promise.all([
      client.getTransactionCount({ address: expected.candidate.from, blockNumber: finalized.number }),
      client.getCode({ address: expected.prediction.token, blockNumber: finalized.number }),
    ]);
    const canonical = await client.getBlock({ blockNumber: finalized.number });
    if (canonical.hash !== finalized.hash) return known || { phase: 'confirming' };
    if (!emptyCode(code)) return { ...(known || { phase: 'confirming' }), nextBlock: expected.candidate.blockNumber.toString(), lastError: 'Token exists but its receipt needs review.' };
    if (nonce > intent.nonce) return { phase: 'cancelled', cancellationEvidence: { blockNumber: finalized.number.toString(), blockHash: finalized.hash, consumedNonce: nonce } };
  }
  return { ...(known || { phase: 'awaiting-signature' }), nextBlock: (toBlock + 1n).toString() };
}

/** The API must verify a wallet-returned hash before admitting it to recovery. */
export async function acceptBroadcast(client: PublicClient, store: LaunchStore, intent: LaunchIntent, hash: Hex) {
  if (!intent.prepared || !validHash(hash)) throw Error('Invalid saved launch or transaction hash.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Wrong transaction chain.');
  const { candidate, transaction } = unpackPrepared(intent.prepared);
  const actual = await client.getTransaction({ hash });
  if (actual.hash.toLowerCase() !== hash.toLowerCase() || !sameAddress(actual.from, intent.signer) || !sameAddress(actual.to || '', candidate.to)
    || actual.nonce !== transaction.nonce || actual.value !== candidate.value || actual.input.toLowerCase() !== candidate.data.toLowerCase()) throw Error('This transaction does not match the saved launch.');
  return store.recordHash(intent, hash);
}

export async function runLaunchRecovery(db: Db, client: PublicClient, options: { limit?: number; budgetMs?: number; agentId?: string } = {}) {
  const limit = Math.min(10, Math.max(1, options.limit || 5));
  const deadline = Date.now() + Math.min(45_000, Math.max(1000, options.budgetMs || 30_000));
  const store = new LaunchStore(db);
  const result = { checked: 0, confirmed: 0, published: 0, errors: 0 };
  for (let i = 0; i < limit && Date.now() < deadline; i++) {
    const intent = await store.claim(new Date(), options.agentId);
    if (!intent) break;
    result.checked++;
    try {
      if (intent.phase === 'confirmed') {
        await store.publish(intent);
        await store.finish(intent, {});
        result.published++;
        continue;
      }
      const patch = await recoverLaunch(client, intent);
      const updated = await store.finish(intent, patch);
      if (updated?.phase === 'confirmed') {
        result.confirmed++;
        await store.publish(updated);
        result.published++;
      }
    } catch {
      result.errors++;
      // RPC error objects can contain credential-bearing URLs: persist only a safe message.
      await store.finish(intent, { lastError: 'Recovery could not complete. The launch remains reserved.' });
    }
  }
  return result;
}

export async function acceptCancellation(client: PublicClient, store: LaunchStore, intent: LaunchIntent, hash: Hex) {
  if (!intent.cancellationReview || !validHash(hash) || await client.getChainId() !== PONS_CHAIN_ID) throw Error('Invalid cancellation review.');
  const expected = unpackPrepared(intent.cancellationReview).transaction;
  const actual = await client.getTransaction({ hash });
  if (actual.hash.toLowerCase() !== hash.toLowerCase() || !sameAddress(actual.from,intent.signer)
    || !sameAddress(actual.to || '',intent.signer) || actual.nonce !== expected.nonce
    || actual.value !== 0n || actual.input !== '0x') throw Error('This is not the reviewed cancellation.');
  return store.recordCancellation(intent,hash);
}
