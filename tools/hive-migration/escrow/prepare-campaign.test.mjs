import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Keypair} from '@solana/web3.js';import {validateCampaign} from './prepare-campaign.mjs';
const draft=JSON.parse(readFileSync(new URL('./campaign.inputs.json',import.meta.url)));
const owner=Keypair.fromSeed(Buffer.alloc(32,42)).publicKey.toBase58();
const snapshot=[{owner,amountRaw:'2000000000000000'}];
const reviewed=[{...snapshot[0],eligible:true,reviewNote:'Test fixture only'}];
const example=()=>({...draft,exceptionOwner:'11111111111111111111111111111111',exceptionAllowanceRaw:'0',exceptionGrantRaw:'0',exceptionOpensAt:'0',totalEligibleOldRaw:null,allowPartialSurrender:false,classificationsApproved:true,grantAmountsApproved:true,terminalAttemptPolicyApproved:true,campaignId:`0x${'12'.repeat(32)}`,program:owner,admin:owner,distributor:`0x${'11'.repeat(20)}`,destinationAdmin:`0x${'22'.repeat(20)}`,opensAt:'100',closesAt:null,claimGrace:'3600',fundingBudgetRaw:'600000000000000000000'});
test('claim window derives seven days from opening and rejects conflicting deadlines',()=>{
 const result=validateCampaign(example(),snapshot,reviewed);
 assert.equal(result.config.closesAt,'604900');
 assert.equal(validateCampaign({...example(),closesAt:'604900'},snapshot,reviewed).config.closesAt,'604900');
 for(const closesAt of ['604899','604901'])assert.throws(()=>validateCampaign({...example(),closesAt},snapshot,reviewed),/seven days/);
 assert.throws(()=>validateCampaign({...example(),claimWindowSeconds:'86400'},snapshot,reviewed),/seven days/);
 assert.throws(()=>validateCampaign({...example(),opensAt:null},snapshot,reviewed));
 assert.throws(()=>validateCampaign({...example(),opensAt:'18446744073709551615'},snapshot,reviewed));
});
test('draft settings never produce launchable artifacts',()=>{
  assert.throws(()=>validateCampaign(draft,snapshot,reviewed),/explicit decision/);
  const c=example(); c.fundingBudgetRaw='0';
  assert.throws(()=>validateCampaign(c,snapshot,reviewed),/positive/);
});
test('frozen eligibility cannot be increased or silently selected',()=>{
  assert.throws(()=>validateCampaign(example(),snapshot,[{...reviewed[0],amountRaw:'999999999999999'}]),/minimum/);
  assert.throws(()=>validateCampaign(example(),snapshot,[{...reviewed[0],amountRaw:'2000000000000001'}]),/snapshot/);
  assert.throws(()=>validateCampaign(example(),snapshot,[{...reviewed[0],eligible:null}]),/Unreviewed/);
  assert.throws(()=>validateCampaign(example(),snapshot,[...reviewed,...reviewed]),/Duplicate/);
  assert.throws(()=>validateCampaign({...example(),snapshotSlot:449018303},snapshot,reviewed),/cutoff/);
});
test('reviewed schedule reserves the exact maximum grant liability',()=>{
  const result=validateCampaign(example(),snapshot,reviewed);
  assert.equal(result.maximumGrantLiabilityRaw,'600000000000000000000');
  assert.equal(result.tree.holders.length,1);assert.match(result.config.root,/^0x[0-9a-f]{64}$/);
});

test('proportional preparation rejects stale tiers, denominator mismatch and undecided deposit policy',()=>{
  assert.throws(()=>validateCampaign({...example(),minimums:['1']},snapshot,reviewed),/Legacy tier/);
  assert.throws(()=>validateCampaign({...example(),totalEligibleOldRaw:'1'},snapshot,reviewed),/denominator/);
  assert.throws(()=>validateCampaign({...example(),allowPartialSurrender:null},snapshot,reviewed),/partial-surrender/);
  const result=validateCampaign(example(),snapshot,reviewed);
  assert.equal(result.config.totalEligibleOldRaw,'2000000000000000');
  assert.equal(result.config.allowPartialSurrender,false);
});
test('high budgets never override the 70 percent per-owner ceiling',()=>{
  const r=validateCampaign({...example(),fundingBudgetRaw:'7000000000000000000000000'},snapshot,reviewed);
  assert.equal(r.maximumGrantLiabilityRaw,'1400000000000000000000000');
});

test('supplemental production exception adds liability without changing ordinary proofs or denominator',()=>{
 const c={...example(),exceptionOwner:draft.exceptionOwner,exceptionAllowanceRaw:draft.exceptionAllowanceRaw,exceptionGrantRaw:draft.exceptionGrantRaw,exceptionOpensAt:'0',supplementalGrantApproved:true};
 const original=validateCampaign(example(),snapshot,reviewed),result=validateCampaign(c,snapshot,reviewed);
 assert.equal(result.config.root,original.config.root);assert.equal(result.config.totalEligibleOldRaw,original.config.totalEligibleOldRaw);
 assert.equal(result.ordinaryGrantLiabilityRaw,original.maximumGrantLiabilityRaw);
 assert.equal(BigInt(result.maximumGrantLiabilityRaw)-BigInt(original.maximumGrantLiabilityRaw),100000000000000000000000n);
 assert.throws(()=>validateCampaign({...c,supplementalGrantApproved:false},snapshot,reviewed),/explicitly approved/);
 assert.throws(()=>validateCampaign({...c,exceptionOwner:owner},snapshot,reviewed),/separate/);
});
