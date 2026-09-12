import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path,imports){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>{if(!(n in imports))throw Error(n);return imports[n]},m,m.exports);return m.exports;}
const model=load('../components/redesign/task/model.ts',{}),payment=load('../components/redesign/task/payment.ts',{'./model':model});
const sig=payment.base58(new Uint8Array(64).fill(3));
function setup({different=false,storageFail=false,sendFail=false}={}){let events=[],instructions=[],signed=0;
 class PublicKey{constructor(v){this.value=v}}class Transaction{add(i){instructions.push(i);return this}}
 class Connection{async getAccountInfo(){return{}}async getLatestBlockhash(){return{blockhash:'block',lastValidBlockHeight:42}}async sendRawTransaction(){events.push('broadcast');if(sendFail)throw Error('uncertain');return sig}async confirmTransaction(){events.push('confirmed')}}
 const wallet={connect:async()=>({publicKey:{toString:()=>different?'other':'sender'}}),signTransaction:async()=>{signed++;return{signature:new Uint8Array(64).fill(3),serialize:()=>new Uint8Array([1])}}};
 globalThis.window={phantom:{solana:wallet}};globalThis.location={origin:'http://local'};
 const m=load('../components/redesign/dashboard/wallet.ts',{'../task/payment':payment,'../task/model':model,'@solana/web3.js':{Connection,PublicKey,Transaction},'@solana/spl-token':{getAssociatedTokenAddress:async(m,k)=>k.value+'-ata',createTransferCheckedInstruction:(...args)=>args}});
 return{m,wallet,run:()=>m.transferDeposit(25.5,'sender',{treasury:'configured-treasury',mint:'mint'},r=>{events.push('stored');assert.equal(r.signature,sig);if(storageFail)throw Error('storage unavailable')},new AbortController().signal),state:()=>({events,instructions,signed})};}
test('deposit validates connected wallet before building or signing',async()=>{const s=setup({different:true});await assert.rejects(s.run(),/Switch/);assert.equal(s.state().signed,0);assert.deepEqual(s.state().events,[])});
test('deposit persists signature before broadcasting configured exact amount',async()=>{const s=setup();assert.equal(await s.run(),sig);assert.deepEqual(s.state().events,['stored','broadcast','confirmed']);const i=s.state().instructions[0];assert.equal(i[2],'configured-treasury-ata');assert.equal(i[4],25500000n);assert.equal(i[5],6)});
test('storage failure prevents transfer broadcast',async()=>{const s=setup({storageFail:true});await assert.rejects(s.run(),/storage/);assert.deepEqual(s.state().events,['stored'])});
test('uncertain broadcast retains reference without automatic second signing',async()=>{const s=setup({sendFail:true});await assert.rejects(s.run(),/uncertain/);assert.deepEqual(s.state().events,['stored','broadcast']);assert.equal(s.state().signed,1)});
test('wallet linking signs a nonce-bound ownership message only',async()=>{const s=setup();let sent='';const proof=await s.m.walletProof({signMessage:async bytes=>{sent=new TextDecoder().decode(bytes);return{signature:new Uint8Array(64).fill(3)}}},'sender');assert.match(sent,/^Hive Solana Wallet Proof\nAction: link_wallet\nAddress: sender\nNonce: [a-f0-9]{32}\nTimestamp: \d+$/);assert.equal(proof.signature,sig);assert.equal(s.state().signed,0)});
