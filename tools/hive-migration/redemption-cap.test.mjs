import test from 'node:test';
import assert from 'node:assert/strict';
import {redemptionCap} from './redemption-cap.mjs';
test('post-cutoff new wallets and added holdings cannot create more allowance',()=>{
 assert.equal(redemptionCap({snapshotRaw:0n,currentSpendableRaw:999999n}),0n);
 assert.equal(redemptionCap({snapshotRaw:1000n,currentSpendableRaw:5000n}),1000n);
 assert.equal(redemptionCap({snapshotRaw:1000n,currentSpendableRaw:250n}),250n);
});
test('settled/reserved deposits and completed fixed-tier claims cannot be reused',()=>{
 assert.equal(redemptionCap({snapshotRaw:1000n,currentSpendableRaw:1000n,settledRaw:300n,reservedRaw:400n}),300n);
 assert.equal(redemptionCap({snapshotRaw:1000n,currentSpendableRaw:9000n,settledRaw:1000n}),0n);
 assert.equal(redemptionCap({snapshotRaw:1000n,currentSpendableRaw:1000n,claimCompleted:true}),0n);
});
test('invalid or overdrawn ledger fails closed; integer precision is preserved',()=>{
 assert.throws(()=>redemptionCap({snapshotRaw:1000n,currentSpendableRaw:1000n,reservedRaw:1001n}),/Ledger/);
 assert.throws(()=>redemptionCap({snapshotRaw:1000,currentSpendableRaw:1000n}),/bigint/);
 assert.throws(()=>redemptionCap({snapshotRaw:1000n,currentSpendableRaw:-1n}),/bigint/);
 assert.equal(redemptionCap({snapshotRaw:999960398822814692n,currentSpendableRaw:999960398822814691n}),999960398822814691n);
});
