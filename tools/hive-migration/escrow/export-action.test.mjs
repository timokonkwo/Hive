import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {decodeFunctionData} from 'viem';import {depositEvidence,sha256,hex} from './client.mjs';import {exportAction} from './export-action.mjs';
const f=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
const {abi}=JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url)));
const review={config:f.config,tree:{holders:f.holders}};
test('canonical deposit evidence hashes all 64 signature bytes',()=>{
  assert.equal(depositEvidence('1'.repeat(64)),hex(sha256(Buffer.alloc(64))));
  assert.throws(()=>depositEvidence('1'.repeat(32)),/64-byte/);
});
test('unsigned reserve binds source owner, amount, recipient and immutable grace',()=>{
  const result=exportAction(review,{...f.quote,action:'reserve'},abi);
  const decoded=decodeFunctionData({abi,data:result.data});
  assert.equal(decoded.functionName,'reserve');assert.equal(decoded.args[0].depositAmount,2000000000000n);
  assert.equal(decoded.args[0].claimDeadline,4600n);assert.equal(result.signed,false);assert.equal(result.broadcast,false);
  assert.throws(()=>exportAction(review,{...f.quote,amount:'2000000000001',action:'reserve'},abi),/allowance/);
});
test('permissionless claim payload cannot change its bound on-chain recipient',()=>{
  const result=exportAction(review,{owner:f.quote.owner,action:'claim',recipient:'0xdead'},abi);
  const decoded=decodeFunctionData({abi,data:result.data});
  assert.deepEqual(decoded.args,[f.claimId]);
});
