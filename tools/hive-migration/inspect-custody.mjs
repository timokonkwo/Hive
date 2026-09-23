// Read-only, current account metadata. Never changes snapshot eligibility or balances.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const review=JSON.parse(readFileSync(new URL('./local/eligibility-review-v1/review.json',import.meta.url)));
const owners=review.rows.filter(r=>r.category==='custody_review');
if(!process.env.SOLANA_RPC_URL)throw Error('SOLANA_RPC_URL required');
async function rpc(method,params){
  const response=await fetch(process.env.SOLANA_RPC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('RPC request failed');
  const data=await response.json();if(data.error||data.result==null)throw Error('RPC result unavailable');return data.result;
}
try {
  if(await rpc('getGenesisHash',[])!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Wrong chain');
  const result=await rpc('getMultipleAccounts',[owners.map(r=>r.owner),{encoding:'base64',commitment:'finalized',minContextSlot:review.snapshotSlot,dataSlice:{offset:0,length:8}}]);
  if(!Number.isSafeInteger(result.context?.slot)||result.context.slot<review.snapshotSlot||!Array.isArray(result.value)||result.value.length!==owners.length)throw Error('Invalid metadata response');
  const cases=owners.map((h,i)=>{
    const account=result.value[i];
    if(account&&(typeof account.owner!=='string'||typeof account.executable!=='boolean'))throw Error('Invalid account metadata');
    return {owner:h.owner,snapshotOldRaw:h.amountRaw,provisionalNewRaw:h.draftNewRaw,currentAuthorityAccount:account?{exists:true,ownerProgram:account.owner,executable:account.executable,discriminatorBase64:account.data?.[0]??null}:{exists:false},eligibility:null,beneficiaries:[],evidenceRequired:['Identify the controlling program and verify the authority derivation or control mechanism.','Reconstruct beneficiary balances and custody backing at snapshot slot 449032979.','Reconcile overlap with direct holders, staking and LP claims.','Specify a separately reviewed deposit and ownership-proof path; V1 cannot accept an off-curve owner signature.']};
  });
  const output={checkedAt:new Date().toISOString(),observedSlot:result.context.slot,snapshotSlot:review.snapshotSlot,readOnly:true,historicalOwnershipProven:false,qualification:'Current account metadata is a lead only. An absent authority account does not mean its token holdings are zero or ineligible. No beneficiary or eligibility was inferred.',cases};
  const directory=resolve(process.argv[2]??'tools/hive-migration/local/custody-cases-v1');mkdirSync(directory);
  writeFileSync(resolve(directory,'cases.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({observedSlot:output.observedSlot,cases:cases.length,existingAuthorityAccounts:cases.filter(c=>c.currentAuthorityAccount.exists).length,ownerPrograms:[...new Set(cases.filter(c=>c.currentAuthorityAccount.exists).map(c=>c.currentAuthorityAccount.ownerProgram))],eligibilityApproved:false},null,2));
}catch{console.error('Custody metadata inspection failed; no eligibility changed. Check RPC availability and the output directory.');process.exitCode=1;}
