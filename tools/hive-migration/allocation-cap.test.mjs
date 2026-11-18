import test from 'node:test';
import assert from 'node:assert/strict';
import {maximumNewHive, surrenderCeiling, checkAllocation} from './allocation-cap.mjs';
test('70% ceiling preserves whole-token conversion across 9 and 18 decimals', () => {
  assert.equal(maximumNewHive(10_000_000n * 10n ** 9n), 7_000_000n * 10n ** 18n);
  assert.equal(maximumNewHive(1n), 700_000_000n);
  assert.equal(maximumNewHive(0n), 0n);
});
test('new purchases cannot increase snapshot allowance; reduced holdings lower the ceiling', () => {
  assert.deepEqual(surrenderCeiling(10n, 20n), {eligibleOldRaw:10n, maximumNewRaw:7_000_000_000n});
  assert.deepEqual(surrenderCeiling(10n, 4n), {eligibleOldRaw:4n, maximumNewRaw:2_800_000_000n});
});
test('cap accepts smaller awards but rejects over-allocation and inexact numeric inputs', () => {
  assert.equal(checkAllocation({snapshotOldRaw:10n, allocationNewRaw:1n}), 1n);
  assert.throws(() => checkAllocation({snapshotOldRaw:10n, allocationNewRaw:7_000_000_001n}), /70%/);
  assert.throws(() => maximumNewHive(1), /bigint/);
  assert.throws(() => maximumNewHive(-1n), /bigint/);
});
