// Read-only eligibility observation; never modifies the frozen tree or fixes a live denominator.
import {readFileSync,writeFileSync} from 'node:fs';
import {PublicKey} from '@solana/web3.js';
const snapshot=JSON.parse(readFileSync(new URL('../../data/hive-reimbursement-snapshot.json',import.meta.url)));
const minimum=1000000000000000n;
async function rpc(method,params){const r=await fetch(process.env.SOLANA_RPC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const d=await r.json();if(d.error||d.result==null)throw Error();return d.result;}
try{
 if(await rpc('getGenesisHash',[])!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error();
 const data=await rpc('getProgramAccounts',['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',{encoding:'base64',commitment:'finalized',withContext:true,minContextSlot:snapshot.slot,filters:[{dataSize:165},{memcmp:{offset:0,bytes:snapshot.sourceMint}}]}]);
 if(!Number.isSafeInteger(data.context?.slot)||data.context.slot<snapshot.slot||!Array.isArray(data.value))throw Error();
 const balances=new Map(),seen=new Set();
 for(const row of data.value){const b=Buffer.from(row.account.data[0],'base64');if(seen.has(row.pubkey)||row.account.owner!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'||b.length!==165||new PublicKey(b.subarray(0,32)).toBase58()!==snapshot.sourceMint||![1,2].includes(b[108]))throw Error();seen.add(row.pubkey);if(b[108]!==1)continue;const owner=new PublicKey(b.subarray(32,64)).toBase58();balances.set(owner,(balances.get(owner)??0n)+b.readBigUInt64LE(64));}
 const wallets=snapshot.holders.filter(h=>h.kind==='wallet');
 const rows=wallets.map(h=>({owner:h.owner,snapshotRaw:h.amountRaw,currentSpendableRaw:(balances.get(h.owner)??0n).toString(),meetsCurrentMinimum:(balances.get(h.owner)??0n)>=minimum,meetsBothMinimums:BigInt(h.amountRaw)>=minimum&&(balances.get(h.owner)??0n)>=minimum}));
 const report={checkedAt:new Date().toISOString(),snapshotSlot:snapshot.slot,currentSlot:data.context.slot,budgetNewRaw:'10000000000000000000000000',minimumCurrentOldRaw:minimum.toString(),snapshotWallets:wallets.length,snapshotWalletsAtLeast1M:wallets.filter(h=>BigInt(h.amountRaw)>=minimum).length,snapshotWalletsBelow1Token:wallets.filter(h=>BigInt(h.amountRaw)<1000000000n).length,currentQualifyingSnapshotWallets:rows.filter(h=>h.meetsCurrentMinimum).length,currentQualifyingBothMinimums:rows.filter(h=>h.meetsBothMinimums).length,currentBelowMinimum:rows.filter(h=>!h.meetsCurrentMinimum).length,qualification:'Current observation only. At least 1M at snapshot AND at least 1M currently are required. Recheck before deposit. Custody remains unresolved. No denominator or funding approval inferred.',rows};
 const path=new URL('./local/current-qualification-'+data.context.slot+'.json',import.meta.url);writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...report,rows:undefined},null,2));
}catch{console.error('Current qualification read failed; no eligibility changed.');process.exitCode=1;}
