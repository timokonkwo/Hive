// Read-only full SPL-token account census; no wallet keys, signing, or transfers.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,unpackAccount,unpackMint} from '@solana/spl-token';
const mint='6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n';
const hash=s=>createHash('sha256').update(s).digest('hex');
function decimal(n,d){const s=n.toString().padStart(d+1,'0');return d?`${s.slice(0,-d)}.${s.slice(-d)}`:s}
try {
 const endpoint=process.env.SOLANA_RPC_URL?.trim();assert(endpoint,'SOLANA_RPC_URL required locally');
 const rpc=async(method,params)=>{
   let response;try{response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(60000)});}catch{throw new Error(`${method}: RPC network request failed (endpoint withheld)`)}
   assert(response.ok,`${method}: HTTP ${response.status}`);
   const body=await response.json();assert(!body.error,`${method}: RPC error ${body.error?.code}; ${String(body.error?.message??'').replaceAll(endpoint,'[RPC]').slice(0,350)}`);
   assert(body.result!==undefined,`${method}: missing result`);return body.result;
 };
 const accountInfo=a=>({...a,owner:new PublicKey(a.owner),data:Buffer.from(a.data[0],'base64')});
 const before=await rpc('getAccountInfo',[mint,{encoding:'base64',commitment:'finalized'}]);
 assert(before.value,'Mint not found');assert(before.value.owner===TOKEN_PROGRAM_ID.toBase58(),'Nonstandard token program: stop for extension-aware snapshot review');
 const m=unpackMint(new PublicKey(mint),accountInfo(before.value),TOKEN_PROGRAM_ID);
 assert(m.isInitialized,'Mint is not initialized');
 const genesisHash=await rpc('getGenesisHash',[]);
 assert(genesisHash==='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','RPC is not Solana mainnet');
 const dir=new URL(`./local/snapshot-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url);
 await mkdir(dir,{recursive:true,mode:0o700});
 const save=async(name,value)=>{const body=typeof value==='string'?value:stringify(value);await writeFile(new URL(name,dir),body,{flag:'wx',mode:0o600});return hash(body)};
 await save('mint-before.json',before);
 console.log(stringify({phase:'mint-verified',mint,decimals:m.decimals,supply:decimal(m.supply,m.decimals),mintAuthority:m.mintAuthority?.toBase58()??null,freezeAuthority:m.freezeAuthority?.toBase58()??null,directory:dir.pathname}));
 const accounts=await rpc('getProgramAccounts',[TOKEN_PROGRAM_ID.toBase58(),{encoding:'base64',commitment:'finalized',withContext:true,minContextSlot:before.context.slot,filters:[{dataSize:165},{memcmp:{offset:0,bytes:mint}}]}]);
 assert(Number.isSafeInteger(accounts.context?.slot)&&Array.isArray(accounts.value),'Missing atomic context or account array');
 const rawHash=await save('token-accounts.raw.json',accounts);
 const slot=accounts.context.slot;
 const after=await rpc('getAccountInfo',[mint,{encoding:'base64',commitment:'finalized',minContextSlot:slot}]);
 await save('mint-after.json',after);
 assert(before.value.data[0]===after.value?.data?.[0],'Mint changed during snapshot; retain raw evidence and review before eligibility');
 const seen=new Set(),owners=new Map(),rows=[];
 let sum=0n;
 for(const a of accounts.value){
   assert(!seen.has(a.pubkey),'Duplicate token account');seen.add(a.pubkey);
   const t=unpackAccount(new PublicKey(a.pubkey),accountInfo(a.account),TOKEN_PROGRAM_ID);
   assert(t.mint.toBase58()===mint&&t.isInitialized,'Wrong mint/uninitialized account');
   const owner=t.owner.toBase58();sum+=t.amount;
   rows.push({tokenAccount:a.pubkey,owner,amountRaw:t.amount,amount:decimal(t.amount,m.decimals),frozen:t.isFrozen,delegate:t.delegate?.toBase58()??null,delegatedAmountRaw:t.delegatedAmount,closeAuthority:t.closeAuthority?.toBase58()??null});
   if(t.amount===0n)continue;
   const aggregate=owners.get(owner)??{owner,amountRaw:0n,tokenAccounts:[],frozenAmountRaw:0n,ownerOnCurve:PublicKey.isOnCurve(t.owner.toBytes())};
   aggregate.amountRaw+=t.amount;aggregate.tokenAccounts.push(a.pubkey);if(t.isFrozen)aggregate.frozenAmountRaw+=t.amount;owners.set(owner,aggregate);
 }
 assert(sum===m.supply,`Supply mismatch: account sum ${sum} vs mint supply ${m.supply}. Do not use this census for payment.`);
 const holders=[...owners.values()].sort((a,b)=>a.amountRaw>b.amountRaw?-1:a.amountRaw<b.amountRaw?1:a.owner.localeCompare(b.owner)).map((h,i)=>({...h,rank:i+1,amount:decimal(h.amountRaw,m.decimals),supplyPercent:decimal(h.amountRaw*100000000n/m.supply,6),classification:'unreviewed',eligible:null,robinhoodAddress:null}));
 const holderHash=await save('holders.json',holders);
 await save('token-accounts.json',rows);
 const csv=['rank,solana_owner,amount_raw,amount,supply_percent,token_account_count,frozen_amount_raw,owner_on_curve,classification,eligible,robinhood_address',...holders.map(h=>[h.rank,h.owner,h.amountRaw,h.amount,h.supplyPercent,h.tokenAccounts.length,h.frozenAmountRaw,h.ownerOnCurve,'unreviewed','',''].join(','))].join('\n')+'\n';
 const csvHash=await save('holders.csv',csv);
 await save('classification-review.csv',['solana_owner,amount,classification,eligibility_decision,evidence,notes',...holders.map(h=>`${h.owner},${h.amount},unreviewed,,,`)].join('\n')+'\n');
 let block=null,blockTime=null,blockLookupError=null;
 try {block=await rpc('getBlock',[slot,{commitment:'finalized',transactionDetails:'none',rewards:false,maxSupportedTransactionVersion:0}]);blockTime=block?.blockTime??null;await save('block.json',block);}catch(error){blockLookupError=error.message;try{blockTime=await rpc('getBlockTime',[slot]);}catch{}}
 const summary={createdAt:new Date().toISOString(),mint,genesisHash,tokenProgram:TOKEN_PROGRAM_ID.toBase58(),decimals:m.decimals,supplyRaw:m.supply,supply:decimal(m.supply,m.decimals),mintAuthority:m.mintAuthority?.toBase58()??null,freezeAuthority:m.freezeAuthority?.toBase58()??null,
   commitment:'finalized',snapshotSlot:slot,blockhash:block?.blockhash??null,snapshotTime:blockTime?new Date(blockTime*1000).toISOString():null,blockLookupError,
   mintBeforeSlot:before.context.slot,mintAfterSlot:after.context.slot,tokenAccountCount:rows.length,nonzeroTokenAccountCount:rows.filter(r=>r.amountRaw>0n).length,nonzeroOwnerCount:holders.length,offCurveOwnerCount:holders.filter(h=>!h.ownerOnCurve).length,
   accountSumRaw:sum,supplyReconciled:true,allHolderClassificationsPending:true,eligibilityCutoffApproved:false,payoutsAuthorized:false,
   sha256:{'token-accounts.raw.json':rawHash,'holders.json':holderHash,'holders.csv':csvHash},
   limitations:['Full raw account census includes pools, program vaults, custodians, treasury and dust; these are not automatically eligible people.','Owner balances aggregate every token account for this mint. On-curve/off-curve is a technical flag, not a final classification.','Finalized GPA context identifies the snapshot slot; minContextSlot is a lower bound, not historical-state selection. Mint was unchanged before/after and account sum reconciled to supply.','Candidate current snapshot; cutoff and reimbursement policy still require user decisions.']};
 await save('summary.json',summary);
 console.log(stringify({directory:dir.pathname,...summary,top10:holders.slice(0,10)}));
}catch(error){console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1}
