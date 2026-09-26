import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {transientRpc,recoverableCycle,rpcClient,rpcDiagnostic} from './rpc-recovery.mjs';
import {Journal,submitOnce,reconcileJournal} from './journal.mjs';
import {SolanaJSONRPCError} from '@solana/web3.js';
import {LimitExceededRpcError} from 'viem';
test('provider JSON-RPC limits and context lag recover without weakening finality',async()=>{
 const errors=[new LimitExceededRpcError(Error('rate limit')),new SolanaJSONRPCError({code:-32016,message:'Minimum context slot has not been reached'},'failed to get token accounts owned by account'),{cause:{code:-32005}}];
 for(const error of errors){
  assert.equal(transientRpc(error),true);
  let ready=true,waited=0;
  assert.equal(await recoverableCycle(async()=>{throw error;},{unready:()=>{ready=false;},wait:async ms=>{waited=ms;},log:()=>{}}),1);
  assert.equal(ready,false);assert.equal(waited,5000);
 }
 for(const code of [-32002,-32602,-32603,3])assert.equal(transientRpc({code}),false);
});
test('transport failures are retryable but integrity and authorization failures are not',()=>{
 for(const error of [{name:'TimeoutError'},{status:429},{status:502},{cause:{code:'ECONNRESET'}},{name:'TypeError',message:'fetch failed'}])assert.equal(transientRpc(error),true);
 for(const error of [Error('Contract mismatch'),Error('Incomplete transaction journal'),Error('Fee budget exhausted'),{name:'HttpRequestError',status:401},{name:'HttpRequestError',status:403},Error('Failed transaction')])assert.equal(transientRpc(error),false);
});
test('lagging Solana reads retry the same checkpoint; sends and other failures do not retry',async()=>{
 let reads=0,sends=0;const waits=[],args={commitment:'finalized',minContextSlot:123};
 const client=rpcClient({getTokenAccountsByOwner:async(owner,filter,options)=>{assert.equal(options,args);if(++reads<3)throw {code:-32016};return 'ready';},sendRawTransaction:async()=>{sends++;throw {code:-32016};}},'solana',{wait:async ms=>waits.push(ms)});
 assert.equal(await client.getTokenAccountsByOwner('owner',{},args),'ready');assert.deepEqual(waits,[300,600]);
 await assert.rejects(client.sendRawTransaction('bytes'));assert.equal(sends,1);
 let failures=0;const failing=rpcClient({getTokenAccountsByOwner:async()=>{failures++;throw {code:-32016};}},'solana',{wait:async()=>{}});
 await assert.rejects(failing.getTokenAccountsByOwner());assert.equal(failures,4);
});
test('retry suspends readiness, caps backoff and resets after successful verification',async()=>{
 let attempt=0,ready=true;const waits=[];
 const options={unready:()=>{ready=false;},wait:async n=>waits.push(n),log:()=>{}};
 for(let i=0;i<7;i++)attempt=await recoverableCycle(async()=>{throw {name:'TimeoutError'};},{...options,attempt});
 assert.equal(ready,false);assert.deepEqual(waits,[5000,10000,20000,40000,60000,60000,60000]);
 attempt=await recoverableCycle(async()=>{ready=true;},{...options,attempt});assert.equal(attempt,0);assert.equal(ready,true);
 await assert.rejects(recoverableCycle(async()=>{throw Error('Corrupted journal');},options),/Corrupted/);assert.equal(ready,false);
});
test('RPC diagnostics identify method and chain without logging error contents',async()=>{
 const client=rpcClient({read:async()=>{throw Object.assign(Error('private signed payload https://secret'),{status:503});}},'evm');
 try{await client.read();assert.fail();}catch(e){assert.deepEqual(rpcDiagnostic(e,'verify',1),{event:'rpc_retry',operation:'verify',chain:'evm',method:'read',status:503,attempt:1});}
});
test('recovery cannot rebroadcast an unknown submitted payment',async()=>{
 const journal=new Journal(mkdtempSync(join(tmpdir(),'hive-retry-')));let sends=0,lookups=0;
 const adapter={prepare:async()=>({hash:'fixed',raw:'signed'}),broadcast:async()=>{sends++;throw {name:'TimeoutError'};},lookup:async()=>{if(++lookups===1)throw {name:'TimeoutError'};return {status:'confirmed'};}};
 await submitOnce(journal,'claim','evm',{},adapter);
 let ready=false;
 const work=async()=>{await reconcileJournal(journal,adapter);ready=true;await submitOnce(journal,'claim','evm',{},adapter);};
 const options={unready:()=>{ready=false;},wait:async()=>{},log:()=>{}};
 assert.equal(await recoverableCycle(work,options),1);assert.equal(ready,false);
 assert.equal(await recoverableCycle(work,options),0);assert.equal(sends,1);assert.equal(journal.latest().get('claim').status,'confirmed');
});

import {cachedReads} from './rpc-recovery.mjs';
test('read cache coalesces matching checkpoints, expires, evicts failures and never caches sends',async()=>{
 let time=0,reads=0,sends=0,fail=false;
 const client=cachedReads({readContract:async()=>{reads++;if(fail)throw Error('network');return reads;},sendRawTransaction:async()=>++sends},10000,()=>time);
 assert.deepEqual(await Promise.all([client.readContract({blockNumber:1n}),client.readContract({blockNumber:1n})]),[1,1]);
 assert.equal(await client.readContract({blockNumber:2n}),2);time=10000;assert.equal(await client.readContract({blockNumber:1n}),3);
 fail=true;await assert.rejects(client.readContract({blockNumber:3n}));fail=false;assert.equal(await client.readContract({blockNumber:3n}),5);
 await client.sendRawTransaction('same');await client.sendRawTransaction('same');assert.equal(sends,2);
});
