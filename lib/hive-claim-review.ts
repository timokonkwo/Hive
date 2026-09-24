import type { ReimbursementLookup } from './hive-reimbursement';
import { reimbursementCampaign, supplementalClaim } from './hive-reimbursement';
import { proportionalQuote } from '../tools/hive-migration/proportional-model.mjs';
export type MigrationReview = {
  status: 'snapshot-required' | 'snapshot-below-minimum' | 'custody-review' | 'balance-unavailable' | 'no-holdings' | 'below-minimum' | 'invalid-amount' | 'campaign-pending';
  depositRaw: string | null;
  receiveRaw: string | null;
  executable: false;
};
/** A review is an estimate, never a signed quote. Recheck through the server before showing it. */
export function migrationReview(result: ReimbursementLookup, requestedRaw?: string): MigrationReview {
  const blocked = (status: MigrationReview['status']): MigrationReview => ({ status, depositRaw: null, receiveRaw: null, executable: false });
  if (result.status === 'custody-review') return blocked('custody-review');
  const extra=result.status==='approved-exception' && result.owner===supplementalClaim.owner;
  const allowance=extra?supplementalClaim.allowanceRaw:result.snapshotBalanceRaw;
  if ((!extra && result.status !== 'allocation-pending') || allowance === null) return blocked('snapshot-required');
  if (BigInt(allowance) < BigInt(reimbursementCampaign.minimumCurrentHoldingRaw)) return blocked('snapshot-below-minimum');
  if (result.currentBalance.status !== 'available') return blocked('balance-unavailable');
  const frozen = BigInt(allowance), current = BigInt(result.currentBalance.amountRaw);
  if (current === 0n) return blocked('no-holdings');
  if (current < BigInt(reimbursementCampaign.minimumCurrentHoldingRaw)) return blocked('below-minimum');
  const maximum = frozen < current ? frozen : current;
  if (requestedRaw !== undefined && (!/^[1-9][0-9]*$/.test(requestedRaw) || requestedRaw.length > 20 || BigInt(requestedRaw) > maximum)) return blocked('invalid-amount');
  const deposit = requestedRaw === undefined ? maximum : BigInt(requestedRaw);
  return { status: 'campaign-pending', depositRaw: deposit.toString(), receiveRaw: proportionalQuote(deposit, BigInt(extra?supplementalClaim.allowanceRaw:reimbursementCampaign.eligibleOldRaw), BigInt(extra?supplementalClaim.grantRaw:reimbursementCampaign.budgetRaw)).toString(), executable: false };
}

/** Exact human input; abbreviated display values must never become deposit amounts. */
export function parseOldHiveInput(value: string): string | null {
  if (value.length > 30 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const raw = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
  return raw > 0n && raw < 2n ** 64n ? raw.toString() : null;
}
