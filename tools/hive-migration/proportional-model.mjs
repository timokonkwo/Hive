import {maximumNewHive} from './allocation-cap.mjs';
const nonnegative = value => {
  if (typeof value !== 'bigint' || value < 0n) throw Error('Nonnegative bigint required');
  return value;
};
// Keep this denominator fixed for the campaign; claims cannot increase later payouts.
export function proportionalQuote(oldRaw, totalEligibleOldRaw, budgetNewRaw) {
  nonnegative(oldRaw); nonnegative(totalEligibleOldRaw); nonnegative(budgetNewRaw);
  if (totalEligibleOldRaw === 0n || oldRaw > totalEligibleOldRaw) throw Error('Invalid eligible total');
  const share = oldRaw * budgetNewRaw / totalEligibleOldRaw;
  const cap = maximumNewHive(oldRaw);
  return share < cap ? share : cap;
}
export function proportionalAllocation(holders, budgetNewRaw) {
  nonnegative(budgetNewRaw);
  const owners = new Set();
  const totalEligibleOldRaw = holders.reduce((sum, h) => {
    if (!h.owner || owners.has(h.owner)) throw Error('Missing or duplicate owner');
    owners.add(h.owner);
    if (nonnegative(h.amountRaw) === 0n) throw Error('Positive holdings required');
    return sum + h.amountRaw;
  }, 0n);
  if (!totalEligibleOldRaw) throw Error('Empty eligible population');
  const rows = holders.map(h => ({...h, allocationNewRaw: proportionalQuote(h.amountRaw, totalEligibleOldRaw, budgetNewRaw)}));
  const allocatedNewRaw = rows.reduce((sum, h) => sum + h.allocationNewRaw, 0n);
  return {totalEligibleOldRaw, budgetNewRaw, allocatedNewRaw, unallocatedNewRaw: budgetNewRaw - allocatedNewRaw, rows};
}
