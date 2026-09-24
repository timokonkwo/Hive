import test from 'node:test';import assert from 'node:assert/strict';
import {Keypair,SystemProgram,VersionedTransaction,PublicKey} from '@solana/web3.js';
import {getBase58Decoder} from '@solana/kit';import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {createPublicKey,verify} from 'node:crypto';
import {localKeySigner} from './key-signing.mjs';import {verifySignedEvm} from './safety.mjs';import {unsignedTransaction} from '../client.mjs';
const sol=Keypair.generate(),evmKey=generatePrivateKey(),evm=privateKeyToAccount(evmKey),expected={solanaAdmin:sol.publicKey.toBase58(),robinhoodAdmin:evm.address};
const make=()=>localKeySigner(getBase58Decoder().decode(sol.secretKey),evmKey,expected);
const plan={from:evm.address,to:evm.address,chainId:'0x1237',value:'0x0',nonce:'0x0',data:'0x1234',gas:'0x7530',maxFeePerGas:'0x64',maxPriorityFeePerGas:'0x1'};
test('private-key signer validates derived admin addresses and rejects mismatches',()=>{
 const s=make();assert.equal(s.solanaAddress,expected.solanaAdmin);assert.equal(s.evmAddress,evm.address);s.forget();
 const json=localKeySigner(JSON.stringify([...sol.secretKey]),evmKey.slice(2),expected);assert.equal(json.solanaAddress,expected.solanaAdmin);json.forget();
 assert.throws(()=>localKeySigner(getBase58Decoder().decode(sol.secretKey),evmKey,{...expected,solanaAdmin:Keypair.generate().publicKey.toBase58()}),/does not match/);
 assert.throws(()=>localKeySigner(getBase58Decoder().decode(sol.secretKey),generatePrivateKey(),expected),/does not match/);
 for(const invalid of ['secret words that must never appear in an error','[256]'])assert.throws(()=>localKeySigner(invalid,evmKey,expected),e=>!e.message.includes(invalid)&&/valid Solana/.test(e.message));
});
test('browser Solana signature remains valid after temporary key buffers are cleared',()=>{
 const s=make();const tx=unsignedTransaction([SystemProgram.transfer({fromPubkey:sol.publicKey,toPubkey:sol.publicKey,lamports:0})],sol.publicKey.toBase58(),PublicKey.default.toBase58());
 const signed=VersionedTransaction.deserialize(Buffer.from(s.signSolana(Buffer.from(tx.serialize()).toString('base64')),'base64'));
 const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),sol.publicKey.toBuffer()]),format:'der',type:'spki'});assert.equal(verify(null,signed.message.serialize(),key,signed.signatures[0]),true);
 s.forget();assert.throws(()=>s.signSolana(Buffer.from(tx.serialize()).toString('base64')),/no longer loaded/);
});
test('server accepts only locally signed EVM transactions matching the fixed plan',async()=>{
 const s=make(),raw=await s.signEvm(plan);assert.match(await verifySignedEvm(raw,plan),/^0x[0-9a-f]{64}$/);
 for(const change of [{nonce:'0x1'},{to:'0x'+'22'.repeat(20)},{data:'0xabcd'},{gas:'0x752f'},{maxFeePerGas:'0x63'}])await assert.rejects(verifySignedEvm(raw,{...plan,...change}));
 await assert.rejects(s.signEvm({...plan,chainId:'0x1'}),/Unexpected/);await assert.rejects(s.signEvm({...plan,value:'0x1'}),/Unexpected/);
 const wrongChain=await evm.signTransaction({chainId:1,type:'eip1559',to:evm.address,value:0n,nonce:0,data:plan.data,gas:30000n,maxFeePerGas:100n,maxPriorityFeePerGas:1n});await assert.rejects(verifySignedEvm(wrongChain,plan),/envelope/);
 s.forget();await assert.rejects(s.signEvm(plan),/no longer loaded/);
});
