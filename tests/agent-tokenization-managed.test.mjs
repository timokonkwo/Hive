import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as viem from 'viem';
import * as accounts from 'viem/accounts';
import { MongoClient } from 'mongodb';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { store, policy, journal, metadata, authorization, transactions, managed as actualManaged } from '../scripts/tokenization/modules.mjs';
import { agent, agentId, preparedFor, hash } from './helpers/tokenization-fixture.mjs';
const load = (name, imports) => loadTypeScript(new URL('../lib/agent-tokenization/'+name+'.ts',import.meta.url),imports);
const key='0x'+'1'.repeat(64), account=accounts.privateKeyToAccount(key);
// Test-only adapter uses an unrelated disposable account; production address is never changed.
const testPolicy={...policy,HIVE_LAUNCH_WALLET:account.address};
const signer=load('managed-signer',{'node:crypto':crypto,'viem/accounts':accounts,'./policy':testPolicy});
function env(t){
 const keys=['PONS_MANAGED_PRIVATE_KEY','PONS_MANAGED_LAUNCH_ENABLED'];const before=keys.map(k=>[k,process.env[k]]);
 t.after(()=>{for(const[k,v]of before){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 process.env.PONS_MANAGED_PRIVATE_KEY=key;process.env.PONS_MANAGED_LAUNCH_ENABLED='true';
}
test('managed signer is gated and rejects keys for another wallet; journal is authenticated and intent-bound',t=>{
 env(t);assert.equal(signer.managedDeployerStatus().available,true);
 const sealed=signer.sealSubmission('0x1234','one');
 assert.equal(signer.openSubmission(sealed,'one'),'0x1234');
 assert.throws(()=>signer.openSubmission(sealed,'two'));
 assert.throws(()=>signer.openSubmission({...sealed,ciphertext:'AAAA'},'one'));
 process.env.PONS_MANAGED_PRIVATE_KEY='0x'+'2'.repeat(64);
 assert.equal(signer.managedDeployerStatus().available,false);
 assert.doesNotMatch(JSON.stringify(signer.managedDeployerStatus()),/22222222/);
 process.env.PONS_MANAGED_PRIVATE_KEY=key;delete process.env.PONS_MANAGED_LAUNCH_ENABLED;
 assert.equal(signer.managedDeployerStatus().available,false);
 assert.throws(()=>actualManaged.requireManagedAdmin(metadata.profilePreview(agentId,agent,'owner')),/Only admins/);
});
const uri=process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if(uri&&!/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri))throw Error('Tests require a bare loopback MongoDB URI.');
test('managed submission persistence, concurrency, fencing and recovery',{skip:!uri},async t=>{
 env(t);const mongo=new MongoClient(uri);await mongo.connect();
 const db=mongo.db('hive_managed_'+crypto.randomUUID().replaceAll('-',''));t.after(async()=>{await db.dropDatabase();await mongo.close();});
 const launches=new store.LaunchStore(db),intents=db.collection('pons_launch_intents');
 const preview=metadata.profilePreview(agentId,agent,'admin');
 const choices={symbol:'RESEARCH',purchase:'0'},review=authorization.launchReview(preview,account.address,choices);
 const managed=load('managed',{
  'node:crypto':crypto,viem,'./authorization':authorization,'./policy':testPolicy,'./journal':journal,
  './preparation':{},'./transaction':{...transactions,simulateLaunchCandidate:async()=>preparedFor().prediction},
  './snapshot':{readLaunchSnapshot:async()=>({expectedEconomics:hash,blockNumber:10n,blockHash:hash}),assertReviewedRelease(){}},
  './store':store,'./managed-signer':signer,'./worker':{},
 });
 const services={release:{reviewed:true},refreshPreview:async()=>preview};
 const client={getChainId:async()=>4663,getTransactionCount:async()=>4,getBalance:async()=>10n**18n,getCode:async()=> '0x',
  sendRawTransaction:async({serializedTransaction})=>viem.keccak256(serializedTransaction)};
 async function reserve(id=agentId,nonce=4){
  const p={...preview,agentId:id},r=authorization.launchReview(p,account.address,choices);
  const intent=await launches.reserve(p,account.address,new Date(),{id:crypto.randomUUID(),...r,mode:'managed'});
  const prepared=preparedFor(intent,nonce);return launches.expose(intent,prepared);
 }
 await t.test('one managed signer reservation, unsigned reviews stay outside recovery, discard releases unused nonce',async()=>{
  const attempts=await Promise.allSettled([reserve(),reserve('a'.repeat(24))]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  const intent=attempts.find(x=>x.status==='fulfilled').value;
  assert.equal(await launches.claim(),null);
  await managed.discardManagedLaunch(db,intent);
  assert.equal((await intents.findOne({_id:intent._id})).nonce,undefined);
 });
 await t.test('expired, changed-profile, wrong confirmation and underfunded reviews cannot sign',async()=>{
  let intent=await reserve();
  await assert.rejects(managed.confirmManagedLaunch(db,client,intent,'bad',services),/review changed/);
  await assert.rejects(managed.confirmManagedLaunch(db,client,intent,intent.prepared.digest,{...services,refreshPreview:async()=>({...preview,metadata:{...preview.metadata,name:'Changed'}})}),/details changed/);
  await assert.rejects(managed.confirmManagedLaunch(db,{...client,getBalance:async()=>0n},intent,intent.prepared.digest,services),/more ETH/);
  const expired=journal.unpackPrepared(intent.prepared);expired.expiresAt=1n;
  await assert.rejects(managed.confirmManagedLaunch(db,client,{...intent,prepared:journal.packPrepared(expired)},journal.packPrepared(expired).digest,services),/expired/);
  assert.equal((await intents.findOne({_id:intent._id})).managedSubmission,undefined);
  await managed.discardManagedLaunch(db,intent);
 });
 await t.test('only one concurrent confirmation broadcasts; retry and worker recover identical signed bytes',async()=>{
  const intent=await reserve();const broadcasts=[];
  const rpc={...client,sendRawTransaction:async({serializedTransaction})=>{
   const persisted=await intents.findOne({_id:intent._id});assert.ok(persisted.managedSubmission);assert.equal(persisted.transactionHash,viem.keccak256(serializedTransaction));
   broadcasts.push(serializedTransaction);throw Error('Timeout after acceptance');
  }};
  const both=await Promise.allSettled([managed.confirmManagedLaunch(db,rpc,intent,intent.prepared.digest,services),managed.confirmManagedLaunch(db,rpc,intent,intent.prepared.digest,services)]);
  assert.equal(both.filter(x=>x.status==='fulfilled').length,1);assert.equal(broadcasts.length,1);
  const saved=await intents.findOne({_id:intent._id});assert.equal(saved.phase,'submitted');
  const decoded=viem.parseTransaction(broadcasts[0]);assert.equal(decoded.chainId,4663);assert.equal(decoded.nonce,4);
  assert.equal((await viem.recoverTransactionAddress({serializedTransaction:broadcasts[0]})).toLowerCase(),account.address.toLowerCase());
  await assert.rejects(managed.discardManagedLaunch(db,saved),/submitted/);
  await managed.confirmManagedLaunch(db,rpc,saved,saved.prepared.digest,{...services,refreshPreview:()=>{throw Error('Should not reauthorize signed submission');}});
  await managed.retryManagedSubmissions(db,rpc);assert.equal(broadcasts.length,3);assert.equal(new Set(broadcasts).size,1);
  assert.equal((await launches.claim())._id,saved._id);
  // Finalized receipt processing releases the managed signer reservation.
  const claimed=await intents.findOne({_id:saved._id});await launches.finish(claimed,{phase:'reverted'});
  assert.equal((await intents.findOne({_id:saved._id})).managedPending,false);
 });
 await t.test('discard winning a race prevents a stale confirmation from broadcasting',async()=>{
  const intent=await reserve('b'.repeat(24),5);let sends=0;
  const p={...preview,agentId:'b'.repeat(24)};
  await managed.discardManagedLaunch(db,intent);
  await assert.rejects(managed.confirmManagedLaunch(db,{...client,getTransactionCount:async()=>5,sendRawTransaction:async()=>{sends++;return hash;}},intent,intent.prepared.digest,{...services,refreshPreview:async()=>p}),/launch changed/);
  assert.equal(sends,0);
 });
});

test('managed endpoint requires admin and exact Origin before preparation; only allows structured actions',async()=>{
 let role='admin',calls=0;
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const route=loadTypeScript(new URL('../app/api/agents/[address]/tokenization/managed/route.ts',import.meta.url),{
  viem:{createPublicClient:()=>({}),http:()=>''},
  '@/lib/agent-tokenization/avatar':{persistTokenAvatar(){}},
  '@/lib/agent-tokenization/store':{LaunchStore:class{async current(){return null;}}},
  '@/lib/agent-tokenization/managed':{prepareManagedLaunch:async()=>{calls++;return {};},managedQuote:()=>({transaction:null,mode:'managed'})},
  '@/lib/agent-tokenization/http':{
   LaunchHttpError:HttpError,launchReply:body=>Response.json(body),requireLaunchRelease:()=>({reviewed:true}),
   readLaunchBody:async(req,allowed)=>{const body=await req.json();if(Object.keys(body).some(k=>!allowed.includes(k)))throw new HttpError(400,'Invalid request');return body;},
   withLaunchAccess:async(req,params,fn)=>{try{return await fn({db:{},preview:{role,agentId},origin:'https://uphive.xyz',refreshPreview(){}});}catch(e){return Response.json({error:e.message},{status:e.status||503});}},
  },
 });
 const request=(origin,body={action:'prepare',symbol:'TEST',purchase:'0'})=>new Request('https://uphive.xyz/api',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
 for(const origin of [undefined,'https://evil.test'])assert.equal((await route.POST(request(origin),{})).status,403);
 role='owner';assert.equal((await route.POST(request('https://uphive.xyz'),{})).status,403);assert.equal(calls,0);
 role='admin';assert.equal((await route.POST(request('https://uphive.xyz',{action:'prepare',symbol:'TEST',purchase:'0',privateKey:'never accepted'}),{})).status,400);
 assert.equal((await route.POST(request('https://uphive.xyz'),{})).status,200);assert.equal(calls,1);
 assert.equal((await route.POST(request('https://uphive.xyz',{action:'confirm',id:'stale',confirmation:'wrong'}),{})).status,409);
});
