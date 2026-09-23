import test from 'node:test';import assert from 'node:assert/strict';
import {nextAction} from './settlement.mjs';
const source={recipient:'0x1234',snapshotAmount:'100',amount:'80',grant:'50',depositDeadline:'1000',claimDeadline:'4600',status:1};
const destination=status=>({status,grant:50n,quote:{recipient:'0x1234',snapshotAmount:100n,depositAmount:80n,depositDeadline:1000n,claimDeadline:4600n}});
test('refund needs destination cancellation; paid state releases only to collection',()=>{
  assert.equal(nextAction(source,destination(1)),'confirm_deposit');
  assert.equal(nextAction(source,destination(2)),'claim');
  assert.equal(nextAction(source,destination(3)),'release_to_collection');
  assert.equal(nextAction(source,destination(4)),'refund_to_owner');
});
test('conflicting terms and terminal outcomes fail closed',()=>{
  assert.throws(()=>nextAction({...source,grant:'51'},destination(4)),/terms/);
  assert.throws(()=>nextAction({...source,recipient:'0xabcd'},destination(3)),/terms/);
  assert.throws(()=>nextAction({...source,status:3},destination(3)),/Conflicting/);
  assert.throws(()=>nextAction({...source,status:2},destination(4)),/Conflicting/);
  assert.throws(()=>nextAction(null,destination(3)),/without/);
  assert.throws(()=>nextAction(source,destination(0)),/reservation/);
  assert.equal(nextAction({...source,status:2},destination(3)),'complete');
  assert.equal(nextAction({...source,status:3},destination(4)),'refunded');
});
test('expired claims cancel on destination before any source refund',()=>{
  assert.equal(nextAction(source,destination(2),4600n),'claim');
  assert.equal(nextAction(source,destination(2),4601n),'cancel_expired');
  assert.equal(nextAction(null,destination(1),1000n),'deposit_window_closed_reconcile_inflight');
  assert.equal(nextAction(null,destination(1),4601n),'cancel_expired');
});
