import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {Keypair} from '@solana/web3.js';
import {getBase58Decoder} from '@solana/kit';
import {privateKeyToAccount} from 'viem/accounts';
import {snapshotTree,unsignedTransaction,depositFromAccounts} from './client.mjs';
import {registrationMessage,authenticateRegistration} from './registration.mjs';
import {createGateway} from './gateway.mjs';
import {acceptRegistration} from './accept-registration.mjs';
import {quoteRegistration} from './quote-registration.mjs';
const template=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
async function fixture(){
 const sol=Keypair.fromSeed(Buffer.alloc(32,42)),evm=privateKeyToAccount(`0x${'11'.repeat(32)}`);
 const admin=Keypair.fromSeed(Buffer.alloc(32,43));
 const config={...template.config,admin:admin.publicKey.toBase58(),snapshotSlot:449032979,destinationToken:'0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8',classificationsApproved:true,grantAmountsApproved:true,terminalAttemptPolicyApproved:true};
 const tree=snapshotTree(config.campaignId,config.mint,[{owner:sol.publicKey.toBase58(),amountRaw:'2000000000000'}]);config.root=tree.root;
 const review={config,tree,financialActivationApproved:true,deployment:{solanaProgramDataSha256:'11'.repeat(32),destinationRuntimeCodeHash:`0x${'22'.repeat(32)}`}};
 const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(sol.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
 const signed=async(patch={})=>{const r={owner:sol.publicKey.toBase58(),recipient:evm.address,amount:'2000000000000',depositDeadline:'1000',nonce:`0x${'55'.repeat(32)}`,...patch};const message=registrationMessage(review,r);return {...r,solanaSignature:getBase58Decoder().decode(sign(null,Buffer.from(message),key)),evmSignature:await evm.signMessage({message})};};
 return {review,signed,sol,admin,dir:mkdtempSync(join(tmpdir(),'hive-intake-'))};
}
test('authenticated intake writes only bound request fields and no transactions',async()=>{
 const f=await fixture(),request=await f.signed(),r=await acceptRegistration(f.review,{...request,action:'claim',grant:'999',proof:[],privateKey:'ignored'},f.dir,100n);
 assert.equal(r.status,'registered');assert.equal(r.transactionSubmitted,false);
 const files=readdirSync(f.dir);assert.deepEqual(files,[r.claimId.slice(2)+'.json']);
 assert.deepEqual(JSON.parse(readFileSync(join(f.dir,files[0]))),request);
});
test('concurrent retries are idempotent and competing signed terms cannot replace a queue item',async()=>{
 const f=await fixture(),request=await f.signed();const results=await Promise.all(Array.from({length:8},()=>acceptRegistration(f.review,request,f.dir,100n)));
 assert.equal(results.filter(r=>r.status==='registered').length,1);assert.equal(results.filter(r=>r.status==='already_registered').length,7);
 await assert.rejects(acceptRegistration(f.review,await f.signed({amount:'1000000000000'}),f.dir,100n),/different registration/);
 assert.equal(readdirSync(f.dir).length,1);
});
test('expired, not-yet-open, tampered and inactive registrations never reach the queue',async()=>{
 const f=await fixture(),request=await f.signed();
 for(const now of [99n,1000n,10000n])await assert.rejects(acceptRegistration(f.review,request,f.dir,now),/window|expired/);
 await assert.rejects(acceptRegistration(f.review,{...request,amount:'1'},f.dir,100n),/authorization/);
 await assert.rejects(acceptRegistration({...f.review,financialActivationApproved:false},request,f.dir,100n),/activation/);
 await assert.rejects(acceptRegistration({...f.review,config:{...f.review.config,classificationsApproved:false}},request,f.dir,100n),/decisions/);
 assert.equal(readdirSync(f.dir).length,0);
});

function quoteObserver(f,request,patch={},accountsPatch={}) {
 return {read:async()=>({finalized:true,deploymentVerified:true,sourcePaused:false,destinationPaused:false,source:null,destination:{status:0},sourceSlot:449032980,destinationBlock:'10',destinationTimestamp:'100',availableInventoryRaw:f.review.config.fundingBudgetRaw,...patch}),spendable:async()=>[{address:template.quote.sourceTokenAccount,owner:request.owner,mint:f.review.config.mint,amountRaw:'2000000000000',frozen:false,...accountsPatch}]};
}
test('post-snapshot buying cannot qualify a below-minimum snapshot wallet',async()=>{
 const f=await fixture();f.review.config.minimumCurrentHoldingRaw='1000000000000000';
 const input={owner:f.sol.publicKey.toBase58(),recipient:'0x1111111111111111111111111111111111111111',amount:'1'};
 await assert.rejects(quoteRegistration(f.review,input,quoteObserver(f,input,{}, {amountRaw:'1000000000000000'}),100n),/Snapshot holding/);
});
test('fresh partial quote signs the same terms accepted by durable intake',async()=>{
 const f=await fixture(),input={...await f.signed(),amount:'1000000000000'};
 const quote=await quoteRegistration(f.review,input,quoteObserver(f,input),100n);
 assert.equal(quote.expiresAt,'700');assert.equal(quote.oldAmountRaw,input.amount);assert.equal(quote.reserved,false);assert.equal(quote.transactionSubmitted,false);
 assert.equal(quote.message,registrationMessage(f.review,quote.request));
 assert.notEqual(quote.request.nonce,input.nonce);
 const accepted=await acceptRegistration(f.review,await f.signed(quote.request),f.dir,101n);
 assert.equal(accepted.grantRaw,quote.newGrantRaw);assert.equal(accepted.claimId,quote.claimId);
 const second=await quoteRegistration(f.review,input,quoteObserver(f,input),100n);assert.notEqual(second.request.nonce,quote.request.nonce);
});
test('quote refuses closed, stale, paused, unfunded, existing and insufficient-balance attempts',async()=>{
 const f=await fixture(),input=await f.signed();
 for(const patch of [{finalized:false},{deploymentVerified:false},{sourcePaused:true},{destinationPaused:true},{source:{status:1}},{destination:{status:4}},{availableInventoryRaw:'0'},{sourceSlot:1},{destinationTimestamp:'999'}])await assert.rejects(quoteRegistration(f.review,input,quoteObserver(f,input,patch),100n));
 for(const accountsPatch of [{amountRaw:'1'},{frozen:true},{owner:template.config.admin}])await assert.rejects(quoteRegistration(f.review,input,quoteObserver(f,input,{},accountsPatch),100n));
 for(const now of [99n,10000n])await assert.rejects(quoteRegistration(f.review,input,quoteObserver(f,input),now),/not open/);
 await assert.rejects(quoteRegistration({...f.review,financialActivationApproved:false},input,quoteObserver(f,input),100n),/activated/);
 await assert.rejects(quoteRegistration(f.review,{...input,amount:'2000000000001'},quoteObserver(f,input),100n),/allowance/);
 const end=await quoteRegistration(f.review,input,quoteObserver(f,input,{destinationTimestamp:'9990'}),9990n);assert.equal(end.expiresAt,'10000');
});

test('gateway binds signed deposits, persists before broadcast and never retries unknown outcomes',async()=>{
 const f=await fixture(),request=await f.signed();
 await acceptRegistration(f.review,request,f.dir,100n);
 const q=await authenticateRegistration(f.review,request),stateDirectory=join(f.dir,'state');mkdirSync(stateDirectory);
 const spendable=[{address:template.quote.sourceTokenAccount,owner:q.owner,mint:f.review.config.mint,amountRaw:q.amount,frozen:false}];
 const tx=unsignedTransaction(depositFromAccounts(f.review.config,{...q,sourceTokenAccount:spendable[0].address},spendable),q.owner,template.config.program);tx.sign([f.admin]);
 writeFileSync(join(stateDirectory,q.claimId.slice(2)+'.json'),JSON.stringify({claimId:q.claimId,mode:'execute',action:'deposit',deposit:{transactionBase64:Buffer.from(tx.serialize()).toString('base64'),lastValidBlockHeight:1000,ownerSignatureRequired:true}}));
 const observed={finalized:true,deploymentVerified:true,source:null,destination:{status:1,grant:q.grant,quote:{sourceOwner:'0x'+f.sol.publicKey.toBuffer().toString('hex'),recipient:q.recipient,depositAmount:q.amount,snapshotAmount:q.snapshotAmount,depositDeadline:q.depositDeadline,claimDeadline:q.claimDeadline}},destinationTimestamp:'100',sourcePaused:false,destinationPaused:false};
 let broadcasts=0;
 const observer={read:async()=>observed,sol:{getBlockHeight:async()=>100,getSignatureStatuses:async()=>({value:[null]}),sendRawTransaction:async()=>{broadcasts++;assert.ok(readdirSync(join(stateDirectory,'gateway')).some(n=>n.endsWith('.submission.json')));throw Error('lost response');}}};
 const handle=createGateway({review:f.review,observer,requestsDirectory:f.dir,stateDirectory,executionEnabled:true});
 assert.equal((await handle('availability')).enabled,true);
 const status=await handle('status',{request});assert.equal(status.state,'deposit');assert.ok(status.deposit.packetId);
 await assert.rejects(handle('deposit',{request,packetId:status.deposit.packetId,transactionBase64:status.deposit.transactionBase64}),/signature/);
 tx.sign([f.sol]);const transactionBase64=Buffer.from(tx.serialize()).toString('base64');
 const result=await handle('deposit',{request,packetId:status.deposit.packetId,transactionBase64});assert.equal(result.submission,'pending_or_unknown');assert.equal(broadcasts,1);
 await handle('deposit',{request,packetId:status.deposit.packetId,transactionBase64});assert.equal(broadcasts,1);
 const after=await handle('status',{request});assert.equal(after.deposit,null);assert.equal(after.signature,result.signature);
 await assert.rejects(handle('status',{request:{...request,amount:'1'}}),/authorization/);
 const off=createGateway({review:f.review,observer,requestsDirectory:f.dir,stateDirectory,executionEnabled:false});assert.equal((await off('availability')).enabled,false);await assert.rejects(off('deposit',{}),/not open/);
});

test('paid status exposes only verified finalized payout evidence',async()=>{
 const f=await fixture(),request=await f.signed();
 await acceptRegistration(f.review,request,f.dir,100n);
 const q=await authenticateRegistration(f.review,request);
 const observed={finalized:true,deploymentVerified:true,source:{status:1,recipient:q.recipient,snapshotAmount:q.snapshotAmount,depositDeadline:q.depositDeadline,claimDeadline:q.claimDeadline,amount:q.amount,grant:q.grant},destination:{status:3,grant:q.grant,quote:{sourceOwner:'0x'+f.sol.publicKey.toBuffer().toString('hex'),recipient:q.recipient,depositAmount:q.amount,snapshotAmount:q.snapshotAmount,depositDeadline:q.depositDeadline,claimDeadline:q.claimDeadline}},destinationTimestamp:'100'};
 let verified=0;
 const observer={read:async()=>observed,settlementEvidence:async()=>{verified++;return '0x'+'ab'.repeat(32);}};
 const handle=createGateway({review:f.review,observer,requestsDirectory:f.dir,stateDirectory:join(f.dir,'state'),executionEnabled:true});
 const status=await handle('status',{request});
 assert.equal(status.state,'release_to_collection');assert.equal(status.claimId,q.claimId);
 assert.deepEqual(status.payout,{hash:'0x'+'ab'.repeat(32),status:'finalized'});assert.equal(verified,1);
 observer.settlementEvidence=async()=>{throw Error('Finalized settlement event missing');};
 assert.equal((await handle('status',{request})).state,'claim');
 observer.settlementEvidence=async()=>{throw Error('Noncanonical payout');};
 await assert.rejects(handle('status',{request}),/Noncanonical/);
});
