import { managedOwnerPreview } from './policy';
import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { keccak256, toHex, type PublicClient } from 'viem';
import { launchReview, type ReviewChoices } from './authorization';
import { HIVE_LAUNCH_WALLET, PONS_CHAIN_ID, sameAddress } from './policy';
import { packPrepared, unpackPrepared } from './journal';
import { prepareVerifiedLaunch } from './preparation';
import { prepareReviewedLaunch, simulateLaunchCandidate } from './transaction';
import { readLaunchSnapshot, assertReviewedRelease, type ReviewedRelease } from './snapshot';
import { LaunchConflict, LaunchStore, ManagedDeployerBusy, type LaunchIntent } from './store';
import { runLaunchRecovery } from './worker';
import { managedAccount, managedDeployerStatus, openSubmission, sealSubmission } from './managed-signer';
import type { LaunchPreview } from './types';

interface Services {
  release: ReviewedRelease;
  persistAvatar: (preview: LaunchPreview) => Promise<string>;
  refreshPreview: () => Promise<LaunchPreview>;
}
export function requireManagedAdmin(preview: LaunchPreview, enabled = true) {
  if (preview.role !== 'admin' && !managedOwnerPreview(preview)) throw new LaunchConflict('Only admins can use Hive deployer.');
  if (enabled) {
    const status = managedDeployerStatus();
    if (!status.available) throw new LaunchConflict(status.reason!);
  }
}
function assertManaged(intent: LaunchIntent) {
  if (intent.mode !== 'managed' || (intent.preview.role !== 'admin' && !managedOwnerPreview(intent.preview)) || !sameAddress(intent.signer, HIVE_LAUNCH_WALLET)) {
    throw new LaunchConflict('This launch uses a connected wallet.');
  }
}
function assertCurrent(intent: LaunchIntent, preview: LaunchPreview) {
  assertManaged(intent);
  if (!intent.choices || launchReview({ ...preview, feePolicyVersion: intent.preview.feePolicyVersion }, intent.signer, intent.choices).digest !== intent.reviewDigest) {
    throw new LaunchConflict('Agent details changed. Discard this review and start again.');
  }
}
/** Preparation is not permission to spend. Only confirmManagedLaunch authorizes a submission. */
export async function prepareManagedLaunch(db: Db, client: PublicClient, preview: LaunchPreview, choices: ReviewChoices, services: Services) {
  requireManagedAdmin(preview);
  const current = await new LaunchStore(db).current(preview.agentId);
  const reviewedPreview = current?.active ? { ...preview, feePolicyVersion: current.preview.feePolicyVersion } : preview;
  const review = launchReview(reviewedPreview, HIVE_LAUNCH_WALLET, choices);
  if (current?.active && current.mode !== 'managed') throw new LaunchConflict('Resume or cancel this agent’s connected-wallet launch first.');
  if (current?.active && current.reviewDigest !== review.digest) throw new LaunchConflict('Discard the saved review before changing launch settings.');
  const prepare = () => prepareVerifiedLaunch(db, client, reviewedPreview, {
    _id: current?.active ? current._id : randomUUID(), signer: HIVE_LAUNCH_WALLET, ...review,
  }, services, 'managed');
  try {
    try { return await prepare(); }
    catch (error) {
      if (!(error instanceof ManagedDeployerBusy)) throw error;
      // A different agent may have finalized since its last check. Recover its
      // receipt through the normal leased journal; never discard or unlock it.
      await runLaunchRecovery(db, client, { agentId: error.agentId, limit: 1, budgetMs: 8000 });
      return await prepare();
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'This wallet needs more ETH for the launch and network fee.') {
      throw new LaunchConflict('Hive deployer needs more ETH. Fund it or discard this review and use a connected wallet.');
    }
    throw error;
  }
}
export function managedQuote(intent: LaunchIntent) {
  assertManaged(intent);
  if (!intent.prepared || intent.managedSubmission || intent.phase !== 'awaiting-signature') {
    return { id: intent._id, mode: 'managed', phase: intent.phase, transaction: null };
  }
  const prepared = unpackPrepared(intent.prepared), tx = prepared.transaction;
  return { id: intent._id, mode: 'managed', confirmation: intent.prepared.digest, phase: intent.phase,
    expiresAt: prepared.expiresAt.toString(), maximumNetworkFee: prepared.maximumNetworkFee.toString(), maximumTotal: prepared.maximumTotal.toString(),
    launchFee: (prepared.candidate.value - prepared.candidate.budget).toString(), purchase: prepared.candidate.budget.toString(),
    transaction: { chainId: toHex(tx.chainId), from: tx.from, to: tx.to, data: tx.data, value: toHex(tx.value), nonce: toHex(tx.nonce),
      gas: toHex(tx.gas), maxFeePerGas: toHex(tx.maxFeePerGas), maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas) } };
}
export async function refreshManagedLaunch(db: Db, client: PublicClient, intent: LaunchIntent, services: Services) {
  requireManagedAdmin(await services.refreshPreview());
  assertCurrent(intent, await services.refreshPreview());
  if (intent.managedSubmission || !intent.prepared || intent.phase !== 'awaiting-signature') throw new LaunchConflict('Check this launch’s status before continuing.');
  const snapshot = await readLaunchSnapshot(client, HIVE_LAUNCH_WALLET);
  const prepared = await prepareReviewedLaunch(client, intent.preview, {
    signer: HIVE_LAUNCH_WALLET, ...intent.choices!, salt: intent.salt, logoURI: intent.logoURI!,
  }, snapshot, services.release);
  assertCurrent(intent, await services.refreshPreview());
  if (prepared.transaction.nonce !== intent.nonce) throw new LaunchConflict('Hive deployer has been used elsewhere. Discard this unsigned review and start again.');
  const updated = await db.collection<LaunchIntent>('pons_launch_intents').findOneAndUpdate({ _id: intent._id, revision: intent.revision,
    phase: 'awaiting-signature', managedSubmission: { $exists: false } }, {
    $set: { prepared: packPrepared(prepared), updatedAt: new Date() }, $inc: { revision: 1 },
  }, { returnDocument: 'after' });
  if (!updated) throw new LaunchConflict('The launch changed. Check its status.');
  return updated;
}
/** Safe because no managed transaction is exposed to a wallet or signed until confirmation. */
export async function discardManagedLaunch(db: Db, intent: LaunchIntent) {
  assertManaged(intent);
  const updated = await db.collection<LaunchIntent>('pons_launch_intents').findOneAndUpdate({ _id: intent._id, revision: intent.revision,
    phase: { $in: ['draft', 'awaiting-signature'] }, managedSubmission: { $exists: false },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }] }, {
    $set: { phase: 'cancelled', active: false, managedPending: false, updatedAt: new Date() },
    $unset: { nonce: '' }, $inc: { revision: 1 },
  }, { returnDocument: 'after' });
  if (!updated) throw new LaunchConflict('This launch is being prepared or has been submitted. Check its status.');
  return updated;
}
export async function confirmManagedLaunch(db: Db, client: PublicClient, intent: LaunchIntent, confirmation: unknown, services: Services) {
  assertManaged(intent);
  if (!intent.prepared || confirmation !== intent.prepared.digest) throw new LaunchConflict('The review changed. Review the launch again.');
  // An HTTP retry never signs again, including after quote expiry or profile publication.
  if (intent.managedSubmission) {
    if (!['confirmed', 'cancelled', 'reverted'].includes(intent.phase)) await broadcastManagedSubmission(client, intent);
    return intent;
  }
  requireManagedAdmin(await services.refreshPreview());
  assertCurrent(intent, await services.refreshPreview());
  if (intent.phase !== 'awaiting-signature') throw new LaunchConflict('Check this launch’s status before continuing.');
  const prepared = unpackPrepared(intent.prepared), tx = prepared.transaction;
  const assertFresh = () => {
    if (prepared.expiresAt * 1000n <= BigInt(Date.now())) throw new LaunchConflict('Fee estimate expired. Review the launch again.');
  };
  assertFresh();
  const snapshot = await readLaunchSnapshot(client, HIVE_LAUNCH_WALLET);
  assertReviewedRelease(snapshot, services.release);
  const candidate = prepared.candidate;
  if (snapshot.expectedEconomics !== candidate.params.expectedEconomics) throw new LaunchConflict('Launch pricing changed. Review the launch again.');
  const predicted = await simulateLaunchCandidate(client, { ...candidate, blockNumber: snapshot.blockNumber, blockHash: snapshot.blockHash });
  if (!sameAddress(predicted.token, prepared.prediction.token) || !sameAddress(predicted.curve, prepared.prediction.curve)
    || predicted.tokensOut !== prepared.prediction.tokensOut) throw new LaunchConflict('The launch result changed. Review the launch again.');
  const [nonce, balance, code] = await Promise.all([
    client.getTransactionCount({ address: HIVE_LAUNCH_WALLET, blockTag: 'pending' }),
    client.getBalance({ address: HIVE_LAUNCH_WALLET, blockTag: 'pending' }),
    client.getCode({ address: HIVE_LAUNCH_WALLET }),
  ]);
  if (nonce !== tx.nonce || (code && code !== '0x')) throw new LaunchConflict('Hive deployer changed. Review the launch again.');
  if (balance < prepared.maximumTotal) throw new LaunchConflict('Hive deployer needs more ETH. Fund it or discard this review and use a connected wallet.');
  assertCurrent(intent, await services.refreshPreview());
  assertFresh();
  const raw = await managedAccount().signTransaction({ type: 'eip1559', chainId: PONS_CHAIN_ID,
    to: tx.to, data: tx.data, value: tx.value, nonce: tx.nonce, gas: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas });
  const hash = keccak256(raw), sealed = sealSubmission(raw, intent._id);
  assertFresh();
  // CAS fences refresh, discard and concurrent confirmations. Losing signers never broadcast.
  const saved = await db.collection<LaunchIntent>('pons_launch_intents').findOneAndUpdate({ _id: intent._id, revision: intent.revision,
    phase: 'awaiting-signature', 'prepared.digest': confirmation, managedSubmission: { $exists: false } }, {
    $set: { managedSubmission: sealed, transactionHash: hash, phase: 'submitted', updatedAt: new Date(), nextCheckAt: new Date() },
    $inc: { revision: 1 },
  }, { returnDocument: 'after' });
  if (!saved) throw new LaunchConflict('The launch changed. Check its status.');
  await broadcastManagedSubmission(client, saved);
  return saved;
}
/** Only replays already-authorized bytes; never signs, reprices or constructs a new call. */
export async function broadcastManagedSubmission(client: PublicClient, intent: LaunchIntent) {
  assertManaged(intent);
  if (!intent.managedSubmission || !intent.transactionHash) throw new LaunchConflict('No authorized submission exists.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Wrong broadcast network.');
  const raw = openSubmission(intent.managedSubmission, intent._id);
  if (keccak256(raw) !== intent.transactionHash) throw Error('Submission journal mismatch.');
  try {
    const hash = await client.sendRawTransaction({ serializedTransaction: raw });
    if (hash !== intent.transactionHash) throw Error('Unexpected transaction hash.');
  } catch {
    // Includes already-known, lost response and temporary RPC failures. Durable
    // receipt recovery remains authoritative; the same bytes can be retried.
    return false;
  }
  return true;
}
export async function retryManagedSubmissions(db: Db, client: PublicClient) {
  if (!process.env.PONS_MANAGED_PRIVATE_KEY) return;
  const pending = await db.collection<LaunchIntent>('pons_launch_intents').find({ mode: 'managed',
    phase: { $in: ['submitted', 'confirming', 'awaiting-signature'] }, managedSubmission: { $exists: true } }).limit(1).toArray();
  for (const intent of pending) await broadcastManagedSubmission(client, intent);
}
