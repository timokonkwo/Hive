import test from 'node:test';
import assert from 'node:assert/strict';
import {proportionalAllocation, proportionalQuote} from './proportional-model.mjs';
const holders = amounts => amounts.map((amountRaw, i) => ({owner: String(i), amountRaw}));
test('proportional shares conserve budget with deterministic rounding down', () => {
  const r = proportionalAllocation(holders([1n, 2n, 3n]), 100n);
  assert.deepEqual(r.rows.map(x => x.allocationNewRaw), [16n, 33n, 50n]);
  assert.equal(r.unallocatedNewRaw, 1n);
  assert.equal(r.allocatedNewRaw + r.unallocatedNewRaw, r.budgetNewRaw);
  assert.deepEqual(proportionalAllocation(holders([1n, 2n, 3n]).reverse(), 100n).rows.reverse(), r.rows);
});
test('70 percent cap applies to tiny balances and leaves excess budget unused', () => {
  const r = proportionalAllocation(holders([1n, 2n]), 10n ** 18n);
  assert.deepEqual(r.rows.map(x => x.allocationNewRaw), [700000000n, 1400000000n]);
  assert.equal(r.allocatedNewRaw, 2100000000n);
});
test('exact large balances and reduced surrender never overpay', () => {
  const total = 582229876983614953n, budget = 7000000n * 10n ** 18n;
  const full = proportionalQuote(10000000n * 10n ** 9n, total, budget);
  assert.equal(full, 10000000n * 10n ** 9n * budget / total);
  assert.ok(proportionalQuote(5000000n * 10n ** 9n, total, budget) <= full / 2n);
  assert.equal(proportionalQuote(0n, total, budget), 0n);
});
test('invalid populations and inexact inputs are rejected', () => {
  for (const list of [[], holders([0n]), holders([-1n]), [{owner:'a',amountRaw:1n},{owner:'a',amountRaw:2n}]]) assert.throws(() => proportionalAllocation(list, 10n));
  assert.throws(() => proportionalAllocation(holders([1n]), 10));
  assert.throws(() => proportionalQuote(2n, 1n, 10n));
});
