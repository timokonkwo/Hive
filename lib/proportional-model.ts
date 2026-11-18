// Mathematical calculation model for proportional claims and ceilings.

const raw = (value: bigint): bigint => {
  if (typeof value !== 'bigint' || value < 0n) throw Error('Nonnegative bigint raw units required');
  return value;
};

export function maximumNewHive(oldHiveRaw: bigint): bigint {
  // 70 / 100 * 10^(18 - 9), exact even for one source raw unit.
  return raw(oldHiveRaw) * 700_000_000n;
}

export function surrenderCeiling(snapshotOldRaw: bigint, spendableOldRaw: bigint) {
  raw(snapshotOldRaw);
  raw(spendableOldRaw);
  const eligibleOldRaw = snapshotOldRaw < spendableOldRaw ? snapshotOldRaw : spendableOldRaw;
  return { eligibleOldRaw, maximumNewRaw: maximumNewHive(eligibleOldRaw) };
}

export function checkAllocation({ snapshotOldRaw, allocationNewRaw }: { snapshotOldRaw: bigint; allocationNewRaw: bigint }): bigint {
  raw(allocationNewRaw);
  if (allocationNewRaw > maximumNewHive(snapshotOldRaw)) throw Error('Allocation exceeds the 70% ceiling');
  return allocationNewRaw;
}

export function proportionalQuote(oldRaw: bigint, totalEligibleOldRaw: bigint, budgetNewRaw: bigint): bigint {
  raw(oldRaw);
  raw(totalEligibleOldRaw);
  raw(budgetNewRaw);
  if (totalEligibleOldRaw === 0n || oldRaw > totalEligibleOldRaw) throw Error('Invalid eligible total');
  const share = (oldRaw * budgetNewRaw) / totalEligibleOldRaw;
  const cap = maximumNewHive(oldRaw);
  return share < cap ? share : cap;
}

export interface HolderEntry {
  owner: string;
  amountRaw: bigint;
  [key: string]: unknown;
}

export function proportionalAllocation<T extends HolderEntry>(holders: T[], budgetNewRaw: bigint) {
  raw(budgetNewRaw);
  const owners = new Set<string>();
  const totalEligibleOldRaw = holders.reduce((sum, h) => {
    if (!h.owner || owners.has(h.owner)) throw Error('Missing or duplicate owner');
    owners.add(h.owner);
    if (raw(h.amountRaw) === 0n) throw Error('Positive holdings required');
    return sum + h.amountRaw;
  }, 0n);
  if (!totalEligibleOldRaw) throw Error('Empty eligible population');
  const rows = holders.map(h => ({
    ...h,
    allocationNewRaw: proportionalQuote(h.amountRaw, totalEligibleOldRaw, budgetNewRaw),
  }));
  const allocatedNewRaw = rows.reduce((sum, h) => sum + h.allocationNewRaw, 0n);
  return {
    totalEligibleOldRaw,
    budgetNewRaw,
    allocatedNewRaw,
    unallocatedNewRaw: budgetNewRaw - allocatedNewRaw,
    rows,
  };
}
