import test from 'node:test';import assert from 'node:assert/strict';
import {validateReturn,RETURN} from './return-surplus.mjs';
const valid={chainId:4663,codeHash:'known',expectedHash:'known',admin:'0xabc',signer:'0xabc',token:RETURN.token,closesAt:100n,expectedClose:100n,finalizedTime:101n,balance:RETURN.amount,reserved:0n};
test('closeout is bound to reviewed deployment, finalized closure, authority and free inventory',()=>{
 assert.doesNotThrow(()=>validateReturn(valid));
 for(const change of [{chainId:1},{codeHash:'changed'},{admin:'0xdef'},{token:'0xdef'},{finalizedTime:99n},{closesAt:90n},{reserved:1n},{balance:RETURN.amount-1n}])assert.throws(()=>validateReturn({...valid,...change}));
 assert.equal(RETURN.recipient.toLowerCase(),'0xd9dba9f0e6d3f1ac8b7f36e15ccba4ac6f740e95');
});
