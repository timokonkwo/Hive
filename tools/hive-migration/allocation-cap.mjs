// Read-only economics. A ceiling is not an approved allocation or payout promise.
// Old HIVE has 9 decimals; new HIVE has 18 decimals.
const raw = value => {
  if (typeof value !== 'bigint' || value < 0n) throw Error('Nonnegative bigint raw units required');
  return value;
};
export function maximumNewHive(oldHiveRaw) {
  // 70 / 100 * 10^(18 - 9), exact even for one source raw unit.
  return raw(oldHiveRaw) * 700_000_000n;
}
export function surrenderCeiling(snapshotOldRaw, spendableOldRaw) {
  raw(snapshotOldRaw); raw(spendableOldRaw);
  const eligibleOldRaw = snapshotOldRaw < spendableOldRaw ? snapshotOldRaw : spendableOldRaw;
  return {eligibleOldRaw, maximumNewRaw: maximumNewHive(eligibleOldRaw)};
}
export function checkAllocation({snapshotOldRaw, allocationNewRaw}) {
  raw(allocationNewRaw);
  if (allocationNewRaw > maximumNewHive(snapshotOldRaw)) throw Error('Allocation exceeds the 70% ceiling');
  return allocationNewRaw;
}
