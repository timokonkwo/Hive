// Disposable Anvil + MongoDB only. No real signing key or live transaction.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createPublicClient, http, parseEther, toHex } from 'viem';
import { managed, metadata, policy, worker, store, journal, receipts, reviewedRelease } from './modules.mjs';
const endpoint=new URL(process.env.HIVE_PONS_FORK_URL||'http://127.0.0.1:18547');
const mongoUri=process.env.HIVE_TOKENIZATION_TEST_MONGO_URI||'mongodb://127.0.0.1:27932';
if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost'].includes(endpoint.hostname)||endpoint.username||endpoint.password)throw Error('Local fork required.');
if(!/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(mongoUri))throw Error('Isolated local MongoDB required.');
const client=createPublicClient({transport:http(endpoint.href,{timeout:15000,retryCount:0})});
if(!String(await client.request({method:'web3_clientVersion'})).toLowerCase().includes('anvil')||await client.getChainId()!==4663)throw Error('Refusing to transact outside a local Anvil fork.');
const mongo=new MongoClient(mongoUri);await mongo.connect();
const db=mongo.db('hive_managed_fork_'+randomUUID().replaceAll('-',''));
const checkpoint=await client.request({method:'evm_snapshot'});
const key=generatePrivateKey(),account=privateKeyToAccount(key);
// The tooling loader exports a private CommonJS instance. Override only after
// checking Anvil; the application always uses the fixed real Hive address.
policy.HIVE_LAUNCH_WALLET=account.address;
process.env.PONS_MANAGED_PRIVATE_KEY=key;process.env.PONS_MANAGED_LAUNCH_ENABLED='true';
try{
 await client.request({method:'anvil_setBalance',params:[account.address,toHex(parseEther('10'))]});
 for(const purchase of ['0','0.1']){
  const id=new ObjectId(),agent={_id:id,name:'Managed fork '+purchase,bio:'An isolated managed signing rehearsal.',status:'active'};
  await db.collection('agents').insertOne(agent);
  const refreshPreview=async()=>metadata.profilePreview(id.toHexString(),await db.collection('agents').findOne({_id:id}),'admin');
  const preview=await refreshPreview(),services={release:reviewedRelease.reviewedLaunchRelease,refreshPreview,
   persistAvatar:async()=> 'ipfs://bafybeigdyrztabcdefghijklmnopqrstuv234567abcdefghijklmnop'};
  let intent=await managed.prepareManagedLaunch(db,client,preview,{symbol:'MANAGED',purchase},services);
  assert.equal(intent.mode,'managed');assert.equal(intent.phase,'awaiting-signature');
  const before=await client.getBalance({address:account.address});
  const prepared=journal.unpackPrepared(intent.prepared);
  // Real raw signing, journal CAS, broadcast, contract execution and receipt reads.
  intent=await managed.confirmManagedLaunch(db,client,intent,intent.prepared.digest,services);
  const receipt=await client.waitForTransactionReceipt({hash:intent.transactionHash});assert.equal(receipt.status,'success');
  assert.equal((await receipts.reconcileLaunchReceipt(client,{candidate:prepared.candidate,nonce:intent.nonce,prediction:prepared.prediction},intent.transactionHash)).state,'confirming');
  await managed.confirmManagedLaunch(db,client,intent,intent.prepared.digest,services);
  assert.equal(await client.getTransactionCount({address:account.address}),intent.nonce+1);
  await client.request({method:'anvil_mine',params:[toHex(64)]});
  const result=await worker.runLaunchRecovery(db,client);assert.equal(result.confirmed,1);assert.equal(result.published,1);
  const saved=await new store.LaunchStore(db).current(id.toHexString());
  assert.equal(saved.phase,'confirmed');assert.equal(saved.managedPending,false);
  const updated=await db.collection('agents').findOne({_id:id});assert.equal(updated.ponsToken.transactionHash,intent.transactionHash);
  const after=await client.getBalance({address:account.address});
  assert.equal(before-after,prepared.candidate.value+receipt.gasUsed*receipt.effectiveGasPrice);
  console.log(`PASS managed fork: ${purchase} ETH purchase, exact signed call, retry without a second nonce, finalized receipt, profile publication, signer released.`);
 }
}finally{
 await client.request({method:'evm_revert',params:[checkpoint]});await db.dropDatabase();await mongo.close();
}
console.log('Fork reverted and disposable database removed. No live funds used.');
