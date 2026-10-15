import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHex } from 'viem';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { journal, policy, store, worker } from '../scripts/tokenization/modules.mjs';
import { signer, token, hash, intentFixture } from './helpers/tokenization-fixture.mjs';
const load=(path,imports={})=>loadTypeScript(new URL(path,import.meta.url),imports);
const model=load('../components/redesign/tokenization/model.ts',{'@/lib/agent-tokenization/policy':policy});

function fixture(){
  const intent=intentFixture();let stored,reviewed=0;
  const snapshot={expectedEconomics:hash},prediction=journal.unpackPrepared(intent.prepared).prediction;
  const resume=load('../lib/agent-tokenization/resume.ts',{
    './journal':journal,'./policy':policy,'./store':store,
    './transaction':{simulateLaunchCandidate:async()=>prediction},
    './snapshot':{readLaunchSnapshot:async()=>snapshot,assertReviewedRelease:(_snapshot,release)=>{reviewed++;if(!release.reviewed)throw Error('Unreviewed');}},
  });
  const client={getChainId:async()=>4663,getBlock:async()=>({number:20n}),getTransactionCount:async()=>4,getCode:async()=>'0x',
    estimateGas:async()=>21000n,estimateFeesPerGas:async()=>({maxFeePerGas:2n,maxPriorityFeePerGas:1n}),getBalance:async()=>10n**18n};
  const db={saveReplacementReview:async(saved,action,prepared)=>{stored={saved,action,prepared};return {...saved,revision:saved.revision+1};}};
  return {intent,client,db,snapshot,prediction,run:(action='resume',release={reviewed:true})=>resume.reviewSavedLaunch(client,db,intent,action,release),stored:()=>stored,reviewed:()=>reviewed};
}

test('resume keeps the exact call and nonce, rechecks the release and bumps both fee caps',async()=>{
  const f=fixture(), before=journal.unpackPrepared(f.intent.prepared);
  f.client.estimateGas=async args=>{assert.equal(args.blockNumber,20n);return 21000n;};
  f.client.getBalance=async args=>{assert.equal(args.blockNumber,20n);return 10n**18n;};
  const result=await f.run();
  for(const key of ['from','to','data','value','nonce'])assert.equal(result.transaction[key],before.transaction[key]);
  assert.equal(result.transaction.gas,25200n);assert.equal(result.transaction.maxFeePerGas,3n);assert.equal(result.transaction.maxPriorityFeePerGas,2n);
  assert.equal(result.maximumTotal,before.transaction.value+result.maximumNetworkFee);
  assert.equal(f.reviewed(),1);assert.equal(f.stored().action,'resume');assert.equal(f.intent.prepared.digest,journal.packPrepared(before).digest);
});
test('a cancellation is a reviewed zero-value self transaction, remains available when paused and reprices retries',async()=>{
  const f=fixture();const previous=journal.unpackPrepared(f.intent.prepared);
  f.intent.cancellationReview=journal.packPrepared({...previous,transaction:{...previous.transaction,maxFeePerGas:100n,maxPriorityFeePerGas:10n}});
  const result=await f.run('cancel',null);
  assert.equal(result.transaction.to,signer);assert.equal(result.transaction.data,'0x');assert.equal(result.transaction.value,0n);
  assert.equal(result.transaction.nonce,4);assert.equal(result.transaction.maxFeePerGas,125n);assert.equal(result.transaction.maxPriorityFeePerGas,13n);
  assert.equal(result.maximumTotal,result.maximumNetworkFee);assert.equal(f.reviewed(),0);assert.equal(f.stored().action,'cancel');
});
test('no replacement is exposed after inclusion, release change, insufficient funds, unsupported wallet or CAS loss',async()=>{
  for(const change of [f=>f.client.getChainId=async()=>1,f=>f.client.getTransactionCount=async()=>5,
    f=>f.client.getCode=async()=>'0x1234',f=>f.client.getBalance=async()=>0n,
    f=>f.snapshot.expectedEconomics='0x'+'b'.repeat(64),f=>f.intent.phase='confirmed',f=>f.prediction.token=signer]){
    const f=fixture();change(f);await assert.rejects(f.run());assert.equal(f.stored(),undefined);
  }
  await assert.rejects(fixture().run('resume',null),/paused/);
  await assert.rejects(fixture().run('resume',{reviewed:false}),/Unreviewed/);
  const f=fixture();f.db.saveReplacementReview=async()=>null;await assert.rejects(f.run(),/changed/);
});
test('cancellation hash verification rejects transfers, wrong senders, data, nonces and chains',async()=>{
  const intent=intentFixture();intent.cancellationReview=intent.prepared;let writes=0;
  const tx={hash,from:signer,to:signer,nonce:4,value:0n,input:'0x'};
  const client={getChainId:async()=>4663,getTransaction:async()=>tx};
  const db={recordCancellation:async()=>{writes++;return intent;}};
  await worker.acceptCancellation(client,db,intent,hash);assert.equal(writes,1);
  for(const patch of [{from:token},{to:token},{nonce:5},{value:1n},{input:'0x00'},{hash:'0x'+'b'.repeat(64)}]){
    await assert.rejects(worker.acceptCancellation({...client,getTransaction:async()=>({...tx,...patch})},db,intent,hash));
  }
  await assert.rejects(worker.acceptCancellation({...client,getChainId:async()=>1},db,intent,hash));assert.equal(writes,1);
});
test('browser quote decoder keeps exact quantities and rejects inconsistent totals and malicious cancellation calls',()=>{
  const p=journal.unpackPrepared(intentFixture().prepared);
  const tx=Object.fromEntries(Object.entries(p.transaction).map(([key,value])=>[key,typeof value==='number'||typeof value==='bigint'?toHex(value):value]));
  const quote={id:'fixture',transaction:tx,expiresAt:p.expiresAt.toString(),maximumNetworkFee:p.maximumNetworkFee.toString(),maximumTotal:p.maximumTotal.toString()};
  assert.equal(model.readQuote(quote,signer).transaction.value,toHex(p.transaction.value));
  for(const patch of [{chainId:'0x1'},{from:token},{gas:'0x00'},{value:'1e18'},{data:'0xa'},{nonce:'0x'+'f'.repeat(65)}])assert.throws(()=>model.readQuote({...quote,transaction:{...tx,...patch}},signer));
  assert.throws(()=>model.readQuote({...quote,maximumTotal:'1'},signer));assert.throws(()=>model.readQuote({...quote,expiresAt:'99999999999999999999999'},signer));
  assert.throws(()=>model.readQuote(quote,signer,'cancel'));
  assert.ok(model.readQuote({...quote,maximumTotal:quote.maximumNetworkFee,transaction:{...tx,to:signer,data:'0x',value:'0x0'}},signer,'cancel'));
});
test('browser recovery never treats a malformed or unfinalized token as a success',()=>{
  const saved={id:'intent',phase:'confirming',signer,transactionHash:hash,token:{chainId:4663,address:token,symbol:'TEST',transactionHash:hash}};
  assert.equal(model.readStatus({launch:saved}).token,null);
  assert.equal(model.readStatus({launch:{...saved,phase:'confirmed'}}).token.address,token);
  for(const patch of [{signer:'bad'},{phase:'unknown'},{cancellationHash:'bad'},{phase:'confirmed',token:null}])assert.throws(()=>model.readStatus({launch:{...saved,...patch}}));
});
