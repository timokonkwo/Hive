import test from 'node:test';import assert from 'node:assert/strict';
import {validateReturn,RETURN} from './return-surplus.mjs';
const valid={chainId:4663,codeHash:'known',expectedHash:'known',admin:'0xabc',signer:'0xabc',token:RETURN.token,closesAt:100n,expectedClose:100n,finalizedTime:101n,balance:RETURN.amount,reserved:0n};
test('closeout is bound to reviewed deployment, finalized closure, authority and free inventory',()=>{
 assert.doesNotThrow(()=>validateReturn(valid));
 for(const change of [{chainId:1},{codeHash:'changed'},{admin:'0xdef'},{token:'0xdef'},{finalizedTime:99n},{closesAt:90n},{reserved:1n},{balance:RETURN.amount-1n}])assert.throws(()=>validateReturn({...valid,...change}));
 assert.equal(RETURN.recipient.toLowerCase(),'0xd9dba9f0e6d3f1ac8b7f36e15ccba4ac6f740e95');
});

import {reconcileForReturn} from './return-surplus.mjs';
test('closeout reconciles only finalized canonical successful receipts',async()=>{
 const entry={id:'claim:claim',chain:'evm',status:'submitted',hash:'tx'};const appended=[];
 const journal={latest:()=>new Map([[entry.id,entry]]),append:e=>appended.push(e)};
 const c={getBlock:async()=>({number:100n,hash:'canonical'}),getTransactionReceipt:async()=>({blockNumber:90n,blockHash:'canonical',status:'success'})};
 await reconcileForReturn(journal,c,[],'admin');assert.equal(appended[0].status,'confirmed');
 c.getTransactionReceipt=async()=>({blockNumber:101n,blockHash:'canonical',status:'success'});await assert.rejects(reconcileForReturn(journal,c,[],'admin'),/finality/);
 c.getTransactionReceipt=async()=>({blockNumber:90n,blockHash:'different',status:'success'});await assert.rejects(reconcileForReturn(journal,c,[],'admin'),/canonical/);
 c.getTransactionReceipt=async()=>{throw {name:'TransactionReceiptNotFoundError'};};await assert.rejects(reconcileForReturn(journal,c,[],'admin'),/non-reservation/);assert.equal(appended.length,1);
});
