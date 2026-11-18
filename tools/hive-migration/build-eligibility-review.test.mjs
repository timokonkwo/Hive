import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibilityReview} from './build-eligibility-review.mjs';
const rows=JSON.parse(readFileSync(new URL('../../data/hive-reimbursement-snapshot.json',import.meta.url))).holders.map(h=>({...h,ownerOnCurve:h.kind==='wallet'}));
test('review preserves all frozen owners without approving or reallocating custody',()=>{
 const r=eligibilityReview(rows);
 assert.equal(r.budgetNewRaw,'10000000000000000000000000');
 assert.equal(r.rows.length,248);assert.equal(r.groups.signing_wallet_candidate.count,231);assert.equal(r.groups.custody_review.count,16);assert.equal(r.groups.pool.count,1);
 assert.ok(r.rows.every(h=>h.eligible===null&&h.reviewNote===''));
 assert.equal(r.candidateOldRaw,'582229876983614953');
 assert.equal(BigInt(r.groups.signing_wallet_candidate.draftNewRaw)+BigInt(r.groups.custody_review.draftNewRaw)+BigInt(r.roundingRemainderRaw),BigInt(r.budgetNewRaw));
 assert.equal(r.rows.find(h=>h.category==='pool').draftNewRaw,null);assert.equal(r.walletOnlySensitivity.selected,false);
});
test('review rejects duplicate owners and inconsistent classification',()=>{
 assert.throws(()=>eligibilityReview([...rows,rows[0]]),/duplicate/);
 assert.throws(()=>eligibilityReview(rows.map((r,i)=>i===0?{...r,ownerOnCurve:true}:r)),/classification/);
});
