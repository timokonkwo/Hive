import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {proportionalQuote} from '../tools/hive-migration/proportional-model.mjs';
const require=createRequire(import.meta.url);
function load(path,imports={}){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>n in imports?imports[n]:require(n),m,m.exports);return m.exports;}
const model=load('../lib/hive-reimbursement.ts',{'../tools/hive-migration/proportional-model.mjs':{proportionalQuote}});
const snapshot=JSON.parse(readFileSync(new URL('../data/hive-reimbursement-snapshot.json',import.meta.url)));
const server=load('../lib/hive-reimbursement-server.ts',{'server-only':{},'@/data/hive-reimbursement-snapshot.json':snapshot,'./hive-reimbursement':model});
const owner=snapshot.holders.find(h=>h.kind==='wallet').owner;
const missing={status:'unavailable',amountRaw:null,slot:null,checkedAt:null};
test('checker and campaign use the selected 10M total budget',()=>{
 const campaign=JSON.parse(readFileSync(new URL('../tools/hive-migration/escrow/campaign.inputs.json',import.meta.url)));
 assert.equal(model.reimbursementCampaign.budgetRaw,'10000000000000000000000000');
 assert.equal(campaign.fundingBudgetRaw,model.reimbursementCampaign.budgetRaw);
});
test('snapshot integrity rejects a totals-preserving reassignment',()=>{
 server.validateCheckerIntegrity(snapshot);
 const changed=structuredClone(snapshot),wallets=changed.holders.filter(h=>h.kind==='wallet');
 wallets[0].amountRaw=(BigInt(wallets[0].amountRaw)-1n).toString();
 wallets[1].amountRaw=(BigInt(wallets[1].amountRaw)+1n).toString();
 model.validateCheckerSnapshot(changed);
 assert.throws(()=>server.validateCheckerIntegrity(changed),/content mismatch/);
});
test('HTTP response validation rejects malformed amounts, states and inconsistent estimates',()=>{
 const valid=model.lookupReimbursement(snapshot,owner,{status:'available',amountRaw:'100',slot:449032980,checkedAt:new Date().toISOString()});
 assert.equal(model.isReimbursementLookup(valid,owner),true);
 for(const patch of [{status:'toString'},{currentBalance:null},{snapshotBalanceRaw:'NaN'},{estimateRaw:'1'},{availableWithinSnapshotRaw:'101'},{claimsEnabled:true},{currentBalance:{...valid.currentBalance,amountRaw:'-1'}},{currentBalance:{...valid.currentBalance,checkedAt:'bad'}}])assert.equal(model.isReimbursementLookup({...valid,...patch},owner),false);
 assert.equal(model.isReimbursementLookup(null,owner),false);
 assert.equal(model.isReimbursementLookup(valid,'different'),false);
});
test('verified snapshot and proportional preview never approve claims',()=>{
 model.validateCheckerSnapshot(snapshot);
 const result=model.lookupReimbursement(snapshot,owner,missing),h=snapshot.holders.find(h=>h.owner===owner);
 assert.equal(result.estimateRaw,proportionalQuote(BigInt(h.amountRaw),564937895383759533n,10000000000000000000000000n).toString());
 assert.equal(result.claimsEnabled,false);assert.equal(result.allowPartialSurrender,true);assert.equal(result.approvedAllocationRaw,null);assert.equal(result.requiredSurrenderRaw,null);assert.equal(result.currentBalance.amountRaw,null);
 const changed=structuredClone(snapshot);changed.holders[1].amountRaw='1';assert.throws(()=>model.validateCheckerSnapshot(changed),/totals/);
 const duplicate=structuredClone(snapshot);duplicate.holders.push(duplicate.holders[1]);assert.throws(()=>model.validateCheckerSnapshot(duplicate),/holding/);
});
test('pool, custody, absent and malformed owners cannot get an ordinary wallet award',()=>{
 for(const [kind,status] of [['pool','pool-excluded'],['custody','custody-review']]){const r=model.lookupReimbursement(snapshot,snapshot.holders.find(h=>h.kind===kind).owner,missing);assert.equal(r.status,status);assert.equal(r.estimateRaw,null);}
 assert.equal(model.lookupReimbursement(snapshot,'11111111111111111111111111111111',missing).status,'not-in-snapshot');
 for(const a of ['bad','0x'+'a'.repeat(40),'1'.repeat(44),'a'.repeat(100)])assert.throws(()=>model.publicSolanaAddress(a));
});
function account(address,amount,state='initialized'){return {pubkey:address,account:{owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{program:'spl-token',parsed:{type:'account',info:{mint:model.reimbursementCampaign.sourceMint,owner,state,tokenAmount:{amount,decimals:9}}}}}};}
function rpc(rows,patch={}){const calls=[];return {calls,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return Response.json({result:body.method==='getGenesisHash'?(patch.genesis??'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'):{context:{slot:patch.slot??449032980},value:rows}});}};}
test('current read sums exact unfrozen balances at finalized mainnet state',async()=>{
 const r=rpc([account(snapshot.holders[0].owner,'9007199254740993'),account(snapshot.holders[1].owner,'1'),account(snapshot.holders[2].owner,'999','frozen')]);
 const b=await server.readCurrentOldHive(owner,'https://test.invalid',r.fetch);assert.equal(b.amountRaw,'9007199254740994');
 assert.deepEqual(r.calls.map(c=>c.method).sort(),['getGenesisHash','getTokenAccountsByOwner']);
 assert.equal(r.calls.find(c=>c.method==='getTokenAccountsByOwner').params[2].commitment,'finalized');
 assert.equal(model.lookupReimbursement(snapshot,owner,{...b,amountRaw:'1'}).availableWithinSnapshotRaw,'1');
 const empty=await server.readCurrentOldHive(owner,'https://test.invalid',rpc([]).fetch);assert.equal(empty.amountRaw,'0');
});
test('failed, stale, wrong-chain, duplicated or malformed reads remain unknown, never zero',async()=>{
 const row=account(snapshot.holders[0].owner,'1');
 for(const r of [rpc([row],{genesis:'wrong'}),rpc([row],{slot:1}),rpc([row,row]),rpc([account(row.pubkey,'1.1')]),rpc([account(row.pubkey,'1','wrong')])])assert.equal((await server.readCurrentOldHive(owner,'https://test.invalid',r.fetch)).status,'unavailable');
 assert.deepEqual(await server.readCurrentOldHive(owner,undefined),missing);
 assert.deepEqual(await server.readCurrentOldHive(owner,'https://secret.invalid',async()=>{throw Error('https://secret.invalid')}),missing);
});
test('GET endpoint rejects invalid input, limits abuse and cannot enable claims',async()=>{
 let count=0,allowed=true;
 const route=load('../app/api/token/claim/route.ts',{'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@/lib/rate-limit':{getClientIp:()=> 'test',checkRateLimit:()=>({allowed,resetInSeconds:60})},'@/lib/hive-reimbursement':model,'@/lib/hive-reimbursement-server':{getReimbursementLookup:async address=>{count++;return model.lookupReimbursement(snapshot,address,missing);}}});
 for(const q of ['', '?owner=bad',`?owner=${owner}&owner=${owner}`])assert.equal((await route.GET(new Request('http://test/api/token/claim'+q))).status,400);
 assert.equal(count,0);
 const response=await route.GET(new Request('http://test/api/token/claim?owner='+owner));assert.match(response.headers.get('cache-control'),/no-store/);const body=await response.json();assert.equal(body.claimsEnabled,false);assert.equal(body.allowPartialSurrender,true);
 allowed=false;assert.equal((await route.GET(new Request('http://test/api/token/claim?owner='+owner))).status,429);assert.equal(count,1);
});
test('migration proxy defaults closed and rejects cross-origin, oversized and unknown actions',async()=>{
 const old=process.env.HIVE_CLAIM_UI_ENABLED;delete process.env.HIVE_CLAIM_UI_ENABLED;
 try {
  const route=load('../app/api/token/claim/migration/route.ts',{'@/lib/hive-local-claim-test':{localClaimTestOwner:()=>null},'@/lib/hive-claim-schedule':load('../lib/hive-claim-schedule.ts'),'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@/lib/rate-limit':{getClientIp:()=> 'test',checkRateLimit:()=>({allowed:true})}});
  assert.deepEqual(await (await route.GET(new Request('https://hive.test/api/token/claim/migration'))).json(),{enabled:false});
  const req=(body,origin='http://test')=>new Request('http://test/api/token/claim/migration',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await route.POST(req({action:'quote',input:{}},'https://other.invalid'))).status,403);
  assert.equal((await route.POST(req({action:'execute',input:{}}))).status,400);
  assert.equal((await route.POST(req({action:'quote',input:'x'.repeat(17000)}))).status,400);
  assert.equal((await route.POST(req({action:'quote',input:{}}))).status,503);
  const promoted=(host,origin)=>new Request('https://'+host+'/api/token/claim/migration',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'quote',input:{}})});
  assert.equal((await route.POST(promoted('verified--hive-protocol.netlify.app','https://uphive.xyz'))).status,503);
  assert.equal((await route.POST(promoted('verified--hive-protocol.netlify.app','https://evil.invalid'))).status,403);
  assert.equal((await route.POST(promoted('hive-protocol.netlify.app.evil.invalid','https://uphive.xyz'))).status,403);
 }finally{if(old===undefined)delete process.env.HIVE_CLAIM_UI_ENABLED;else process.env.HIVE_CLAIM_UI_ENABLED=old;}
});
const fmt=load('../lib/hive-claim-format.ts');
const reviewModel=load('../lib/hive-claim-review.ts',{'./hive-reimbursement':model,'../tools/hive-migration/proportional-model.mjs':{proportionalQuote}});
test('current minimum is inclusive and separate from the snapshot allowance and partial deposit',()=>{
 const base=model.lookupReimbursement(snapshot,owner,{status:'available',amountRaw:'999999999999999',slot:449032980,checkedAt:new Date().toISOString()});
 assert.equal(reviewModel.migrationReview(base).status,'below-minimum');
 const qualifies={...base,currentBalance:{...base.currentBalance,amountRaw:'1000000000000000'}};
 assert.equal(reviewModel.migrationReview(qualifies,'1').depositRaw,'1');
 const smallSnapshot={...qualifies,snapshotBalanceRaw:'100'};
 assert.equal(reviewModel.migrationReview(smallSnapshot).status,'snapshot-below-minimum');
 assert.equal(reviewModel.migrationReview({...qualifies,status:'not-in-snapshot',snapshotBalanceRaw:null}).status,'snapshot-required');
});
test('chosen partial deposits use exact input and reject amounts outside the available allowance',()=>{
 assert.equal(reviewModel.parseOldHiveInput('50.200000001'),'50200000001');
 for(const value of ['', '0','-1','1e3','50K','1,000','0.0000000001','18446744073.709551616'])assert.equal(reviewModel.parseOldHiveInput(value),null);
 const result=model.lookupReimbursement(snapshot,owner,{status:'available',amountRaw:'1000000000000000',slot:449032980,checkedAt:new Date().toISOString()});
 const q=reviewModel.migrationReview(result,'1000000000');
 assert.equal(q.depositRaw,'1000000000');assert.equal(q.receiveRaw,proportionalQuote(1000000000n,564937895383759533n,10000000000000000000000000n).toString());
 for(const raw of ['0','-1','1.5','1000000000000001','9'.repeat(50)])assert.equal(reviewModel.migrationReview(result,raw).status,'invalid-amount');
});
test('compact token amounts use at most one decimal with exact integer rounding',()=>{
 for(const [raw,decimals,expected] of [['50200000000000',9,'50.2K'],['40000000000000000',9,'40M'],['999960000000000',9,'1M'],['999960000000',9,'1K'],['100000000',9,'0.1'],['1',18,'<0.1'],['0',9,'0'],['1234000000',9,'1.2']])assert.equal(fmt.compactHive(raw,decimals),expected);
 assert.equal(fmt.exactHive('1000000000000000001',18),'1.000000000000000001');
 assert.throws(()=>fmt.compactHive('NaN',9));assert.throws(()=>fmt.compactHive('-1',9));
});
test('migration review caps later purchases and allows reduced holdings proportionally without promising a claim',()=>{
 const h=snapshot.holders.find(h=>h.owner===owner),full=BigInt(h.amountRaw);
 const lookup=amount=>model.lookupReimbursement(snapshot,owner,{status:'available',amountRaw:String(amount),slot:449032980,checkedAt:new Date().toISOString()});
 const fullReview=reviewModel.migrationReview(lookup(full*2n));
 assert.equal(fullReview.depositRaw,h.amountRaw);assert.equal(fullReview.receiveRaw,lookup(full).estimateRaw);assert.equal(fullReview.executable,false);
 const partial=reviewModel.migrationReview(lookup(full/2n));assert.equal(partial.status,'campaign-pending');assert.ok(BigInt(partial.receiveRaw)<BigInt(fullReview.receiveRaw));
 assert.equal(reviewModel.migrationReview(lookup(0n)).status,'no-holdings');
 assert.equal(reviewModel.migrationReview(model.lookupReimbursement(snapshot,owner,missing)).status,'balance-unavailable');
 for(const kind of ['pool','custody']){const r=reviewModel.migrationReview(model.lookupReimbursement(snapshot,snapshot.holders.find(h=>h.kind===kind).owner,missing));assert.equal(r.depositRaw,null);assert.equal(r.receiveRaw,null);}
});

const scheduleModel=load('../lib/hive-claim-schedule.ts');
test('claim window starts only at an explicit opening time, never checker release',()=>{
 const s=scheduleModel.claimSchedule('2026-10-01T12:00:00+01:00');
 assert.equal(new Date(s.opensAt).toISOString(),'2026-10-01T11:00:00.000Z');
 assert.equal(s.closesAt-s.opensAt,604800000);
 assert.equal(scheduleModel.claimCountdown(s,s.opensAt-86400000),'24:00:00');
 assert.equal(scheduleModel.claimCountdown(s,s.opensAt-1000),'00:00:01');
 assert.equal(scheduleModel.claimCountdown(s,s.opensAt),'168:00:00');
 assert.equal(scheduleModel.claimCountdown(s,s.closesAt),'00:00:00');
 assert.equal(scheduleModel.claimCountdown(s,s.closesAt+1000),'00:00:00');
 for(const bad of [undefined,'','tomorrow','2026-10-01T12:00:00','invalid'])assert.equal(scheduleModel.claimSchedule(bad),null);
});

test('final wallet allocation conserves the 10M budget and matches every eligible frozen wallet',()=>{
 const a=JSON.parse(readFileSync(new URL('../data/hive-claim-allocation.json',import.meta.url)));
 const eligible=snapshot.holders.filter(h=>h.kind==='wallet'&&BigInt(h.amountRaw)>=1000000000000000n);
 assert.equal(a.rows.length,72);assert.equal(a.rows.length,eligible.length);
 assert.equal(a.totalEligibleOldRaw,model.reimbursementCampaign.eligibleOldRaw);
 let total=0n;
 for(const h of eligible){const r=a.rows.find(r=>r.owner===h.owner);assert.equal(r.amountRaw,h.amountRaw);assert.equal(r.allocationNewRaw,proportionalQuote(BigInt(h.amountRaw),BigInt(a.totalEligibleOldRaw),BigInt(a.budgetNewRaw)).toString());total+=BigInt(r.allocationNewRaw);}
 assert.equal(total+BigInt(a.unallocatedNewRaw),10000000000000000000000000n);
 assert.equal(a.unallocatedNewRaw,'37');
});

test('explicit supplemental wallet is eligible without falsifying the snapshot or changing ordinary awards',()=>{
 const e=model.supplementalClaim;const current={status:'available',amountRaw:e.allowanceRaw,slot:449983604,checkedAt:new Date().toISOString()};
 assert.equal(snapshot.holders.some(h=>h.owner===e.owner),false);
 const result=model.lookupReimbursement(snapshot,e.owner,current);
 assert.equal(result.status,'approved-exception');assert.equal(result.snapshotBalanceRaw,null);assert.equal(result.exceptionAllowanceRaw,e.allowanceRaw);assert.equal(result.estimateRaw,e.grantRaw);
 assert.equal(model.isReimbursementLookup(result,e.owner),true);
 assert.equal(model.isReimbursementLookup({...result,estimateRaw:'1'},e.owner),false);
 assert.equal(model.isReimbursementLookup({...result,snapshotBalanceRaw:e.allowanceRaw},e.owner),false);
 const review=load('../lib/hive-claim-review.ts',{'./hive-reimbursement':model,'../tools/hive-migration/proportional-model.mjs':{proportionalQuote}});
 assert.equal(review.migrationReview(result).receiveRaw,e.grantRaw);
 const partial=review.migrationReview(result,'1000000000000000');assert.equal(partial.receiveRaw,(1000000000000000n*BigInt(e.grantRaw)/BigInt(e.allowanceRaw)).toString());
 assert.equal(review.migrationReview({...result,currentBalance:{...current,amountRaw:'999999999999999'}}).status,'below-minimum');
});
test('local early-claim gate rejects production, remote hosts and other wallet settings',()=>{
 const priorNode=process.env.NODE_ENV,priorWallet=process.env.HIVE_LOCAL_CLAIM_TEST_OWNER;
 const gate=load('../lib/hive-local-claim-test.ts',{'./hive-reimbursement':model});
 try{
  process.env.HIVE_LOCAL_CLAIM_TEST_OWNER=model.supplementalClaim.owner;process.env.NODE_ENV='production';assert.equal(gate.localClaimTestOwner('http://localhost:3000'),null);
  process.env.NODE_ENV='development';assert.equal(gate.localClaimTestOwner('https://uphive.xyz'),null);assert.equal(gate.localClaimTestOwner('http://localhost.attacker.test'),null);
  assert.equal(gate.localClaimTestOwner('http://localhost:3000'),model.supplementalClaim.owner);
  process.env.HIVE_LOCAL_CLAIM_TEST_OWNER=owner;assert.equal(gate.localClaimTestOwner('http://localhost:3000'),null);
 }finally{if(priorNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=priorNode;if(priorWallet===undefined)delete process.env.HIVE_LOCAL_CLAIM_TEST_OWNER;else process.env.HIVE_LOCAL_CLAIM_TEST_OWNER=priorWallet;}
});

test('upstream outages report service unavailability instead of claim verification errors',async()=>{
 const saved={enabled:process.env.HIVE_CLAIM_UI_ENABLED,url:process.env.HIVE_CLAIM_GATEWAY_URL,token:process.env.HIVE_CLAIM_GATEWAY_TOKEN,fetch:globalThis.fetch};
 try{
  process.env.HIVE_CLAIM_UI_ENABLED='true';process.env.HIVE_CLAIM_GATEWAY_URL='https://gateway.invalid';process.env.HIVE_CLAIM_GATEWAY_TOKEN='test';
  const route=load('../app/api/token/claim/migration/route.ts',{'@/lib/hive-local-claim-test':{localClaimTestOwner:()=>null},'@/lib/hive-claim-schedule':load('../lib/hive-claim-schedule.ts'),'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@/lib/rate-limit':{getClientIp:()=> 'test',checkRateLimit:()=>({allowed:true})}});
  for(const status of [429,500,502,503,504]){
   globalThis.fetch=async()=>new Response('Upstream unavailable',{status});
   const availability=await route.GET(new Request('https://hive.test/api/token/claim/migration'));
   assert.equal(availability.status,200);assert.deepEqual(await availability.json(),{enabled:false});
   const response=await route.POST(new Request('https://hive.test/api/token/claim/migration',{method:'POST',headers:{origin:'https://hive.test','content-type':'application/json'},body:JSON.stringify({action:'status',input:{}})}));
   assert.equal(response.status,503);assert.equal((await response.json()).code,'SERVICE_UNAVAILABLE');
  }
 }finally{
  globalThis.fetch=saved.fetch;
  for(const [key,value]of [['HIVE_CLAIM_UI_ENABLED',saved.enabled],['HIVE_CLAIM_GATEWAY_URL',saved.url],['HIVE_CLAIM_GATEWAY_TOKEN',saved.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
