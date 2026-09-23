// Read-only pool/custody classification evidence. Does not change snapshot eligibility.
import {readFile,writeFile} from 'node:fs/promises';
import {Connection,PublicKey} from '@solana/web3.js';
import {CpAmm,CP_AMM_PROGRAM_ID} from '@meteora-ag/cp-amm-sdk';
import {MongoClient} from 'mongodb';
const dir=new URL('./local/snapshot-2026-09-21T09-43-40.282Z/',import.meta.url);
const load=async name=>JSON.parse(await readFile(new URL(name,dir)));
const save=async(name,value)=>writeFile(new URL(name,dir),JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{flag:'wx',mode:0o600});
const holders=await load('holders.json'),snapshot=await load('summary.json');
const report={checkedAt:new Date().toISOString(),snapshotSlot:snapshot.snapshotSlot,pool:null,treasury:null,staking:null,errors:[]};
const endpoint=process.env.SOLANA_RPC_URL?.trim();
const client=new Connection(endpoint,'finalized');
const poolAddress='9ApyYn9ex9pHUMdr7k5B4qRHQsv48ijGuT7nh3Ekpaqg';
try {
 const account=await client.getAccountInfo(new PublicKey(poolAddress),'finalized');
 if(!account?.owner.equals(CP_AMM_PROGRAM_ID))throw Error('Pool not owned by expected DAMM v2 program');
 const cp=new CpAmm(client),state=await cp.fetchPoolState(new PublicKey(poolAddress));
 const fields=Object.fromEntries(Object.entries(state).filter(([k,v])=>/mint|vault|authority/i.test(k)&&v?.toBase58).map(([k,v])=>[k,v.toBase58()]));
 const tokenAccounts=await load('token-accounts.json');
 const matches=tokenAccounts.filter(a=>Object.entries(fields).some(([k,v])=>/vault/i.test(k)&&v===a.tokenAccount));
 if(!matches.length)throw Error('No snapshot token account matched decoded pool vaults');
 report.pool={poolAddress,program:account.owner.toBase58(),fields,matchedSnapshotAccounts:matches,
  qualification:'Pool state decoded after snapshot; immutable vault identity matched against snapshot token-account data. Do not pay the pool authority as an individual; LP beneficial claims need separate policy.'};
}catch(error){report.errors.push({stage:'pool',error:typeof error.message==='string'&&error.message.includes(endpoint)?'RPC request failed (endpoint withheld)':String(error.message).slice(0,250)})}
const treasury=process.env.HIVE_TREASURY_WALLET||'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';
report.treasury={configuredAddress:treasury,holder:holders.find(h=>h.owner===treasury)??null,qualification:'Local environment treasury address; confirm it matches the production staking treasury before assigning beneficial claims.'};
if(process.env.MONGODB_URI){
 const dbClient=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:12000,connectTimeoutMS:12000});
 try {
   await dbClient.connect();
   const db=dbClient.db('hive');
   const stakes=await db.collection('stakes').find({$or:[{activeAmount:{$gt:0}},{lockedAmount:{$gt:0}}]},
    {projection:{_id:0,solanaAddress:1,activeAmount:1,lockedAmount:1,pendingUnstakes:1,updatedAt:1}}).toArray();
   const activeOrLocked=stakes.map(s=>({solanaAddress:s.solanaAddress??null,activeAmount:s.activeAmount??0,lockedAmount:s.lockedAmount??0,updatedAt:s.updatedAt??null,
     pendingUnstakes:(s.pendingUnstakes??[]).filter(p=>p.status!=='claimed').map(p=>({amount:p.amount,status:p.status,claimTxSignature:p.claimTxSignature??null}))}));
   report.staking={checkedAt:new Date().toISOString(),activeOrLockedRecordCount:stakes.length,records:activeOrLocked,
     qualification:'Read-only current database records, not a historical ledger at the Solana snapshot slot. Do not add these amounts to eligibility until transaction/custody reconciliation and production-environment confirmation.'};
 }catch{report.errors.push({stage:'staking',error:'Read-only database lookup failed; credentials withheld'})}finally{await dbClient.close()}
}
const filename=`custody-review-${Date.now()}.json`;
await save(filename,report);
console.log(JSON.stringify({filename,...report},null,2));
