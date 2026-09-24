import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Keypair,VersionedTransaction} from '@solana/web3.js';
import {privateKeyToAccount} from 'viem/accounts';
import {decodeFunctionData,parseTransaction,recoverTransactionAddress,keccak256} from 'viem';
import {createLiveAdapter} from './live-adapter.mjs';
import {snapshotTree,addresses,claimId,hex} from './client.mjs';
const template=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
const {abi}=JSON.parse(readFileSync(new URL('./evm/out/HiveDistributor.sol/HiveDistributor.json',import.meta.url)));
function fixture(){
  // Deterministic test-only keys. No live identities or RPC calls.
  const signers={solana:Keypair.fromSeed(Buffer.alloc(32,31)),evm:privateKeyToAccount(`0x${'22'.repeat(32)}`)};
  const owner=Keypair.fromSeed(Buffer.alloc(32,32));
  const c={...template.config,admin:signers.solana.publicKey.toBase58(),destinationAdmin:signers.evm.address};
  const tree=snapshotTree(c.campaignId,c.mint,[{owner:owner.publicKey.toBase58(),amountRaw:template.quote.amount}]);c.root=tree.root;
  const q={...template.quote,owner:owner.publicKey.toBase58(),proof:tree.holders[0].proof,claimDeadline:'4600'};
  q.claimId=hex(claimId(addresses(c.program,c.admin,c.campaignId).campaign,q.owner));
  const policy={maxEvmGas:'500000',maxFeePerGasWei:'100',maxTotalEvmFeeWei:'100000000',maxSolanaTransactionCostLamports:'3000000',maxTotalSolanaCostLamports:'10000000'};
  const sol={getLatestBlockhash:async()=>({blockhash:Keypair.fromSeed(Buffer.alloc(32,33)).publicKey.toBase58(),lastValidBlockHeight:100}),simulateTransaction:async()=>({value:{err:null}}),getFeeForMessage:async()=>({value:5000}),getMinimumBalanceForRentExemption:async()=>2039280};
  const evm={estimateGas:async()=>100000n,estimateFeesPerGas:async()=>({maxFeePerGas:10n,maxPriorityFeePerGas:1n}),getTransactionCount:async()=>4};
  const journal={latest:()=>new Map()};
  return {c,q,owner,signers,policy,sol,evm,journal,adapter:()=>createLiveAdapter({config:c},{sol,evm,abi},policy,signers,journal)};
}
test('adapter signs the exact fixed-recipient EVM claim and only its admin',async()=>{
  const f=fixture(),a=f.adapter();
  for(const action of ['reserve','confirm_deposit','claim','cancel_expired']){
    const signed=await a.prepare('evm',{...f.q,action,depositSignature:'1'.repeat(64)});
    const tx=parseTransaction(signed.raw),call=decodeFunctionData({abi,data:tx.data});
    assert.equal(tx.chainId,4663);assert.equal(tx.to.toLowerCase(),f.c.distributor.toLowerCase());assert.equal(tx.nonce,4);
    assert.equal(signed.hash,keccak256(signed.raw));assert.equal(await recoverTransactionAddress({serializedTransaction:signed.raw}),f.signers.evm.address);
    assert.equal(call.functionName,({reserve:'reserve',confirm_deposit:'confirmDeposit',claim:'claim',cancel_expired:'cancelExpired'})[action]);
  }
  await assert.rejects(a.prepare('evm',{...f.q,action:'withdraw'}),/Unsupported/);
  f.c.destinationAdmin=`0x${'99'.repeat(20)}`;assert.throws(()=>f.adapter(),/match/);
});
test('admin signs a constructed deposit while leaving owner signature empty',async()=>{
  const f=fixture(),spendable=[{address:f.q.sourceTokenAccount,owner:f.q.owner,mint:f.c.mint,amountRaw:f.q.amount,frozen:false}];
  const result=await f.adapter().partialDeposit(f.q,spendable);
  const tx=VersionedTransaction.deserialize(Buffer.from(result.transactionBase64,'base64'));
  assert.equal(tx.message.header.numRequiredSignatures,2);assert.ok(tx.signatures[0].every(x=>x===0));assert.ok(tx.signatures[1].some(x=>x!==0));
  assert.equal(tx.message.staticAccountKeys[0].toBase58(),f.q.owner);
  tx.sign([f.owner]);assert.ok(tx.signatures[0].some(x=>x!==0));
  f.sol.simulateTransaction=async()=>({value:{err:'test failure'}});
  await assert.rejects(f.adapter().partialDeposit(f.q,spendable),/simulation/);
});
test('fees, total operating budgets and settlement simulation stop signing',async()=>{
  const f=fixture();f.policy.maxFeePerGasWei='1';
  await assert.rejects(f.adapter().prepare('evm',{...f.q,action:'claim'}),/fee quote/);
  f.policy.maxFeePerGasWei='100';f.policy.maxTotalEvmFeeWei='1';
  await assert.rejects(f.adapter().prepare('evm',{...f.q,action:'claim'}),/budget/);
  const settlement={...f.q,action:'refund',destinationTransactionHash:`0x${'77'.repeat(32)}`};
  const signed=await f.adapter().prepare('solana',settlement);
  assert.ok(VersionedTransaction.deserialize(Buffer.from(signed.raw,'base64')).signatures[0].some(x=>x!==0));
  f.policy.maxSolanaTransactionCostLamports='1';await assert.rejects(f.adapter().prepare('solana',settlement),/cost/);
});
test('unpause signing is unavailable by default and opt-in activation stays bound to the campaign',async()=>{
 const f=fixture();await assert.rejects(f.adapter().prepare('evm',{action:'unpause'}),/Unsupported/);await assert.rejects(f.adapter().prepare('solana',{action:'unpause'}),/Unsupported/);
 const adapter=createLiveAdapter({config:f.c},{sol:f.sol,evm:f.evm,abi},f.policy,f.signers,f.journal,{allowUnpause:true});
 const raw=await adapter.prepare('evm',{action:'unpause'}),tx=parseTransaction(raw.raw),call=decodeFunctionData({abi,data:tx.data});assert.equal(call.functionName,'setPaused');assert.deepEqual(call.args,[false]);assert.equal(tx.to.toLowerCase(),f.c.distributor.toLowerCase());
 const signed=await adapter.prepare('solana',{action:'unpause'}),source=VersionedTransaction.deserialize(Buffer.from(signed.raw,'base64'));assert.ok(source.signatures[0].some(n=>n!==0));assert.equal(source.message.staticAccountKeys[0].toBase58(),f.c.admin);
});
