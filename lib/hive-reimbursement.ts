import { PublicKey } from '@solana/web3.js';
import { proportionalQuote } from '../tools/hive-migration/proportional-model.mjs';

export const reimbursementCampaign = {
  snapshotSlot: 449032979,
  snapshotAt: '2026-09-21T10:48:43.000Z',
  holdersSha256: 'cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa',
  sourceMint: '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',
  destinationToken: '0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8',
  pool: 'HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC',
  budgetRaw: '10000000000000000000000000',
  candidateOldRaw: '582229876983614953',
  eligibleOldRaw: '564937895383759533',
  eligibleWalletCount: 72,
  candidateCount: 247,
  allowPartialSurrender: true,
  minimumCurrentHoldingRaw: '1000000000000000',
} as const;
export type HolderKind = 'wallet' | 'custody' | 'pool';
export type Snapshot = { slot: number; capturedAt: string; holdersSha256: string; sourceMint: string; holders: { owner: string; amountRaw: string; kind: string }[] };
export type CurrentBalance = { status: 'available'; amountRaw: string; slot: number; checkedAt: string } | { status: 'unavailable' | 'not-requested'; amountRaw: null; slot: null; checkedAt: null };
export type ReimbursementLookup = {
  owner: string;
  status: 'allocation-pending' | 'custody-review' | 'pool-excluded' | 'not-in-snapshot';
  snapshotBalanceRaw: string | null;
  estimateRaw: string | null;
  approvedAllocationRaw: null;
  requiredSurrenderRaw: null;
  claimStatus: 'not-open';
  claimDeadline: null;
  claimsEnabled: false;
  allowPartialSurrender: true;
  currentBalance: CurrentBalance;
  availableWithinSnapshotRaw: string | null;
};
export function publicSolanaAddress(input: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) throw Error('Enter a valid public Solana wallet address.');
  try { const key = new PublicKey(input); if (key.toBase58() !== input) throw Error(); return key.toBase58(); }
  catch { throw Error('Enter a valid public Solana wallet address.'); }
}
export function validateCheckerSnapshot(snapshot: Snapshot) {
  const c = reimbursementCampaign;
  if (snapshot.slot !== c.snapshotSlot || snapshot.capturedAt !== c.snapshotAt || snapshot.holdersSha256 !== c.holdersSha256 || snapshot.sourceMint !== c.sourceMint) throw Error('Checker snapshot identity mismatch');
  const seen = new Set<string>(); let total = 0n, poolCount = 0;
  for (const h of snapshot.holders) {
    publicSolanaAddress(h.owner);
    if (seen.has(h.owner) || !/^[1-9][0-9]*$/.test(h.amountRaw) || BigInt(h.amountRaw) >= 2n ** 64n) throw Error('Invalid snapshot holding');
    seen.add(h.owner);
    const kind = h.owner === c.pool ? 'pool' : PublicKey.isOnCurve(new PublicKey(h.owner).toBytes()) ? 'wallet' : 'custody';
    if (h.kind !== kind) throw Error('Snapshot classification mismatch');
    if (kind === 'pool') poolCount++; else total += BigInt(h.amountRaw);
  }
  if (poolCount !== 1 || seen.size !== c.candidateCount + 1 || total.toString() !== c.candidateOldRaw) throw Error('Checker snapshot totals mismatch');
}
export function lookupReimbursement(snapshot: Snapshot, address: string, balance: CurrentBalance): ReimbursementLookup {
  const owner = publicSolanaAddress(address), h = snapshot.holders.find(row => row.owner === owner);
  // This is a provisional population, never a reviewed Merkle tree or claim authorization.
  const status = !h ? 'not-in-snapshot' : h.kind === 'pool' ? 'pool-excluded' : h.kind === 'custody' ? 'custody-review' : 'allocation-pending';
  const estimateRaw = status === 'allocation-pending' && h ? proportionalQuote(BigInt(h.amountRaw), BigInt(reimbursementCampaign.eligibleOldRaw), BigInt(reimbursementCampaign.budgetRaw)).toString() : null;
  const available = h && balance.status === 'available' ? (BigInt(h.amountRaw) < BigInt(balance.amountRaw) ? h.amountRaw : balance.amountRaw) : null;
  return { owner, status, snapshotBalanceRaw: h?.amountRaw ?? null, estimateRaw, approvedAllocationRaw: null, requiredSurrenderRaw: null, claimStatus: 'not-open', claimDeadline: null, claimsEnabled: false, allowPartialSurrender: reimbursementCampaign.allowPartialSurrender, currentBalance: balance, availableWithinSnapshotRaw: available };
}

/** Validate the untrusted HTTP boundary before rendering or doing integer arithmetic. */
export function isReimbursementLookup(value: unknown, owner: string): value is ReimbursementLookup {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const raw = (n: unknown): n is string => typeof n === 'string' && n.length <= 39 && /^(0|[1-9][0-9]*)$/.test(n);
  if (v.owner !== owner || !['allocation-pending', 'custody-review', 'pool-excluded', 'not-in-snapshot'].includes(String(v.status)) || v.claimsEnabled !== false || v.allowPartialSurrender !== true || v.claimStatus !== 'not-open' || v.claimDeadline !== null || v.approvedAllocationRaw !== null || v.requiredSurrenderRaw !== null) return false;
  if (v.status === 'not-in-snapshot' ? v.snapshotBalanceRaw !== null : !raw(v.snapshotBalanceRaw) || BigInt(v.snapshotBalanceRaw) <= 0n || BigInt(v.snapshotBalanceRaw) >= 2n ** 64n) return false;
  if (v.status === 'allocation-pending') {
    if (!raw(v.estimateRaw) || !raw(v.snapshotBalanceRaw) || BigInt(v.snapshotBalanceRaw) > BigInt(reimbursementCampaign.candidateOldRaw)) return false;
    if (v.estimateRaw !== proportionalQuote(BigInt(v.snapshotBalanceRaw), BigInt(reimbursementCampaign.eligibleOldRaw), BigInt(reimbursementCampaign.budgetRaw)).toString()) return false;
  } else if (v.estimateRaw !== null) return false;
  if (!v.currentBalance || typeof v.currentBalance !== 'object') return false;
  const b = v.currentBalance as Record<string, unknown>;
  if (b.status === 'available') {
    if (!raw(b.amountRaw) || BigInt(b.amountRaw) >= 2n ** 64n || typeof b.slot !== 'number' || !Number.isSafeInteger(b.slot) || b.slot < reimbursementCampaign.snapshotSlot || typeof b.checkedAt !== 'string' || !Number.isFinite(Date.parse(b.checkedAt))) return false;
    const expected = raw(v.snapshotBalanceRaw) ? (BigInt(v.snapshotBalanceRaw) < BigInt(b.amountRaw) ? v.snapshotBalanceRaw : b.amountRaw) : null;
    if (v.availableWithinSnapshotRaw !== expected) return false;
  } else if (!['unavailable', 'not-requested'].includes(String(b.status)) || b.amountRaw !== null || b.slot !== null || b.checkedAt !== null || v.availableWithinSnapshotRaw !== null) return false;
  return true;
}
