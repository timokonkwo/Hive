import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { policy, catalog } from '../scripts/tokenization/modules.mjs';
const load=(name,imports)=>loadTypeScript(new URL(name,import.meta.url),imports);
const association=load('../lib/agent-tokenization/association.ts',{'./policy':policy});
const {ponsAdminStats}=load('../lib/agent-tokenization/admin-stats.ts',{'./association':association,'./policy':policy});
const token={chainId:4663,address:'0x'+'1'.repeat(40),symbol:'SAGE',transactionHash:'0x'+'a'.repeat(64)};
const match=(row,query)=>Object.entries(query).every(([k,v])=>v&&typeof v==='object'?('$in'in v?v.$in.includes(row[k]):row[k]>=v.$gte):row[k]===v);
test('Robinhood stats count confirmed launches once, respect UTC boundaries, omit drafts and never expose journal secrets',async()=>{
 const today=new Date('2026-10-20T00:00:00Z'),month=new Date('2026-10-01T00:00:00Z');
 const rows=[
  {_id:'sage',agentId:'a'.repeat(24),chainId:4663,phase:'confirmed',active:true,token,preview:{metadata:{name:'Sage Agent'}},createdAt:new Date('2026-09-20T01:00:00Z'),launchedAt:new Date('2026-10-20T01:00:00Z'),managedSubmission:{ciphertext:'SECRET'}},
  {_id:'older',agentId:'b'.repeat(24),chainId:4663,phase:'confirmed',token:{...token,address:'0x'+'2'.repeat(40)},createdAt:new Date('2026-09-20T01:00:00Z'),launchedAt:new Date('2026-09-30T23:59:00Z')},
  {chainId:4663,phase:'draft',active:true,createdAt:today},
  {chainId:4663,phase:'confirming',active:true,createdAt:today},
  {chainId:4663,phase:'reverted',active:false,createdAt:today},
  {chainId:1,phase:'confirmed',active:true,createdAt:today},
 ];
 const db={collection:name=>{assert.equal(name,'pons_launch_intents');return{
  countDocuments:async query=>rows.filter(row=>match(row,query)).length,
  find:(query,options)=>{assert.equal(options.projection.token,1);const cursor={sort:()=>cursor,limit:()=>cursor,toArray:async()=>rows.filter(row=>match(row,query))};return cursor;},
 }}};
 const result=await ponsAdminStats(db,month,today);
 assert.equal(result.totalLaunched,2);assert.equal(result.totalQueued,1);assert.equal(result.totalFailed,1);
 assert.equal(result.launchesThisMonth,1);assert.equal(result.launchesToday,1);assert.equal(result.recentLaunches[0].tradeUrl,policy.ponsTokenUrl(token.address));
 assert.equal(JSON.stringify(result).includes('SECRET'),false);assert.equal(result.recentLaunches[0].chain,'Robinhood');
});

test('admin list exposes a validated Robinhood association and rejects incomplete launch data',async()=>{
 let allowed=false;
 const rows=[{_id:'sage',name:'Sage',ponsToken:token},{_id:'pending',name:'Pending',ponsToken:{...token,status:'confirming'}},{_id:'solana',isTokenized:true,tokenLaunchStatus:'launched',tokenMintAddress:'solanamint'}];
 const cursor={sort:()=>cursor,skip:()=>cursor,limit:()=>cursor,toArray:async()=>rows};
 const route=load('../app/api/admin/agents/route.ts',{
  '@/lib/agent-tokenization/catalog':catalog,
  'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
  '@/lib/admin-auth':{verifyAdmin:async()=>allowed?{}:{error:Response.json({}, {status:403})}},
  '@/lib/db':{getDb:async()=>({collection:()=>({find:()=>cursor,countDocuments:async()=>rows.length})}),COLLECTIONS:{AGENTS:'agents'}},
  '@/lib/agent-tokenization/association':association,'@/lib/logger':{logger:{error:()=>{}}},
 });
 assert.equal((await route.GET(new Request('https://hive.test/api'))).status,403);allowed=true;
 const {agents}=await (await route.GET(new Request('https://hive.test/api'))).json();
 assert.deepEqual(agents[0].ponsToken,token);assert.equal(agents[0].isTokenized,true);assert.equal(agents[1].ponsToken,null);assert.equal(agents[2].tokenMintAddress,'solanamint');
});

test('admin totals combine both chains and fee failures remain failures with explorer receipts',async()=>{
 let authorized=false,claims=0,source;
 const next={NextResponse:{json:(body,options)=>Response.json(body,options)}};
 const cursor={sort:()=>cursor,limit:()=>cursor,project:()=>cursor,toArray:async()=>[]};
 const route=load('../app/api/admin/token-stats/route.ts',{
  'next/server':next,'@/lib/admin-auth':{verifyAdmin:async()=>authorized?{}:{error:Response.json({}, {status:403})}},
  '@/lib/db':{COLLECTIONS:{AGENTS:'agents',ACTIVITY:'activity',TOKEN_LAUNCHES:'launches'},getDb:async()=>({collection:()=>({countDocuments:async query=>query.isTokenized?2:0,find:()=>cursor})})},
  '@/lib/bags-agent':{createAgentBagsClient:()=>({getBalance:async()=>1,getWalletAddress:()=>'',getClaimablePositions:async()=>[]})},
  '@/lib/agent-tokenization/admin-stats':{solanaSessionStats:async()=>({totalLaunched:0,bags:0,pump:0,totalQueued:0,totalFailed:0,launchesThisMonth:0,launchesToday:0,recentLaunches:[]}),ponsAdminStats:async()=>({totalLaunched:1,totalQueued:0,totalFailed:0,launchesThisMonth:1,launchesToday:1,recentLaunches:[]})},
  '@/lib/agent-tokenization/legacy':{legacyAgentLaunchesEnabled:()=>false},
  '@/lib/agent-tokenization/fee-sources':{additionalFeeBalances:async()=>[{source:'bags-deployer',totalClaimable:.1,error:null},{source:'pump',totalClaimable:null,error:'Unavailable'}],feeClient:(_db,value)=>{source=value;return{};}},
  '@/lib/agent-tokenization/solana-runtime':{launchConnection:()=>({})},
  '@/lib/agent-tokenization/session':{HIVE_SOLANA_FEE_WALLET:'wallet'},
  '@/lib/agent-fees':{claimableLamports:()=>0n},
  '@/lib/agent-fee-claims':{feeClaimStatus:async()=>null,runFeeClaim:async()=>{claims++;return{pending:true,confirmed:0,failed:0,transactions:[{signature:'test',confirmed:false}]};}},
 });
 const request=(source,origin)=>new Request('https://hive.test/api',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({action:'claim-fees',source,requestId:'00000000-0000-4000-8000-000000000001'})});
 assert.equal((await route.POST(request())).status,403);assert.equal(claims,0);authorized=true;
 const data=await(await route.GET(new Request('https://hive.test/api'))).json();assert.equal(data.stats.totalLaunched,3);assert.deepEqual(data.stats.byChain,{solana:2,robinhood:1});
 const response=await route.POST(request());assert.equal(response.status,202);assert.equal((await response.json()).claim.transactions[0].confirmed,false);assert.equal(claims,1);
 assert.equal(source,'bags-creator');assert.equal(data.feeSources[2].totalClaimable,null);
 assert.equal((await route.POST(request('pump'))).status,202);assert.equal(source,'pump');
 assert.equal((await route.POST(request('bags-deployer'))).status,202);assert.equal(source,'bags-deployer');
 assert.equal((await route.POST(request('other'))).status,400);
 assert.equal((await route.POST(request('pump','https://attacker.test'))).status,403);assert.equal(claims,3);
});
