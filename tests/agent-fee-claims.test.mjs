import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {loadTypeScript} from './helpers/load-typescript.mjs';
function fixture(execute=async()=>({message:'Done'})) {
 let row=null,executions=0,status=null,height=100;
 const matches=q=>!!row&&Object.entries(q).every(([k,v])=>k==='transactions.signature'?row.transactions.some(tx=>tx.signature===v):typeof v==='object'&&v!==null?('$lte'in v?row[k]<=v.$lte:row[k]>v.$gt):row[k]===v);
 const apply=(q,u)=>{for(const [k,v]of Object.entries(u.$set||{})){if(k==='transactions.$')row.transactions[row.transactions.findIndex(tx=>tx.signature===q['transactions.signature'])]=structuredClone(v);else row[k]=structuredClone(v);}for(const k of Object.keys(u.$unset||{}))delete row[k];if(u.$push)row.transactions.push(structuredClone(u.$push.transactions));};
 const collection={findOne:async()=>structuredClone(row),updateOne:async(q,u,o)=>{if(!row&&o?.upsert)row={_id:q._id,...structuredClone(u.$setOnInsert)};if(!matches(q))return{matchedCount:0};apply(q,u);return{matchedCount:1};},findOneAndUpdate:async(q,u)=>{if(!matches(q))return null;const before=structuredClone(row);apply(q,u);return before;}};
 const db={collection:()=>collection},bags={getWalletAddress:()=> 'wallet',connection:{getSignatureStatuses:async()=>({value:[status]}),getBlockHeight:async()=>height}};
 const api=loadTypeScript(new URL('../lib/agent-fee-claims.ts',import.meta.url),{'node:crypto':crypto,'./agent-fees':{claimAgentFees:async(_bags,journal)=>{executions++;return {failed:0,transactions:[],...await execute(journal,()=>structuredClone(row))};}}});
 return{db,bags,api,get row(){return row},get executions(){return executions},setStatus:s=>status=s,setHeight:h=>height=h};
}
const tx={mint:'mint',signature:'sig',confirmed:false,blockhash:'block',lastValidBlockHeight:200};
test('transaction is saved before send and a lost response survives a new status request',async()=>{
 const f=fixture(async(journal,read)=>{await journal.beforeSend(tx);assert.equal(read().transactions[0].signature,'sig');throw Error('Connection lost');});
 await assert.rejects(f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID()));
 assert.equal((await f.api.feeClaimStatus(f.db,f.bags)).pending,true);
 await f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID());assert.equal(f.executions,1);
 f.setStatus({confirmationStatus:'confirmed',err:null});const recovered=await f.api.feeClaimStatus(f.db,f.bags);assert.equal(recovered.pending,false);assert.equal(recovered.confirmed,1);
});
test('wallet lease fences concurrent requests and duplicate request IDs do not execute again',async()=>{
 let release;const gate=new Promise(r=>release=r);const f=fixture(async()=>{await gate;return{message:'No fees'};});const id=crypto.randomUUID();
 const first=f.api.runFeeClaim(f.db,f.bags,id);while(!f.executions)await new Promise(r=>setTimeout(r,1));
 assert.equal((await f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID())).pending,true);assert.equal(f.executions,1);release();await first;
 await f.api.runFeeClaim(f.db,f.bags,id);assert.equal(f.executions,1);
});
test('failed, expired and processed transactions remain distinct',async()=>{
 const f=fixture(async j=>{await j.beforeSend(tx);return{message:'Pending'};});await f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID());
 f.setStatus({confirmationStatus:'processed',err:null});f.setHeight(300);assert.equal((await f.api.feeClaimStatus(f.db,f.bags)).pending,true);
 f.setStatus(null);assert.equal((await f.api.feeClaimStatus(f.db,f.bags)).failed,1);
 f.setStatus({confirmationStatus:'confirmed',err:{InstructionError:[0,'error']}});assert.equal((await f.api.feeClaimStatus(f.db,f.bags)).failed,1);
});
test('RPC failures never release an unresolved transaction for another broadcast',async()=>{
 const f=fixture(async j=>{await j.beforeSend(tx);return{message:'Pending'};});await f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID());
 f.bags.connection.getSignatureStatuses=async()=>{throw Error('RPC unavailable')};await assert.rejects(f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID()));assert.equal(f.executions,1);assert.equal(f.row.transactions[0].signature,'sig');
});
test('a completed duplicate request does not briefly become pending again',async()=>{
 const f=fixture(async j=>{await j.beforeSend(tx);await j.settled({...tx,confirmed:true});return{message:'Done',failed:0,transactions:[{...tx,confirmed:true}]};});
 const id=crypto.randomUUID();await f.api.runFeeClaim(f.db,f.bags,id);
 assert.equal((await f.api.runFeeClaim(f.db,f.bags,id)).pending,false);assert.equal(f.executions,1);
});
test('preparation failures remain visible even alongside a confirmed transaction',async()=>{
 const f=fixture(async j=>{await j.beforeSend(tx);await j.settled({...tx,confirmed:true});return{message:'Partial',failed:1,transactions:[{...tx,confirmed:true}]};});
 const result=await f.api.runFeeClaim(f.db,f.bags,crypto.randomUUID());
 assert.equal(result.confirmed,1);assert.match(result.error,/could not be claimed/);assert.match(result.message,/confirmed/);
});
