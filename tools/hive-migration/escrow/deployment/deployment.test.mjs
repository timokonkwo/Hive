import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Keypair,PublicKey,SystemInstruction} from '@solana/web3.js';
import {createBuffer,writeBuffer,deployProgram,LOADER,programDataAddress} from './loader.mjs';
import {requireFreshReview,saveJson,verifyEvmTransaction} from './safety.mjs';import {unsignedTransaction} from '../client.mjs';
const admin=Keypair.generate(),buffer=Keypair.generate(),program=Keypair.generate();
// Golden wire layout and account order from the Solana loader-v3 SDK.
test('buffer initialization is atomic with rent-funded allocation and retained authority',()=>{
 const i=createBuffer(admin.publicKey,buffer.publicKey,1000,1234);
 const create=SystemInstruction.decodeCreateAccount(i[0]);assert.equal(create.space,1037);assert.equal(create.lamports,1234);assert.ok(create.programId.equals(LOADER));
 assert.equal(i[1].data.toString('hex'),'00000000');assert.ok(i[1].keys[0].pubkey.equals(buffer.publicKey));assert.ok(i[1].keys[1].pubkey.equals(admin.publicKey));
});
test('loader write uses the SDK encoding and the largest batch chunk fits one transaction',()=>{
 const instruction=writeBuffer(admin.publicKey,buffer.publicKey,900,Buffer.from([10,11]));
 assert.equal(instruction.data.toString('hex'),'010000008403000002000000000000000a0b');assert.equal(instruction.keys[1].isSigner,true);
 const tx=unsignedTransaction([writeBuffer(admin.publicKey,buffer.publicKey,0,Buffer.alloc(900))],admin.publicKey.toBase58(),PublicKey.default.toBase58());tx.sign([admin]);assert.ok(tx.serialize().length<=1232);
 assert.throws(()=>writeBuffer(admin.publicKey,buffer.publicKey,0,Buffer.alloc(901)),/Invalid/);
});
test('program deployment creates program and loader instruction in the same transaction',()=>{
 const [account,i]=deployProgram(admin.publicKey,program.publicKey,buffer.publicKey,1000,42);assert.equal(SystemInstruction.decodeCreateAccount(account).space,36);
 assert.equal(i.data.toString('hex'),'02000000e803000000000000');assert.equal(i.keys.length,8);assert.ok(i.keys[1].pubkey.equals(programDataAddress(program.publicKey)));assert.ok(i.keys[7].pubkey.equals(admin.publicKey));assert.equal(i.keys[7].isSigner,true);
});
test('unsigned reviews may refresh, approved or journaled deployments cannot be overwritten',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hive-deploy-test-'));try{
  const p=join(dir,'review.json');saveJson(p,{terminalPolicyUserConfirmed:false,amount:10n});requireFreshReview(dir);assert.equal(JSON.parse(readFileSync(p)).amount,'10');assert.equal(statSync(p).mode&0o777,0o600);
  saveJson(p,{terminalPolicyUserConfirmed:true});assert.throws(()=>requireFreshReview(dir),/Approved/);
  saveJson(p,{terminalPolicyUserConfirmed:false});writeFileSync(join(dir,'transactions.jsonl'),'');assert.throws(()=>requireFreshReview(dir),/already started/);
 }finally{rmSync(dir,{recursive:true});}
});
test('wallet receipt verification rejects changed recipients, calldata, nonce, value or fee ceilings',()=>{
 const expected={from:'0x'+'11'.repeat(20),to:'0x'+'22'.repeat(20),nonce:'0x2',data:'0x1234',gas:'0x5208',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x2'};
 const actual={...expected,nonce:2,input:expected.data,value:0n,gas:21000n,maxFeePerGas:100n,maxPriorityFeePerGas:2n};verifyEvmTransaction(actual,expected);
 for(const change of [{to:expected.from},{input:'0x9999'},{nonce:3},{value:1n},{gas:21001n},{maxFeePerGas:101n},{maxPriorityFeePerGas:3n},{maxFeePerGas:undefined}])assert.throws(()=>verifyEvmTransaction({...actual,...change},expected));
});
