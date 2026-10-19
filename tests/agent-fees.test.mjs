import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { loadTypeScript } from './helpers/load-typescript.mjs';
const {claimableLamports,claimAgentFees}=loadTypeScript(new URL('../lib/agent-fees.ts',import.meta.url),{'@solana/web3.js':web3,bs58:{default:bs58}});
function fixture(){
 const keypair=web3.Keypair.generate(),mint=web3.Keypair.generate().publicKey.toBase58(),blockhash=web3.Keypair.generate().publicKey.toBase58();
 const tx=new web3.VersionedTransaction(new web3.TransactionMessage({payerKey:keypair.publicKey,recentBlockhash:blockhash,instructions:[]}).compileToV0Message());
 const expiry={blockhash,lastValidBlockHeight:123};let sent=0;
 const bags={keypair,getClaimablePositions:async()=>[{baseMint:mint,totalClaimableLamportsUserShare:'1000000',virtualPoolClaimableLamportsUserShare:0}],
  sdk:{bagsApiClient:{post:async(path,body)=>{assert.equal(path,'/token-launch/claim-txs/v3');assert.deepEqual(body,{feeClaimer:keypair.publicKey.toBase58(),tokenMint:mint});return[{tx:bs58.encode(tx.serialize()),blockhash:expiry}];}}},
  connection:{sendRawTransaction:async(bytes,options)=>{assert.equal(options.skipPreflight,false);const signed=web3.VersionedTransaction.deserialize(bytes);assert.ok(signed.signatures[0].some(v=>v!==0));assert.equal(signed.message.recentBlockhash,blockhash);sent++;return'signature';},confirmTransaction:async(strategy,commitment)=>{assert.deepEqual(strategy,{signature:'signature',...expiry});assert.equal(commitment,'confirmed');return{value:{err:null}};}}};
 return{bags,expiry,mint,sent:()=>sent};
}
test('fee amounts include vault shares and reject unknown balances',()=>{
 assert.equal(claimableLamports({totalClaimableLamportsUserShare:'9007199254740993'}),9007199254740993n);
 for(const value of [undefined,-1,'NaN','1.2'])assert.throws(()=>claimableLamports({totalClaimableLamportsUserShare:value}));
});
test('claims use v3, preserve the transaction blockhash and verify chain success',async()=>{
 const f=fixture(),r=await claimAgentFees(f.bags);assert.equal(r.claimed,1);assert.equal(r.failed,0);assert.equal(f.sent(),1);assert.equal(r.transactions[0].confirmed,true);
});
test('on-chain errors and uncertain confirmations never report success',async()=>{
 for(const confirm of [async()=>({value:{err:{InstructionError:[0,'failed']}}}),async()=>{throw Error('timeout')}]){
  const f=fixture();f.bags.connection.confirmTransaction=confirm;
  const r=await claimAgentFees(f.bags);assert.equal(r.claimed,0);assert.equal(r.failed,1);assert.equal(r.transactions[0].confirmed,false);assert.match(r.error,/could not be confirmed/);
 }
});
test('an API outage is not treated as zero fees and empty transaction lists are not counted as claims',async()=>{
 const f=fixture();f.bags.getClaimablePositions=async()=>{throw Error('Bags unavailable')};await assert.rejects(claimAgentFees(f.bags),/unavailable/);
 const g=fixture();g.bags.sdk.bagsApiClient.post=async()=>[];const r=await claimAgentFees(g.bags);assert.equal(r.claimed,0);assert.equal(g.sent(),0);
});
test('expiry mismatch rejects before broadcast',async()=>{
 const f=fixture();f.expiry.blockhash=web3.Keypair.generate().publicKey.toBase58();const r=await claimAgentFees(f.bags);assert.equal(r.failed,1);assert.equal(f.sent(),0);
});
