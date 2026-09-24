import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {Keypair} from '@solana/web3.js';
import {createObserver} from './observer.mjs';
import {addresses,snapshotTree,depositInstruction,unsignedTransaction} from './client.mjs';
const template=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
function fixture(){
  const config={...template.config,mint:'6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',destinationToken:'0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8'};
  const tree=snapshotTree(config.campaignId,config.mint,[{owner:template.quote.owner,amountRaw:template.quote.amount}]);config.root=tree.root;
  const q={...template.quote,proof:tree.holders[0].proof,claimId:`0x${'44'.repeat(32)}`,grant:'1000'};
  const review={config,deployment:{solanaProgramDataAddress:config.program,solanaProgramDataSha256:'11'.repeat(32),destinationRuntimeCodeHash:`0x${'22'.repeat(32)}`,destinationBlock:'1'}};
  return {config,q,review};
}
test('source evidence requires successful finalized exact deposit and vault increase',async()=>{
  const {config,q,review}=fixture(),p=addresses(config.program,config.admin,config.campaignId,q.owner);
  const tx=unsignedTransaction([depositInstruction(config,q)],q.owner,Keypair.fromSeed(Buffer.alloc(32,40)).publicKey.toBase58());
  const index=tx.message.staticAccountKeys.findIndex(k=>k.equals(p.vault));
  const balance=n=>[{accountIndex:index,mint:config.mint,uiTokenAmount:{amount:n}}];
  let response={slot:50,transaction:{message:tx.message},meta:{err:null,preTokenBalances:balance('0'),postTokenBalances:balance(q.amount)}};
  const sol={getTransaction:async(_,opts)=>{assert.equal(opts.commitment,'finalized');return response;}};
  const observer=createObserver(review,{}, {sol,evm:{}});
  assert.equal(await observer.depositEvidence(q,{sourceSlot:50},'test-signature'),'test-signature');
  response.meta.postTokenBalances=balance('1');await assert.rejects(observer.depositEvidence(q,{sourceSlot:50},'test-signature'),/No matching/);
  response.meta.postTokenBalances=balance(q.amount);response.slot=51;await assert.rejects(observer.depositEvidence(q,{sourceSlot:50},'test-signature'),/No matching/);
  response.slot=50;response.meta.err={InstructionError:[0,'test']};await assert.rejects(observer.depositEvidence(q,{sourceSlot:50},'test-signature'),/No matching/);
});
test('destination evidence rejects altered grants, failed receipts and noncanonical blocks',async()=>{
  const {q,review}=fixture(),hash=`0x${'66'.repeat(32)}`;
  let amount=1000n,success=true,canonical=hash;
  const evm={getLogs:async()=>[{args:{recipient:q.recipient,amount},transactionHash:hash,blockHash:hash}],getTransactionReceipt:async()=>({status:success?'success':'reverted',blockNumber:10n,blockHash:hash}),getBlock:async()=>({hash:canonical})};
  const observer=createObserver(review,{}, {sol:{},evm}),observed={destination:{status:3},destinationBlock:'10'};
  assert.equal(await observer.settlementEvidence(q,observed),hash);
  amount=1n;await assert.rejects(observer.settlementEvidence(q,observed),/grant/);
  amount=1000n;success=false;await assert.rejects(observer.settlementEvidence(q,observed),/canonical/);
  success=true;canonical=`0x${'77'.repeat(32)}`;await assert.rejects(observer.settlementEvidence(q,observed),/canonical/);
});
