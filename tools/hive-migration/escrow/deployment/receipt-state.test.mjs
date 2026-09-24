import test from 'node:test';
import assert from 'node:assert/strict';
import {distributorReceiptPending} from './receipt-state.mjs';

test('mined deployment waits for finality without allowing funding', () => {
  for (const status of ['submitted', 'unknown', 'awaiting_wallet']) {
    assert.equal(distributorReceiptPending([{action:'distributor', status, hash:'0x123'}]), true);
  }
  assert.equal(distributorReceiptPending([{action:'distributor', status:'confirmed', hash:'0x123'}]), false);
});

test('untracked or failed deployment cannot advance to funding', () => {
  for (const entries of [[], [{action:'fund',status:'confirmed'}], [{action:'distributor',status:'failed',hash:'0x123'}], [{action:'distributor',status:'awaiting_wallet'}]]) {
    assert.throws(() => distributorReceiptPending(entries), /receipt must be reconciled/);
  }
});
