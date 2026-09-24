import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {grantForDeposit,initializeInstruction,depositInstruction,exceptionTerms,reviewedHolder,openingFor} from './client.mjs';
import {registrationMessage,registrationTerms} from './registration.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const template=read('./test-vectors.json'), supplemental=read('../../../data/hive-claim-supplemental.json'),allocation=read('../../../data/hive-claim-allocation.json');
const c={...template.config,opensAt:'200',totalEligibleOldRaw:allocation.totalEligibleOldRaw,fundingBudgetRaw:allocation.budgetNewRaw,minimumCurrentHoldingRaw:'1000000000000000',exceptionOwner:supplemental.owner,exceptionAllowanceRaw:supplemental.allowanceRaw,exceptionGrantRaw:supplemental.grantRaw,exceptionOpensAt:'100'};
const review={config:c,tree:{holders:template.holders}};
const request={owner:supplemental.owner,recipient:template.quote.recipient,amount:supplemental.allowanceRaw,depositDeadline:'1000',nonce:'0x'+'11'.repeat(32)};
test('supplemental award leaves all 72 ordinary allocations byte-exact',()=>{
 assert.equal(allocation.rows.length,72);
 for(const h of allocation.rows){const amount=h.oldRaw??h.amountRaw;assert.equal(grantForDeposit(c,amount,amount,h.owner),h.allocationNewRaw);}
 assert.equal((BigInt(c.fundingBudgetRaw)+BigInt(c.exceptionGrantRaw)).toString(),supplemental.totalFundingRequiredRaw);
 assert.equal(grantForDeposit(c,supplemental.allowanceRaw,supplemental.allowanceRaw,supplemental.owner),supplemental.grantRaw);
});
test('supplemental approval never creates a frozen snapshot entry or modifies its proof tree',()=>{
 const snapshot=read('../../../data/hive-reimbursement-snapshot.json');assert.equal(snapshot.holders.some(h=>h.owner===supplemental.owner),false);
 const h=reviewedHolder(review,supplemental.owner);assert.equal(h.basis,'supplemental_exception');assert.deepEqual(h.proof,[]);
 assert.equal(review.tree.holders.some(h=>h.owner===supplemental.owner),false);
 assert.equal(openingFor(c,supplemental.owner),'100');assert.equal(openingFor(c,template.quote.owner),'200');
});
test('supplemental partial amounts floor exactly and reject altered allowance or omitted owner',()=>{
 const amount=1000000000000000n;assert.equal(grantForDeposit(c,amount.toString(),supplemental.allowanceRaw,supplemental.owner),(amount*BigInt(supplemental.grantRaw)/BigInt(supplemental.allowanceRaw)).toString());
 assert.throws(()=>grantForDeposit(c,'1',supplemental.allowanceRaw),/Owner required/);
 assert.throws(()=>grantForDeposit(c,'1','1507505338430268',supplemental.owner),/mismatch/);
 assert.throws(()=>grantForDeposit({...c,exceptionGrantRaw:'9999999999999999999999999999'},'1',supplemental.allowanceRaw,supplemental.owner),/Invalid supplemental/);
});
test('supplemental signatures bind explicit exception basis, separate budget and exact allowance',()=>{
 const message=registrationMessage(review,request);assert.match(message,/authorization v6/);const terms=JSON.parse(message.split('\n')[1]);
 assert.equal(terms.eligibilityBasis,'explicit_supplemental_exception');assert.equal(terms.minimumSnapshotHoldingRaw,'0');assert.equal(terms.minimumCurrentHoldingRaw,'1000000000000000');
 assert.equal(terms.newGrantRaw,supplemental.grantRaw);assert.equal(terms.exceptionAllowanceRaw,supplemental.allowanceRaw);assert.equal(terms.fundingBudgetRaw,allocation.budgetNewRaw);
 assert.notEqual(registrationMessage({...review,config:{...c,exceptionGrantRaw:'99999000000000000000000'}},request),message);
});
test('supplemental deposit encoding requires its exact owner allowance and no fabricated proof',()=>{
 const q={...registrationTerms(review,request),sourceTokenAccount:template.quote.sourceTokenAccount};assert.ok(depositInstruction(c,q));
 assert.throws(()=>depositInstruction(c,{...q,proof:['0x'+'11'.repeat(32)]}),/proof/);
 const data=initializeInstruction(c).data;assert.equal(data.readBigUInt64LE(data.length-32),1507505338430267n);assert.equal(data.readBigUInt64LE(data.length-24)+(data.readBigUInt64LE(data.length-16)<<64n),100000000000000000000000n);assert.equal(data.readBigUInt64LE(data.length-8),100n);
});
