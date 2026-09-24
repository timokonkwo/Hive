import test from 'node:test';import assert from 'node:assert/strict';import {Keypair} from '@solana/web3.js';import {getBase58Decoder} from '@solana/kit';import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {memorySigners,requireDirectLocal,localOwner} from './local-test.mjs';
const s=Keypair.generate(),key=generatePrivateKey(),e=privateKeyToAccount(key),config={admin:s.publicKey.toBase58(),destinationAdmin:e.address};
const input=()=>({consent:'local-memory-only',solanaPrivateKey:getBase58Decoder().decode(s.secretKey),evmPrivateKey:key});
test('local operator requires explicit consent and exact admin keys, then clears input fields',()=>{
 const value=input(),signers=memorySigners(value,config);assert.equal(signers.solana.publicKey.toBase58(),config.admin);assert.equal(signers.evm.address,e.address);assert.equal(value.solanaPrivateKey,'');assert.equal(value.evmPrivateKey,'');assert.deepEqual([...signers.solana.secretKey],[...s.secretKey]);
 for(const change of [{consent:undefined},{solanaPrivateKey:'private input must not be echoed'},{evmPrivateKey:generatePrivateKey()}]){const v={...input(),...change};assert.throws(()=>memorySigners(v,config),error=>error.message==='Explicit local-operator consent and both matching admin private keys are required.');assert.equal(v.solanaPrivateKey,'');assert.equal(v.evmPrivateKey,'');}
});
test('private-key transport cannot be used through Cloudflare or any forwarded connection',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{}};requireDirectLocal(req,'http://localhost:8789');
 assert.throws(()=>requireDirectLocal(req,'https://unit.trycloudflare.com'));
 for(const h of ['cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto'])assert.throws(()=>requireDirectLocal({...req,headers:{[h]:'test'}},'http://localhost:8789'));
 assert.throws(()=>requireDirectLocal({...req,socket:{remoteAddress:'192.168.1.1'}},'http://localhost:8789'));
});
test('local gateway never admits another wallet even after the ordinary opening time',()=>{
 const owner=config.admin;for(const action of ['quote','register','status','deposit']){localOwner(action,{owner},owner);localOwner(action,{request:{owner}},owner);assert.throws(()=>localOwner(action,{owner:'other'},owner));assert.throws(()=>localOwner(action,{},owner));}
 localOwner('availability',{},owner);
});
