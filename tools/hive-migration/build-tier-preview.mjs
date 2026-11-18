import {readFile,writeFile} from 'node:fs/promises';
import {bands,tierFor} from './tier-model.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/'):new URL('./local/snapshot-2026-09-21T09-43-40.282Z/',import.meta.url);
const snapshot=JSON.parse(await readFile(new URL('summary.json',dir)));
const holders=JSON.parse(await readFile(new URL('holders.json',dir)));
const poolOwner='HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC';
const rows=holders.map(h=>{
 const b=tierFor(BigInt(h.amountRaw));
 const pool=h.owner===poolOwner;
 return {solanaOwner:h.owner,oldAmount:h.amount,oldAmountRaw:h.amountRaw,tier:b.id,
  draftGrantTokens:pool?0n:b.grantTokens,draftGrantRaw:pool?0n:b.grantTokens*10n**18n,
  status:pool?'pool-authority-no-direct-grant':h.ownerOnCurve?'pending-owner-and-eligibility-review':'manual-program-custody-review',
  eligible:null,robinhoodAddress:null,paymentApproved:false};
});
const totals=bands.map(b=>{const matching=rows.filter(r=>r.tier===b.id&&r.status!=='pool-authority-no-direct-grant');return {tier:b.label,grantTokens:b.grantTokens,ownerCount:matching.length,manualReviewCount:matching.filter(r=>r.status==='manual-program-custody-review').length,subtotalTokens:b.grantTokens*BigInt(matching.length)}});
const base=totals.reduce((n,t)=>n+t.subtotalTokens,0n);
const summary={draftOnly:true,method:'Fixed grant per holding-size tier; not proportional to wallet balance',sourceSnapshotSlot:snapshot.snapshotSlot,
 excludedDirectPoolOwners:rows.filter(r=>r.status==='pool-authority-no-direct-grant').length,potentialOtherOwners:rows.filter(r=>r.status!=='pool-authority-no-direct-grant').length,manualProgramOwners:rows.filter(r=>r.status==='manual-program-custody-review').length,tiers:totals,
 illustrativeTotalTokens:base,illustrativeSupplyPercent:Number(base)/10000000,
 alternativeTotals:{halfEachGrant:base/2n,doubleEachGrant:base*2n},
 fundingApproved:false,cutoffApproved:false,stakingClaimsIncluded:false,
 caveats:['Amounts are illustrative and require a total-budget decision.','Candidate owners include unresolved program owners and any unidentified team/custody addresses. No owner is approved for payment.','The dust tier is a nominal goodwill grant; eligibility floor and anti-duplicate rules require explicit approval.','Unresolved staking claims may change tiers/add beneficiaries; they are not added here.']};
const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n';
for(const [name,value] of Object.entries({'tier-preview.json':rows,'tier-summary.json':summary}))await writeFile(new URL(name,dir),json(value),{flag:'wx',mode:0o600});
await writeFile(new URL('tier-preview.csv',dir),['solana_owner,old_amount,tier,draft_new_hive,status,eligible,robinhood_address,payment_approved',...rows.map(r=>[r.solanaOwner,r.oldAmount,r.tier,r.draftGrantTokens,r.status,'','','false'].join(','))].join('\n')+'\n',{flag:'wx',mode:0o600});
console.log(json(summary));
