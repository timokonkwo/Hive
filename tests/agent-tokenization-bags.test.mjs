import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import bs58 from 'bs58';
import { AddressLookupTableAccount, PublicKey, VersionedMessage, VersionedTransaction, TransactionMessage, Keypair, SystemProgram } from '@solana/web3.js';
import { bagsFeeConfig as fees, bagsValidation as validator, bagsSetup, bagsLaunch, solanaJournal, solanaRuntime } from '../scripts/tokenization/modules.mjs';
const require = createRequire(import.meta.url);
const { BorshInstructionCoder } = require('@coral-xyz/anchor');
const idl = require('../lib/agent-tokenization/idl/bags-fee-share-v2.json');
const coder = new BorshInstructionCoder(idl);
const fixture = name=>JSON.parse(readFileSync(new URL(`fixtures/${name}.json`,import.meta.url)));
const prepared=fixture('bags-standard-setup'), final=fixture('bags-deployer-setup'), publicLaunch=fixture('bags-public-launch');
function tablesFor(tables) { return Object.entries(tables).map(([key,addresses])=>new AddressLookupTableAccount({key:new PublicKey(key),state:{deactivationSlot:0xffffffffffffffffn,lastExtendedSlot:0,lastExtendedSlotStartIndex:0,addresses:addresses.map(a=>new PublicKey(a))}})); }
const tables=tablesFor({...prepared.tables,...publicLaunch.tables});
const connection={getAddressLookupTable:async key=>({value:tables.find(t=>t.key.equals(key))}),getAccountInfo:async key=>{
  const a=Object.values(final.accounts).find(a=>a.address===key.toBase58());return a ? {owner:new PublicKey(a.owner),data:Buffer.from(a.data,'base64')} : null;
}};
const terms={...prepared,uri:'https://example.test/metadata',metadata:{name:'Test',symbol:'TEST'},purchase:0n};
function unpack(row) { return VersionedTransaction.deserialize(Buffer.from(row.transaction,'base64')); }
function change(tx, mutate) {
  const message=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:tables});mutate(message);
  return new VersionedTransaction(message.compileToV0Message(tables));
}
test('official 2.10 interface decodes one- and two-recipient finalized accounts exactly',()=>{
  for(const name of ['bags-deployer-setup','bags-deployer-two-recipients']) {
    const f=fixture(name),bytes=Buffer.from(f.accounts.fee_share_config.data,'base64');
    const actual=fees.decodeBagsFeeConfig(bytes);
    // The first public config was subsequently updated; current state must win
    // over the creation receipt's original recipient.
    assert.deepEqual(actual.claimers.map(k=>k.toBase58()),name === 'bags-deployer-setup' ? ['Cb2kJbASjhfPVyVoRNZnKdZUR45sSfLdbPKNYFHhkz3i'] : f.claimers);
    assert.deepEqual(actual.bps,f.params.params.bps);
    for(const invalid of [bytes.subarray(0,-1),Buffer.concat([bytes,Buffer.alloc(1)])]) assert.throws(()=>fees.decodeBagsFeeConfig(invalid));
    const corrupt=Buffer.from(bytes);corrupt.writeUInt32LE(101,184);assert.throws(()=>fees.decodeBagsFeeConfig(corrupt));
  }
});
test('current live Bags plan accepts its sponsor, separate deployer, standard pool and manager steps',async()=>{
  const kinds=[];
  for(const step of prepared.steps) kinds.push((await validator.validateBagsTransaction(connection,unpack(step),terms,'setup')).setupKind);
  assert.deepEqual(kinds,['fee-config','pool-config','manager']);
});
test('Bags rejects changed claimers, deployer shares, manager, sponsor transfers and pool economics',async()=>{
  const fee=unpack(prepared.steps[0]);
  const invalid=[
    change(fee,m=>{m.instructions.find(i=>i.programId.equals(fees.BAGS_FEE_PROGRAM)).keys[19].pubkey=Keypair.generate().publicKey;}),
    change(fee,m=>{const ix=m.instructions.find(i=>i.programId.equals(fees.BAGS_FEE_PROGRAM)),v=coder.decode(ix.data);v.data.params.deployer_fee_collection_claimers_bps=9999;ix.data=coder.encode(v.name,v.data);}),
    change(fee,m=>{m.instructions.find(i=>i.programId.equals(SystemProgram.programId)).keys[1].pubkey=Keypair.generate().publicKey;}),
    change(fee,m=>{m.instructions.find(i=>i.programId.equals(SystemProgram.programId)).data.writeBigUInt64LE(50001n,4);}),
    change(unpack(prepared.steps[2]),m=>{m.instructions.find(i=>i.programId.equals(fees.BAGS_FEE_PROGRAM)).keys[5].pubkey=Keypair.generate().publicKey;}),
    change(unpack(prepared.steps[1]),m=>{m.instructions.find(i=>i.programId.toBase58()==='dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN').data[8]^=1;}),
  ];
  for(const tx of invalid) await assert.rejects(validator.validateBagsTransaction(connection,tx,terms,'setup'));
});
test('simulated Hive fee accounts verify, but a changed recipient or deployer fails',async()=>{
  const f=fixture('bags-simulated-fee-state');
  const infos=f.accounts.map(a=>({owner:new PublicKey(a.owner),data:Buffer.from(a.data[0],'base64')}));
  const rpc={getMultipleAccountsInfo:async(addresses,commitment)=>{assert.equal(commitment,'finalized');assert.deepEqual(addresses.map(k=>k.toBase58()),f.addresses);return infos;}};
  await fees.verifyBagsFeeState(rpc,f.mint,f.payer);
  const original=Buffer.from(infos[0].data);Keypair.generate().publicKey.toBuffer().copy(infos[0].data,188);
  await assert.rejects(fees.verifyBagsFeeState(rpc,f.mint,f.payer));infos[0].data=original;
  infos[1].data[8]^=1;await assert.rejects(fees.verifyBagsFeeState(rpc,f.mint,f.payer));
});
test('ordered plan refresh preserves completed steps and rejects missing or duplicate steps',async()=>{
  const response={needsCreation:true,feeShareAuthority:prepared.authority,meteoraConfigKey:prepared.config,transactions:prepared.steps.map(row=>({transaction:bs58.encode(Buffer.from(row.transaction,'base64')),blockhash:row.lifetime})),bundles:[]};
  const api={post:async()=>response};
  const plan=await bagsSetup.refreshBagsSetupPlan(connection,api,terms);
  const changed=structuredClone(plan);changed.config=Keypair.generate().publicKey.toBase58();
  const next=await bagsSetup.refreshBagsSetupPlan(connection,api,terms,changed,new Set(['fee-config','pool-config']));
  assert.equal(next.config,changed.config);assert.deepEqual(next.steps[0],changed.steps[0]);
  response.transactions=[response.transactions[0],response.transactions[0]];
  await assert.rejects(bagsSetup.refreshBagsSetupPlan(connection,api,terms),/duplicate/);
  response.transactions=[];response.needsCreation=false;
  await assert.rejects(bagsSetup.refreshBagsSetupPlan(connection,api,terms,plan,new Set(['fee-config'])),/refresh the remaining/);
});
test('successful public Bags launch verifies atomic initial buy and fixed platform reimbursement',async()=>{
  const tx=new VersionedTransaction(VersionedMessage.deserialize(Buffer.from(publicLaunch.message,'base64')));
  const create=publicLaunch.decoded.find(i=>i.name==='initialize_virtual_pool_with_spl_token');
  const buy=publicLaunch.decoded.find(i=>i.name==='swap');
  const launchTerms={mint:publicLaunch.mint,config:publicLaunch.config,authority:fees.bagsAuthority(publicLaunch.mint).toBase58(),
    payer:buy.keys[9],uri:create.data.params.uri,metadata:create.data.params,purchase:BigInt('0x'+buy.data.params.amount_in)};
  const result=await validator.validateBagsTransaction(connection,tx,launchTerms,'launch');assert.equal(result.pool,create.keys[5]);
  await assert.rejects(validator.validateBagsTransaction(connection,tx,{...launchTerms,purchase:1n},'launch'));
  await assert.rejects(validator.validateBagsTransaction(connection,tx,{...launchTerms,uri:'https://changed.test'},'launch'));
  const redirected=change(tx,m=>{m.instructions.filter(i=>i.programId.equals(SystemProgram.programId)).at(-1).keys[1].pubkey=Keypair.generate().publicKey;});
  await assert.rejects(validator.validateBagsTransaction(connection,redirected,launchTerms,'launch'));
});
test('sponsored reviews allow zero signer debit and preserve the provider signature',async()=>{
  const sponsor=Keypair.generate(),signer=Keypair.generate();
  const tx=new VersionedTransaction(new TransactionMessage({payerKey:sponsor.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58(),
    instructions:[SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:signer.publicKey,lamports:0})]}).compileToV0Message());
  tx.sign([sponsor]);
  const rpc={getGenesisHash:async()=>solanaJournal.SOLANA_MAINNET_GENESIS,isBlockhashValid:async()=>({value:true}),getBalance:async()=>10000,
    getFeeForMessage:async()=>({value:10000}),simulateTransaction:async()=>({value:{err:null,accounts:[{lamports:10000}]}})};
  const review=await solanaJournal.reviewSolanaTransaction(rpc,tx,signer.publicKey.toBase58(),0n);assert.equal(review.maximumDebit,'0');
  const signed=VersionedTransaction.deserialize(tx.serialize());signed.sign([signer]);
  assert.equal(solanaJournal.verifySignedTransaction(tx,signed.serialize()).signature,bs58.encode(tx.signatures[0]));
  await assert.rejects(solanaJournal.reviewSolanaTransaction(rpc,tx,Keypair.generate().publicKey.toBase58(),0n),/signer/);
});
const mongoUri=process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if (mongoUri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(mongoUri)) throw Error('Tests require an isolated loopback database.');
test('Bags metadata survives multiline uploads, validation failures and retry without allocating another mint', {skip:!mongoUri}, async t=>{
  const mongo=new MongoClient(mongoUri);await mongo.connect();const db=mongo.db('hive_bags_metadata_'+randomUUID().replaceAll('-',''));
  t.after(async()=>{await db.dropDatabase();await mongo.close();});
  const agentId='a'.repeat(24),sessionId=randomUUID(),mint=Keypair.generate().publicKey.toBase58();
  const metadata={name:'Edited agent',symbol:'EDITED',description:'Agent biography.\n\nThis agent is available on Hive.',socials:{website:`https://uphive.xyz/agent/id/${agentId}`,twitter:'',telegram:''}};
  const image='https://res.cloudinary.com/test/image/upload/v1/hive-agent-tokens/'+ 'a'.repeat(64)+'.png';
  let calls=0,wrongName=false;
  const api=new bagsLaunch.BagsLaunchApi('test',async(url,init)=>{
    calls++;
    // Cross the actual multipart serialization boundary that caused the incident.
    const form=await new Request(url,init).formData();
    return Response.json({success:true,response:{tokenMint:mint,tokenMetadata:'https://ipfs.io/ipfs/fixture',tokenLaunch:{
      tokenMint:mint,name:wrongName?'Wrong name':form.get('name'),symbol:form.get('symbol'),description:form.get('description'),website:form.get('website'),twitter:'',telegram:'',accountKeys:'discard',
    }}});
  });
  const intent=randomUUID();
  const first=await bagsLaunch.reserveBagsMetadata(db,api,intent,agentId,sessionId,metadata,image);
  assert.equal(first.mint,mint);assert.equal(calls,1);
  assert.deepEqual(await bagsLaunch.reserveBagsMetadata(db,api,intent,agentId,sessionId,metadata,image),first);assert.equal(calls,1);
  assert.equal((await db.collection('agent_launch_bags_metadata').findOne({_id:intent})).response.tokenLaunch.accountKeys,undefined);
  await assert.rejects(bagsLaunch.reserveBagsMetadata(db,api,intent,agentId,sessionId,{...metadata,name:'Changed again'},image),/another review/);
  wrongName=true;const failed=randomUUID();
  await assert.rejects(bagsLaunch.reserveBagsMetadata(db,api,failed,agentId,sessionId,metadata,image),/different token details/);
  const saved=await db.collection('agent_launch_bags_metadata').findOne({_id:failed});assert.equal(saved.phase,'received');assert.equal(saved.response.tokenMint,mint);
  await assert.rejects(bagsLaunch.reserveBagsMetadata(db,api,failed,agentId,sessionId,metadata,image),/different token details/);assert.equal(calls,2);
  // A crash after persisting the provider response is recovered with no new POST.
  await db.collection('agent_launch_bags_metadata').updateOne({_id:intent},{$set:{phase:'received'},$unset:{mint:'',uri:''}});
  assert.deepEqual(await bagsLaunch.reserveBagsMetadata(db,api,intent,agentId,sessionId,metadata,image),first);assert.equal(calls,2);
  const lost=randomUUID();await db.collection('agent_launch_bags_metadata').insertOne({_id:lost,agentId,sessionId,metadata,image,phase:'requesting'});
  await assert.rejects(bagsLaunch.reserveBagsMetadata(db,api,lost,agentId,sessionId,metadata,image),/unresolved/);assert.equal(calls,2);
});
test('Bags runtime resumes each saved setup step in order across requests', {skip:!mongoUri}, async t=>{
  const mongo=new MongoClient(mongoUri);await mongo.connect();const db=mongo.db('hive_bags_'+randomUUID().replaceAll('-',''));
  t.after(async()=>{await db.dropDatabase();await mongo.close();});
  const id=randomUUID(), session={id:randomUUID(),agentId:'a',role:'admin',metadata:{name:'Test',symbol:'TEST'}};
  const target={intentId:id,terms:{platform:'bags',signer:prepared.payer,purchase:'0',mode:'connected'}};
  const kinds=['fee-config','pool-config','manager'];
  const plan={config:prepared.config,authority:prepared.authority,steps:prepared.steps.map((row,index)=>({kind:kinds[index],...row}))};
  await db.collection('agent_launch_solana_intents').insertOne({_id:id,sessionId:session.id,agentId:'a',platform:'bags',image:'https://example.test/avatar',mint:prepared.mint,uri:terms.uri,
    config:prepared.config,authority:prepared.authority,bagsPlan:plan,setupSteps:kinds.map(k=>bagsSetup.bagsSetupStepId(id,k)),createdAt:new Date()});
  const rpc={...connection,isBlockhashValid:async()=>({value:true}),getGenesisHash:async()=>solanaJournal.SOLANA_MAINNET_GENESIS,getBalance:async()=>100000000,
    getFeeForMessage:async()=>({value:12500}),simulateTransaction:async()=>({value:{err:null,accounts:[{lamports:99999000}]}})};
  for(const kind of kinds){
    // A fresh runtime models a separate serverless invocation.
    const runtime=new solanaRuntime.SolanaLaunchRuntime(db,rpc);
    const step=await runtime.prepare(session,target,{});
    assert.equal(step._id,bagsSetup.bagsSetupStepId(id,kind));
    assert.equal((await runtime.prepare(session,target,{}))._id,step._id);
    // Reusing a review for the approval screen must re-simulate current balances.
    const refreshed=await runtime.prepare(session,target,{}, {refreshReview:true});
    assert.equal(refreshed._id,step._id);
    assert.equal(refreshed.revision,step.revision+1);
    const obsolete='obsolete-blockhash';
    await db.collection('agent_launch_solana_steps').updateOne({_id:step._id},{$set:{'review.blockhash':obsolete}});
    const freshRuntime=new solanaRuntime.SolanaLaunchRuntime(db,{...rpc,isBlockhashValid:async hash=>({value:hash!==obsolete})});
    assert.equal((await freshRuntime.prepare(session,target,{})).revision,refreshed.revision+1,'a live review timestamp cannot keep an expired blockhash');
    await db.collection('agent_launch_solana_steps').updateOne({_id:step._id},{$set:{phase:'confirmed'}});
  }
  assert.equal(await new solanaRuntime.SolanaLaunchRuntime(db,rpc).pendingStep(target),null);
  assert.equal(await db.collection('agent_launch_solana_steps').countDocuments(),3);
  const journal=new solanaJournal.SolanaJournal(db),first=await journal.get(bagsSetup.bagsSetupStepId(id,'fee-config'));
  // Retrying a finalized failure keeps its step/mint and archives the old receipt.
  const failed={...first,phase:'failed',signature:'failed-signature',slot:123,submission:{ciphertext:'fixture',iv:'fixture',tag:'fixture'}};
  await db.collection('agent_launch_solana_steps').replaceOne({_id:first._id},failed);
  await assert.rejects(journal.retryFailed(failed,failed.review),/fresh review/);
  await assert.rejects(journal.retryFailed({...failed,phase:'submitted'},{...failed.review,digest:'new-digest'}),/fresh review/);
  const renewed=await journal.retryFailed(failed,{...failed.review,digest:'new-digest'});
  assert.equal(renewed._id,failed._id);assert.equal(renewed.mint,failed.mint);assert.equal(renewed.phase,'review');assert.equal(renewed.submission,undefined);
  assert.equal((await db.collection('agent_launch_solana_attempts').findOne({_id:'failed-signature'})).stepId,first._id);
  assert.equal((await journal.get(bagsSetup.bagsSetupStepId(id,'pool-config'))).phase,'confirmed');
});

test('Bags config requests and decoded setup bind the owner fee recipient', async () => {
  const recipient=Keypair.generate().publicKey;
  const request=bagsLaunch.bagsFeeConfigRequest(terms.mint,terms.payer,recipient.toBase58());
  assert.deepEqual(request.claimersArray,[recipient.toBase58()]); assert.deepEqual(request.basisPointsArray,[10000]);
  const tx=change(unpack(prepared.steps[0]),m=>{const key=m.instructions.find(i=>i.programId.equals(fees.BAGS_FEE_PROGRAM)).keys[19];key.pubkey=recipient;key.isSigner=false;});
  assert.equal((await validator.validateBagsTransaction(connection,tx,{...terms,recipient:recipient.toBase58()},'setup')).setupKind,'fee-config');
  await assert.rejects(validator.validateBagsTransaction(connection,tx,terms,'setup'));
  const f=fixture('bags-simulated-fee-state');
  const infos=f.accounts.map(a=>({owner:new PublicKey(a.owner),data:Buffer.from(a.data[0],'base64')}));
  recipient.toBuffer().copy(infos[0].data,188);
  const rpc={getMultipleAccountsInfo:async()=>infos};
  await fees.verifyBagsFeeState(rpc,f.mint,f.payer,recipient.toBase58());
  await assert.rejects(fees.verifyBagsFeeState(rpc,f.mint,f.payer));
});
