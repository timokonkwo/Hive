import test from 'node:test';
import assert from 'node:assert/strict';
import {claimProgress} from '../components/redesign/claim/claim-progress.mjs';
import {publicClaimError} from '../tools/hive-migration/escrow/public-error.mjs';
test('submitted and finalized deposits do not imply payout success', () => {
  assert.equal(claimProgress({state:'deposit',signature:'s',submission:'pending_or_unknown'}).phase,'depositing');
  assert.equal(claimProgress({state:'confirm_deposit',signature:'s',submission:'finalized'}).phase,'receiving');
  assert.equal(claimProgress({state:'claim'}).phase,'receiving');
  assert.equal(claimProgress({state:'complete'}).phase,'receiving');
  assert.equal(claimProgress({state:'release_to_collection',payout:{status:'finalized'}}).phase,'success');
  assert.equal(claimProgress({state:'complete',payout:{status:'finalized'}}).phase,'success');
});
test('refunds, cancellation and failed deposits are never successful payouts', () => {
  for (const state of ['cancel_expired','refund_to_owner','cancelled_without_observed_deposit','below_minimum'])
    assert.equal(claimProgress({state}).phase,'error');
  assert.equal(claimProgress({state:'refunded'}).phase,'refunded');
  assert.equal(claimProgress({state:'deposit',submission:'failed'}).phase,'error');
});
test('public errors identify recovery without leaking provider details', () => {
  assert.equal(publicClaimError(Error('Registration not found')).code,'REGISTRATION_NOT_FOUND');
  assert.equal(publicClaimError(Error('timeout https://private.example/?secret=123')).recovery,'check_status');
  assert.ok(!JSON.stringify(publicClaimError(Error('secret bytes'))).includes('secret bytes'));
});
