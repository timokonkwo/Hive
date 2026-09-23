import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addresses, claimId, hex, snapshotTree, snapshotLeaf, verifyProof, integer, depositInstruction, initializeInstruction, settleInstruction, decodeClaim,depositFromAccounts,settlementInstructions,unsignedTransaction} from './client.mjs';
const f=JSON.parse(readFileSync(new URL('./test-vectors.json',import.meta.url)));
test('all frozen Merkle proofs verify including odd leaf duplication',()=>{
  for(const h of f.holders) assert.ok(verifyProof(snapshotLeaf(f.config.campaignId,f.config.mint,h.owner,h.amountRaw),h.proof,f.config.root));
  const tree=snapshotTree(f.config.campaignId,f.config.mint,[...f.holders].reverse());
  assert.equal(tree.root,f.config.root);
  const h=f.holders[0];assert.equal(verifyProof(snapshotLeaf(f.config.campaignId,f.config.mint,h.owner,(BigInt(h.amountRaw)+1n).toString()),h.proof,f.config.root),false);
  assert.throws(()=>snapshotTree(f.config.campaignId,f.config.mint,[h,h]),/Duplicate/);
});
test('program and administrator bind PDA; owner binds unique claim ID',()=>{
  const p=addresses(f.config.program,f.config.admin,f.config.campaignId,f.quote.owner);
  assert.equal(p.campaign.toBase58(),f.campaign);assert.equal(p.claim.toBase58(),f.claim);
  assert.equal(hex(claimId(p.campaign,f.quote.owner)),f.claimId);
  assert.notEqual(addresses(f.config.program,f.config.collection,f.config.campaignId).campaign.toBase58(),f.campaign);
});
test('unsigned Borsh instruction encoding remains stable across implementations',()=>{
  assert.equal(hex(initializeInstruction(f.config).data),f.initializeHex);
  const ix=depositInstruction(f.config,f.quote);
  assert.equal(hex(ix.data),f.depositHex);
  assert.equal(ix.keys.filter(k=>k.isSigner).length,2);
  assert.throws(()=>depositInstruction(f.config,{...f.quote,amount:'2000000000001'}),/cap/);
});
test('exact integer widths and settlement evidence reject ambiguous values',()=>{
  assert.throws(()=>integer(1000,8),/bigint/);
  assert.throws(()=>integer(2n**64n,8),/range/);
  assert.throws(()=>integer('-1',8));
  assert.equal(integer(999960398822814692n,8,true).readBigUInt64BE(),999960398822814692n);
  assert.throws(()=>settleInstruction(f.config,f.quote.owner,f.config.collection,false,Buffer.alloc(32)),/evidence/);
  assert.throws(()=>decodeClaim(Buffer.from([2,0])),/Truncated/);
});
test('multiple accounts consolidate only shortfall and fail before deposit if insufficient',()=>{
  const accounts=[{address:f.quote.sourceTokenAccount,owner:f.quote.owner,mint:f.config.mint,amountRaw:'1000000000000',frozen:false},{address:f.config.collection,owner:f.quote.owner,mint:f.config.mint,amountRaw:'1500000000000',frozen:false}];
  const instructions=depositFromAccounts(f.config,f.quote,accounts);
  assert.equal(instructions.length,2);
  assert.equal(instructions[0].data.readBigUInt64LE(1),1000000000000n);
  assert.equal(hex(instructions[1].data),f.depositHex);
  assert.throws(()=>depositFromAccounts(f.config,f.quote,accounts.slice(0,1)),/Insufficient/);
  assert.throws(()=>depositFromAccounts(f.config,f.quote,[accounts[0],{...accounts[1],frozen:true}]),/spendable/);
  assert.equal(settlementInstructions(f.config,f.quote.owner,false,Buffer.alloc(32,1),f.config.admin).length,2);
});
test('unsigned export retains all required signers without signing',()=>{
  const ix=depositInstruction(f.config,f.quote);
  const transaction=unsignedTransaction([ix],f.quote.owner,f.config.program);
  assert.equal(transaction.signatures.length,2);
  assert.ok(transaction.signatures.every(s=>s.every(b=>b===0)));
  assert.ok(transaction.serialize().length<=1232);
});

test('proportional campaign decoding preserves exact terms and rejects old layouts',async()=>{
  const {decodeCampaign,grantForDeposit}=await import('./client.mjs');
  const {PublicKey}=await import('@solana/web3.js');
  const c=f.config;
  // Account layout is independently assembled in Borsh field order.
  const payload=Buffer.concat([Buffer.from([1]),Buffer.from(c.campaignId.slice(2),'hex'),new PublicKey(c.admin).toBuffer(),new PublicKey(c.collection).toBuffer(),new PublicKey(c.mint).toBuffer(),Buffer.from(c.root.slice(2),'hex'),integer(c.destinationChain,8),Buffer.from(c.distributor.slice(2),'hex'),integer(c.opensAt,8),integer(c.closesAt,8),integer(c.claimGrace,8),integer(c.totalEligibleOldRaw,8),integer(c.fundingBudgetRaw,16),Buffer.from([1]),integer(c.minimumCurrentHoldingRaw??'0',8),Buffer.from([1,254,253])]);
  const decoded=decodeCampaign(payload);
  assert.equal(decoded.totalEligibleOldRaw,c.totalEligibleOldRaw);assert.equal(decoded.fundingBudgetRaw,c.fundingBudgetRaw);
  assert.equal(decoded.allowPartialSurrender,true);assert.equal(decoded.paused,true);
  assert.equal(decoded.minimumCurrentHoldingRaw,'0');
  assert.throws(()=>decodeCampaign(payload.subarray(0,payload.length-8)),/Truncated/);
  assert.equal(grantForDeposit(c,f.quote.amount,f.quote.snapshotAmount),f.grantRaw);
  assert.throws(()=>decodeCampaign(Buffer.concat([payload,Buffer.alloc(119)])),/length/);
  const invalid=Buffer.from(payload);invalid[invalid.length-12]=2;
  assert.throws(()=>decodeCampaign(invalid),/boolean/);
  assert.throws(()=>grantForDeposit({...c,allowPartialSurrender:false},'1',f.quote.snapshotAmount),/Full snapshot/);
  assert.throws(()=>grantForDeposit({...c,fundingBudgetRaw:'1'},'1',f.quote.snapshotAmount),/zero allocation/);
});
test('deposit consolidates the current holding minimum even for a smaller partial surrender',async()=>{
 const {depositFromAccounts}=await import('./client.mjs');
 const c={...f.config,minimumCurrentHoldingRaw:'1000000000000'};
 const accounts=[{address:f.quote.sourceTokenAccount,owner:f.quote.owner,mint:c.mint,frozen:false,amountRaw:'600000000000'},{address:c.collection,owner:f.quote.owner,mint:c.mint,frozen:false,amountRaw:'400000000000'}];
 const q={...f.quote,amount:'1'};
 const instructions=depositFromAccounts(c,q,accounts);
 assert.equal(instructions.length,2);
 assert.equal(instructions[0].data.readBigUInt64LE(1),400000000000n);
 assert.throws(()=>depositFromAccounts(c,q,[accounts[0],{...accounts[1],amountRaw:'399999999999'}]),/Insufficient/);
});
