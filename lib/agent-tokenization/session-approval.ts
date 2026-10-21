import { createHash, randomBytes } from 'node:crypto';
import { createPublicClient, http, formatUnits } from 'viem';
import type { Db } from 'mongodb';
import { SessionConflict, type LaunchSession } from './session';
import type { LaunchPreview } from './types';
import { persistTokenAvatar } from './avatar';
import { readLaunchSnapshot } from './snapshot';
import { prepareReviewedLaunch } from './transaction';
import { reviewedLaunchRelease, launchesEnabled } from './release';
import { prepareManagedLaunch, refreshManagedLaunch, confirmManagedLaunch } from './managed';
import { sessionPonsPreview } from './session-access';
import { unpackPrepared } from './journal';
import { LaunchStore } from './store';
import type { PlatformId } from './platforms';

export const ponsClient = () => createPublicClient({ transport: http(process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });

/** Limits are authorization ceilings, not fee estimates. No signing or reservation here. */
export async function estimateSession(session: LaunchSession, preview: LaunchPreview) {
  const limits: Partial<Record<PlatformId, string>> = {};
  for (const target of session.targets) {
    if (['confirmed', 'skipped'].includes(target.phase)) continue;
    if (target.terms.platform !== 'pons') {
      limits[target.terms.platform] = (BigInt(target.terms.purchase) + 100_000_000n).toString();
      continue;
    }
    if (!launchesEnabled()) throw new SessionConflict('Pons launches are unavailable. Remove Pons or try again later.');
    const p = { ...preview, metadata: target.metadata || session.metadata, recipient: target.terms.recipient, feePolicyVersion: 2 as const };
    const client = ponsClient(), snapshot = await readLaunchSnapshot(client, target.terms.signer as `0x${string}`);
    const balance = await client.getBalance({ address: target.terms.signer as `0x${string}`, blockTag: 'pending' });
    if (balance <= snapshot.launchFee + BigInt(target.terms.purchase)) throw new SessionConflict('The Pons wallet needs more ETH for launch fees. Fund it, choose another wallet, or remove Pons.');
    const prepared = await prepareReviewedLaunch(client, p, {
      signer: target.terms.signer as `0x${string}`, symbol: p.metadata.symbol, purchase: formatUnits(BigInt(target.terms.purchase), 18),
      logoURI: await persistTokenAvatar(p), salt: `0x${randomBytes(32).toString('hex')}`,
    }, snapshot, reviewedLaunchRelease).catch(error => {
      if (error?.walk?.((cause: { name?: string }) => cause.name === 'InsufficientFundsError')?.name === 'InsufficientFundsError'
        || /needs more ETH/.test(error instanceof Error ? error.message : '')) throw new SessionConflict('The Pons wallet needs more ETH for launch fees. Fund it, choose another wallet, or remove Pons.');
      throw error;
    });
    limits.pons = (prepared.candidate.value + prepared.maximumNetworkFee * 2n).toString();
  }
  const expiresAt = new Date(Date.now() + 300_000).toISOString();
  return { limits, expiresAt, digest: createHash('sha256').update(JSON.stringify([session.digest, limits, expiresAt])).digest('hex') };
}

export function approveSession(session: LaunchSession, digest: unknown): LaunchSession {
  const estimate = session.estimate;
  if (!estimate || estimate.digest !== digest || Date.parse(estimate.expiresAt) <= Date.now()) throw new SessionConflict('Launch costs changed. Review them again.');
  return { ...session, paused: false, editing: false, revision: session.revision + 1,
    targets: session.targets.map(t => ({ ...t, error: undefined })),
    approval: { digest: session.digest, limits: estimate.limits, reserved: {}, expiresAt: new Date(Date.now() + 86_400_000).toISOString() } };
}
export function approved(session: LaunchSession) {
  return !session.paused && !session.editing && session.approval?.digest === session.digest && Date.parse(session.approval.expiresAt) > Date.now();
}
/** Reserve before signing; replaying an identical step never consumes the budget twice. */
export function reserveSpend(session: LaunchSession, platform: PlatformId, key: string, amount: string): LaunchSession {
  if (!approved(session)) throw new SessionConflict('Review the remaining launches before continuing.');
  const approval = session.approval!;
  const previous = approval.reserved[key];
  if (previous) {
    if (previous.platform !== platform || previous.amount !== amount) throw new SessionConflict('The transaction cost changed.');
    return session;
  }
  const spent = Object.values(approval.reserved).filter(r => r.platform === platform).reduce((n, r) => n + BigInt(r.amount), 0n);
  if (BigInt(amount) < 0n || spent + BigInt(amount) > BigInt(approval.limits[platform] || '0')) throw new SessionConflict('Launch costs exceed your approved limit. Review the remaining launches.');
  return { ...session, revision: session.revision + 1, approval: { ...approval, reserved: { ...approval.reserved, [key]: { platform, amount } } } };
}

export async function prepareSessionPons(db: Db, session: LaunchSession, preview: LaunchPreview) {
  const refreshPreview = () => sessionPonsPreview(db, preview, session.id);
  const frozen = await refreshPreview(), target = session.targets.find(t => t.terms.platform === 'pons')!;
  const services = { release: reviewedLaunchRelease, persistAvatar: persistTokenAvatar, refreshPreview };
  const client = ponsClient();
  let intent = await prepareManagedLaunch(db, client, frozen, {
    symbol: frozen.metadata.symbol, purchase: formatUnits(BigInt(target.terms.purchase), 18),
  }, services);
  if (intent.prepared && !intent.managedSubmission && unpackPrepared(intent.prepared).expiresAt * 1000n <= BigInt(Date.now())) {
    intent = await refreshManagedLaunch(db, client, intent, services);
  }
  return { intent, client, services };
}
export async function confirmSessionPons(db: Db, prepared: Awaited<ReturnType<typeof prepareSessionPons>>) {
  const intent = await new LaunchStore(db).current(prepared.intent.agentId);
  if (!intent || intent._id !== prepared.intent._id || !intent.prepared) throw new SessionConflict('The Pons launch changed.');
  return confirmManagedLaunch(db, prepared.client, intent, intent.prepared.digest, prepared.services);
}
