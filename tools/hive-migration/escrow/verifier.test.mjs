import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {Keypair,PublicKey} from '@solana/web3.js';import {getBase58Decoder} from '@solana/kit';import {privateKeyToAccount} from 'viem/accounts';
import {registrationMessage,registrationTerms,authenticateRegistration} from './registration.mjs';
import {snapshotTree,hex} from './client.mjs';import {Journal,acquireServiceLock,submitOnce,reconcileJournal} from './journal.mjs';import {processRegistration} from './verifier-core.mjs';
const template=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
async function fixture(minimumCurrentHoldingRaw='0'){
  const sol=Keypair.fromSeed(Buffer.alloc(32,42));const evm=privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const config={...template.config,minimumCurrentHoldingRaw,destinationToken:'0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8'};
  const tree=snapshotTree(config.campaignId,config.mint,[{owner:sol.publicKey.toBase58(),amountRaw:'2000000000000'}]);config.root=tree.root;
  const review={config,tree,financialActivationApproved:true};
  const request={owner:sol.publicKey.toBase58(),recipient:evm.address,amount:'2000000000000',depositDeadline:'1000',nonce:`0x${'55'.repeat(32)}`};
  const message=registrationMessage(review,request);
  const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(sol.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
  request.solanaSignature=getBase58Decoder().decode(sign(null,Buffer.from(message),key));request.evmSignature=await evm.signMessage({message});
  return {review,request,q:registrationTerms(review,request)};
}
function destination(q,status){return {status,grant:BigInt(q.grant),quote:{sourceOwner:hex(new PublicKey(q.owner).toBytes()),recipient:q.recipient,snapshotAmount:BigInt(q.snapshotAmount),depositAmount:BigInt(q.amount),depositDeadline:BigInt(q.depositDeadline),claimDeadline:BigInt(q.claimDeadline)}};}
function source(q,status=1){return {...q,status};}
const tempJournal=()=>new Journal(mkdtempSync(join(tmpdir(),'hive-verifier-test-')));
test('existing reservation reconciles without holdings reads or another broadcast',async()=>{
 const {review,request,q}=await fixture('1000000000000'),journal=tempJournal();
 journal.append({id:q.claimId+':reserve',chain:'evm',status:'submitted',hash:'pending'});
 const observer={read:async()=>({finalized:true,deploymentVerified:true,source:null,destination:destination(q,0),destinationTimestamp:'100'}),spendable:async()=>{throw Error('MUST NOT RECHECK');}};
 const adapter={lookup:async()=>({status:'pending'}),prepare:async()=>{throw Error('MUST NOT SIGN');},broadcast:async()=>{throw Error('MUST NOT SEND');}};
 const result=await processRegistration({review,request,observer,adapter,journal,execute:true});
 assert.deepEqual(result.transaction,{status:'submitted',hash:'pending'});
});
test('current holding minimum blocks reservation and deposit but never blocks settlement',async()=>{
 const {review,request,q}=await fixture('1000000000000');
 let state=0;
 const observer={read:async()=>({finalized:true,deploymentVerified:true,source:state===2?source(q):null,destination:destination(q,state),destinationTimestamp:'100'}),spendable:async()=>[{amountRaw:'999999999999'}]};
 for(state=0;state<2;state++)assert.equal((await processRegistration({review,request,observer,execute:false})).action,'below_minimum');
 assert.equal((await processRegistration({review,request,observer,execute:false})).action,'claim');
});
test('both wallet signatures bind campaign, recipient, grant and amount',async()=>{
  const {review,request}=await fixture();await authenticateRegistration(review,request);
  await assert.rejects(authenticateRegistration(review,{...request,amount:'1'}),/source wallet/);
  await assert.rejects(authenticateRegistration(review,{...request,evmSignature:`0x${'00'.repeat(65)}`}));
  await assert.rejects(authenticateRegistration({...review,config:{...review.config,distributor:`0x${'44'.repeat(20)}`}},request),/source wallet/);
  for(const changed of [{fundingBudgetRaw:'30000000000000000000000'},{totalEligibleOldRaw:'102000000000002'},{allowPartialSurrender:false},{minimumCurrentHoldingRaw:'1'}]) {
    await assert.rejects(authenticateRegistration({...review,config:{...review.config,...changed}},request),/source wallet/);
  }
});
test('worker advances reserve, user deposit, confirm, payout and collection automatically',async()=>{
  const {review,request,q}=await fixture();let s=null,d=destination(q,0),nextHash=0;const actions=[];const journal=tempJournal();
  const observer={read:async()=>({finalized:true,deploymentVerified:true,source:s,destination:d,destinationTimestamp:'100',sourceSlot:10,destinationBlock:'20',sourcePaused:false,destinationPaused:false}),depositEvidence:async()=>{actions.push('verify_source');return '1'.repeat(64);},settlementEvidence:async()=>{actions.push('verify_paid');return `0x${'66'.repeat(32)}`;},spendable:async()=>[]};
  const adapter={prepare:async(chain,a)=>{actions.push(a.action);return {raw:'signed-test-payload',hash:String(++nextHash)};},broadcast:async()=>{},lookup:async()=>({status:'confirmed'}),partialDeposit:async()=>{actions.push('cosign_deposit');return {ownerSignatureRequired:true};}};
  const step=()=>processRegistration({review,request,observer,adapter,journal,execute:true});
  assert.equal((await step()).action,'reserve');d=destination(q,1);
  assert.equal((await step()).action,'deposit');s=source(q);
  assert.equal((await step()).action,'confirm_deposit');d=destination(q,2);
  assert.equal((await step()).action,'claim');d=destination(q,3);
  assert.equal((await step()).action,'release_to_collection');s=source(q,2);
  assert.equal((await step()).action,'complete');
  assert.deepEqual(actions,['reserve','cosign_deposit','verify_source','confirm_deposit','claim','verify_paid','release']);
});
test('refund is signed only after finalized destination cancellation and evidence',async()=>{
  const {review,request,q}=await fixture();let status=2,evidence=false;const actions=[];const journal=tempJournal();
  const observer={read:async()=>({finalized:true,deploymentVerified:true,source:source(q),destination:destination(q,status),destinationTimestamp:'4601',sourceSlot:10,destinationBlock:'20'}),settlementEvidence:async()=>{if(!evidence)throw Error('Missing cancellation proof');return `0x${'77'.repeat(32)}`;}};
  const adapter={prepare:async(chain,a)=>{actions.push(a.action);return {raw:'test',hash:a.action};},broadcast:async()=>{},lookup:async()=>({status:'confirmed'})};
  const step=()=>processRegistration({review,request,observer,adapter,journal,execute:true});
  assert.equal((await step()).action,'cancel_expired');assert.deepEqual(actions,['cancel_expired']);
  status=4;await assert.rejects(step(),/proof/);assert.deepEqual(actions,['cancel_expired']);
  evidence=true;assert.equal((await step()).action,'refund_to_owner');assert.deepEqual(actions,['cancel_expired','refund']);
});
test('finality/code/binding failures and dry-run never reach signer',async()=>{
  const {review,request,q}=await fixture();let state={finalized:true,deploymentVerified:true,source:null,destination:destination(q,0),destinationTimestamp:'100'};
  const observer={read:async()=>state};const adapter={prepare:async()=>{throw Error('MUST NOT SIGN');}};const journal=tempJournal();
  assert.equal((await processRegistration({review,request,observer,adapter,journal})).mode,'dry_run');assert.equal(journal.entries().length,0);
  state={...state,finalized:false};await assert.rejects(processRegistration({review,request,observer,adapter,journal}),/Finality/);
  state={...state,finalized:true,deploymentVerified:false};await assert.rejects(processRegistration({review,request,observer,adapter,journal}),/deployment/);
  state={...state,deploymentVerified:true,destination:destination(q,1)};state.destination.quote.recipient=`0x${'99'.repeat(20)}`;
  await assert.rejects(processRegistration({review,request,observer,adapter,journal}),/Registration differs/);
  await assert.rejects(processRegistration({review:{...review,financialActivationApproved:false},request,observer,adapter,journal,execute:true}),/activation/);
});
test('journal is durable before broadcast and unknown submission is never retried',async()=>{
  const journal=tempJournal();let broadcasts=0,prepares=0;
  const adapter={prepare:async()=>{prepares++;return {raw:'test',hash:'abc',nonce:1};},broadcast:async()=>{broadcasts++;assert.equal(journal.latest().get('one').status,'prepared');throw Error('timeout');},lookup:async()=>({status:'pending'})};
  assert.equal((await submitOnce(journal,'one','evm',{},adapter)).status,'submission_unknown');
  const restarted=new Journal(join(journal.path,'..'));await reconcileJournal(restarted,adapter);
  await submitOnce(restarted,'one','evm',{},adapter);
  assert.equal((await submitOnce(restarted,'two','evm',{},adapter)).status,'waiting_for_chain_reconciliation');
  assert.equal(prepares,1);assert.equal(broadcasts,1);
  adapter.lookup=async()=>({status:'failed'});await reconcileJournal(restarted,adapter);assert.equal(restarted.latest().get('one').status,'failed');
  await submitOnce(restarted,'one','evm',{},adapter);assert.equal(prepares,1);
});
test('one process owns the signer loop and partial journals fail closed',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hive-lock-test-'));const release=acquireServiceLock(dir);
  assert.throws(()=>acquireServiceLock(dir),/already running/);release();assert.equal(existsSync(join(dir,'service.lock')),false);
  const journal=new Journal(dir);writeFileSync(journal.path,'{"incomplete":');assert.throws(()=>journal.entries(),/Incomplete/);
});

import {recoverReservation} from './recover-reservation.mjs';
import {encodeFunctionData,keccak256,parseAbi} from 'viem';
const recoveryAbi=parseAbi(['function reserve((bytes32 sourceOwner,address recipient,uint64 snapshotAmount,uint64 depositAmount,uint64 depositDeadline,uint64 claimDeadline) q, bytes32[] proof)']);
test('explicit reservation recovery sends the identical transaction once and cannot recover payouts',async()=>{
 const {review,request,q}=await fixture();const signer=privateKeyToAccount(`0x${'11'.repeat(32)}`);review.config.destinationAdmin=signer.address;
 const data=encodeFunctionData({abi:recoveryAbi,functionName:'reserve',args:[destination(q,0).quote,q.proof]});
 const raw=await signer.signTransaction({chainId:4663,type:'eip1559',to:review.config.distributor,data,value:0n,nonce:11,gas:200000n,maxFeePerGas:1n,maxPriorityFeePerGas:1n});
 const hash=keccak256(raw),journal=tempJournal();journal.append({id:q.claimId+':reserve',chain:'evm',status:'submitted',hash,raw,nonce:11});
 let sends=0,now='100',finalized='90';const logs=[];
 const transport={getChainId:async()=>4663,getTransactionReceipt:async()=>{throw {name:'TransactionReceiptNotFoundError'};},getTransaction:async()=>{throw {name:'TransactionNotFoundError'};},getTransactionCount:async()=>11,call:async()=>{},sendRawTransaction:async args=>{sends++;assert.equal(args.serializedTransaction,raw);return hash;}};
 const observer={abi:recoveryAbi,evm:transport,read:async()=>({finalized:true,deploymentVerified:true,source:null,destination:{status:0},destinationCurrentTimestamp:now,destinationTimestamp:finalized,destinationBlock:'50'})};
 const run=()=>recoverReservation({hash,review,request,journal,observer,transport,log:e=>logs.push(e)});
 await run();await run();assert.equal(sends,1);assert.equal(logs[0].event,'reservation_rebroadcast');
 journal.append({id:q.claimId+':reserve',chain:'evm',status:'submitted',hash,raw,nonce:11});
 now='1001';finalized='999';await run();assert.equal(journal.latest().get(q.claimId+':reserve').status,'submitted');
 finalized='1001';await run();assert.equal(journal.latest().get(q.claimId+':reserve').status,'expired');assert.equal(sends,1);
 journal.append({id:q.claimId+':reserve',chain:'evm',status:'submitted',hash,raw,nonce:12});
 await assert.rejects(run(),/terms differ/);assert.equal(sends,1);
});
