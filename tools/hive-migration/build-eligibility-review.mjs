// Frozen evidence only. Produces a review worksheet, never an approved campaign tree.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PublicKey} from '@solana/web3.js';
import {proportionalAllocation} from './proportional-model.mjs';
const POOL='HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
const HASH='cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa';
const BUDGET=10000000n*10n**18n;
export function eligibilityReview(holders) {
  const seen=new Set();
  const rows=holders.map(h=>{
    const owner=new PublicKey(h.owner).toBase58();
    if(owner!==h.owner||seen.has(owner)||typeof h.amountRaw!=='string'||!/^[1-9][0-9]*$/.test(h.amountRaw)||BigInt(h.amountRaw)>=2n**64n)throw Error('Invalid or duplicate snapshot owner');
    seen.add(owner);
    const onCurve=PublicKey.isOnCurve(new PublicKey(owner).toBytes());
    if(h.ownerOnCurve!==onCurve)throw Error('Snapshot curve classification mismatch');
    const category=owner===POOL?'pool':onCurve?'signing_wallet_candidate':'custody_review';
    return {owner,amountRaw:h.amountRaw,category,eligible:null,reviewNote:'',beneficiaryEvidence:null,draftNewRaw:null};
  });
  if(rows.filter(r=>r.category==='pool').length!==1)throw Error('Expected one known pool owner');
  const candidates=rows.filter(r=>r.category!=='pool');
  const all=proportionalAllocation(candidates.map(r=>({...r,amountRaw:BigInt(r.amountRaw)})),BUDGET);
  const quotes=new Map(all.rows.map(r=>[r.owner,r.allocationNewRaw.toString()]));
  for(const row of rows)row.draftNewRaw=quotes.get(row.owner)??null;
  const groups=Object.fromEntries(['signing_wallet_candidate','custody_review','pool'].map(category=>{
    const group=rows.filter(r=>r.category===category);
    return [category,{count:group.length,oldRaw:group.reduce((s,r)=>s+BigInt(r.amountRaw),0n).toString(),draftNewRaw:category==='pool'?null:group.reduce((s,r)=>s+BigInt(r.draftNewRaw),0n).toString()}];
  }));
  const wallets=candidates.filter(r=>r.category==='signing_wallet_candidate');
  const walletOnly=wallets.length?proportionalAllocation(wallets.map(r=>({...r,amountRaw:BigInt(r.amountRaw)})),BUDGET):null;
  return {draftOnly:true,eligibilityApproved:false,groups,candidateOldRaw:all.totalEligibleOldRaw.toString(),budgetNewRaw:BUDGET.toString(),roundingRemainderRaw:all.unallocatedNewRaw.toString(),walletOnlySensitivity:walletOnly?{selected:false,denominatorRaw:walletOnly.totalEligibleOldRaw.toString(),allocatedNewRaw:walletOnly.allocatedNewRaw.toString(),warning:'Sensitivity only. Allocating the whole budget to signing wallets would consume the custody share; no exclusion or reserve policy has been approved.'}:null,rows};
}
const json=value=>JSON.stringify(value,null,2)+'\n';
const exact=(raw,d)=>{const s=raw.padStart(d+1,'0');return s.slice(0,-d)+'.'+s.slice(-d);};
export function buildReview(out) {
  const bytes=readFileSync(new URL('./local/snapshot-2026-09-21T10-48-52.230Z/holders.json',import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==HASH)throw Error('Frozen snapshot hash mismatch');
  const review={snapshotSlot:449032979,snapshotAt:'2026-09-21T10:48:43.000Z',holdersSha256:HASH,...eligibilityReview(JSON.parse(bytes))};
  if(review.rows.length!==248||review.candidateOldRaw!=='582229876983614953')throw Error('Frozen population mismatch');
  mkdirSync(out); // Refuse overwrite of an earlier review or its decisions.
  writeFileSync(resolve(out,'review.json'),json(review),{flag:'wx'});
  const header='owner,category,snapshot_old_hive,draft_new_hive,eligible,review_note';
  const csv=rows=>[header,...rows.map(r=>[r.owner,r.category,exact(r.amountRaw,9),r.draftNewRaw===null?'':exact(r.draftNewRaw,18),'',''].join(','))].join('\n')+'\n';
  writeFileSync(resolve(out,'holders.csv'),csv(review.rows),{flag:'wx'});
  writeFileSync(resolve(out,'custody.csv'),csv(review.rows.filter(r=>r.category==='custody_review')),{flag:'wx'});
  writeFileSync(resolve(out,'summary.json'),json({...review,rows:undefined}),{flag:'wx'});
  return {...review,rows:undefined};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log(json(buildReview(resolve(process.argv[2]??'tools/hive-migration/local/eligibility-review-10m-v2'))));
}
