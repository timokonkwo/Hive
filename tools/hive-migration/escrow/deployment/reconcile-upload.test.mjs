import test from 'node:test';import assert from 'node:assert/strict';
import {Keypair,PublicKey,SystemProgram} from '@solana/web3.js';import {unsignedTransaction} from '../client.mjs';import {expiredUpload} from './reconcile-upload.mjs';
const key=Keypair.generate();const tx=unsignedTransaction([SystemProgram.transfer({fromPubkey:key.publicKey,toPubkey:key.publicKey,lamports:0})],key.publicKey.toBase58(),PublicKey.default.toBase58());
const entry={chain:'solana',action:'upload-900',hash:'fixture',raw:Buffer.from(tx.serialize()).toString('base64'),lastValidBlockHeight:100};
const sol={getSignatureStatuses:async()=>({value:[null]}),getBlockHeight:async()=>101,isBlockhashValid:async()=>({value:false}),getTransaction:async()=>null};
test('upload expiry requires an absent transaction and a finalized expired blockhash',async()=>{
 assert.equal((await expiredUpload(entry,sol)).finalizedBlockHeight,101);
 for(const change of [{getSignatureStatuses:async()=>({value:[{confirmationStatus:'processed'}]})},{getBlockHeight:async()=>100},{isBlockhashValid:async()=>({value:true})},{getTransaction:async()=>({meta:{err:null}})}])assert.equal(await expiredUpload(entry,{...sol,...change}),null);
 await assert.rejects(expiredUpload(entry,{...sol,getTransaction:async()=>{throw Error('RPC unavailable');}}));
});
test('financial, deployment and initialization submissions never use upload expiry recovery',async()=>{
 for(const action of ['buffer','program','initialize','fund','distributor','claim'])assert.equal(await expiredUpload({...entry,action},sol),null);
});
