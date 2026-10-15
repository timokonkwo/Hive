import type { PublicClient } from 'viem';
import { unpackPrepared } from './journal';
import { PONS_CHAIN_ID, sameAddress } from './policy';
import { assertReviewedRelease, readLaunchSnapshot, type ReviewedRelease } from './snapshot';
import { LaunchConflict, LaunchStore, type LaunchIntent } from './store';
import { simulateLaunchCandidate } from './transaction';

/** Reprice the same call/nonce, or review a zero-value self transaction to consume it. */
export async function reviewSavedLaunch(client: PublicClient, store: LaunchStore, intent: LaunchIntent,
  action: 'resume' | 'cancel', release: ReviewedRelease | null) {
  if (!intent.prepared || intent.nonce === undefined || !['awaiting-signature','submitted','confirming'].includes(intent.phase)) throw new LaunchConflict('Check the latest launch status before continuing.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Wrong network.');
  const prepared = unpackPrepared(intent.prepared), saved = prepared.transaction;
  const block = await client.getBlock({ blockTag: 'latest' });
  if (block.number === null) throw Error('Chain state is unavailable.');
  if (await client.getTransactionCount({ address: saved.from, blockNumber: block.number! }) > intent.nonce) throw new LaunchConflict('A transaction is already included. Wait for confirmation.');
  const code = await client.getCode({ address: saved.from, blockNumber: block.number! });
  if (code && code !== '0x') throw Error('This wallet needs a supported direct-transaction adapter.');
  if (action === 'resume') {
    if (!release) throw new LaunchConflict('Launches are paused. You can wait or cancel the pending launch.');
    const snapshot = await readLaunchSnapshot(client, saved.from);
    assertReviewedRelease(snapshot, release);
    if (snapshot.expectedEconomics !== prepared.candidate.params.expectedEconomics) throw new LaunchConflict('Launch pricing changed. Cancel this pending launch before starting again.');
    const prediction = await simulateLaunchCandidate(client, { ...prepared.candidate, blockNumber:snapshot.blockNumber, blockHash:snapshot.blockHash });
    if (!sameAddress(prediction.token,prepared.prediction.token) || !sameAddress(prediction.curve,prepared.prediction.curve)
      || prediction.tokensOut !== prepared.prediction.tokensOut) throw new LaunchConflict('The launch result changed. Cancel this pending launch before starting again.');
  }
  const call = action === 'cancel' ? { from: saved.from, to: saved.from, data: '0x' as const, value: 0n } : saved;
  // A replacement always retains the exact saved nonce. No second launch can execute.
  const [gasEstimate, fees, balance] = await Promise.all([
    // Evaluate confirmed state: a pending copy must not consume the balance or
    // deploy the predicted token a second time during replacement simulation.
    client.estimateGas({ account: call.from, to: call.to, data: call.data, value: call.value, blockNumber:block.number }),
    client.estimateFeesPerGas(), client.getBalance({ address: saved.from, blockNumber:block.number }),
  ]);
  if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) throw Error('Network fees are unavailable.');
  const bump = (n: bigint) => (n * 125n + 99n) / 100n;
  const max = (a: bigint,b: bigint) => a > b ? a : b;
  const gas = (gasEstimate * 120n + 99n) / 100n;
  const cancellation = intent.cancellationReview ? unpackPrepared(intent.cancellationReview).transaction : saved;
  const maxPriorityFeePerGas = max(fees.maxPriorityFeePerGas, bump(max(saved.maxPriorityFeePerGas,cancellation.maxPriorityFeePerGas)));
  const maxFeePerGas = max(max(fees.maxFeePerGas,bump(max(saved.maxFeePerGas,cancellation.maxFeePerGas))),maxPriorityFeePerGas);
  const maximumNetworkFee = gas * maxFeePerGas;
  if (gas <= 0n) throw Error('Network fees are unavailable.');
  if (balance < call.value + maximumNetworkFee) throw new LaunchConflict('Add ETH to this wallet for the transaction and network fee.');
  const transaction = { chainId:PONS_CHAIN_ID, from:call.from,to:call.to,data:call.data,value:call.value,nonce:intent.nonce,gas,maxFeePerGas,maxPriorityFeePerGas };
  const expiresAt = BigInt(Math.floor(Date.now()/1000)+90);
  const updated = await store.saveReplacementReview(intent, action, { ...prepared, transaction, expiresAt, maximumNetworkFee, maximumTotal:call.value+maximumNetworkFee });
  if (!updated) throw new LaunchConflict('The launch changed. Check its status.');
  return { transaction, expiresAt, maximumNetworkFee, maximumTotal:call.value+maximumNetworkFee };
}
