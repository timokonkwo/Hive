import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { ObjectId } from 'mongodb';
const tid='0123456789abcdef01234567',bidId='1123456789abcdef01234567',aid='2123456789abcdef01234567';
const sig='3'.repeat(88);
function load(path,imports){const source=readFileSync(new URL(path,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};new Function('require','module','exports',code)(name=>{if(!(name in imports))throw Error(name);return imports[name]},module,module.exports);return module.exports;}
const common={
 'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},mongodb:{ObjectId},
 '@/lib/rate-limit':{checkRateLimit:()=>({allowed:true}),getClientIp:()=>'',RATE_LIMITS:{}},
 '@/lib/client-auth':{authenticateClient:async()=>({userId:'owner'})},
 '@/lib/client-ownership':{verifiedClientOwnsResource:()=>true,getClientActorAddress:()=> 'owner'},
 '@/lib/logger':{logger:{error(){}}},'@/lib/webhooks':{enqueueWebhookEvent:async()=>{}},
};
const names={TASKS:'tasks',BIDS:'bids',AGENTS:'agents',ACTIVITY:'activity',CLIENTS:'clients',SUBMISSIONS:'submissions'};
function proposal({status='Open',owns=true,race=false,partial=false}={}){
 const task={_id:new ObjectId(tid),status};const bid={_id:new ObjectId(bidId),agentId:aid,agentName:'Sage',status:'Pending'};let claims=0,updates=0;
 const db={collection:name=>name==='tasks'?{findOne:async()=>({...task}),updateOne:async(q,u)=>{claims++;assert.equal(q.status,'Open');if(race||task.status!=='Open')return{modifiedCount:0};Object.assign(task,u.$set);return{modifiedCount:1}}}:name==='bids'?{findOne:async()=>({...bid}),updateOne:async(q,u)=>{if(partial){partial=false;throw Error('interrupted')}updates++;Object.assign(bid,u.$set);return{modifiedCount:1}},updateMany:async()=>({})}:{insertOne:async()=>({})}};
 const route=load('../app/api/tasks/[id]/bids/[bidId]/route.ts',{...common,'@/lib/db':{getDb:async()=>db,COLLECTIONS:names},'@/lib/client-ownership':{verifiedClientOwnsResource:()=>owns,getClientActorAddress:()=> 'owner'}});
 return{task,bid,stats:()=>({claims,updates}),run:()=>route.PATCH(new Request('http://localhost/task',{method:'PATCH',body:JSON.stringify({status:'accepted'})}),{params:Promise.resolve({id:tid,bidId})})};
}
test('proposal acceptance rejects nonowners and tasks that are not Open',async()=>{
 for(const status of ['Completed','In Review','In Progress','Cancelled']){const p=proposal({status});assert.equal((await p.run()).status,409);assert.equal(p.stats().claims,0)}
 const p=proposal({owns:false});assert.equal((await p.run()).status,403);assert.equal(p.stats().updates,0);
});
test('lost task claim does not accept the competing proposal',async()=>{const p=proposal({race:true});assert.equal((await p.run()).status,409);assert.equal(p.stats().updates,0)});
test('same-proposal retry repairs a partial acceptance without assigning twice',async()=>{const p=proposal({partial:true});assert.equal((await p.run()).status,500);assert.equal((await p.run()).status,200);assert.equal(p.stats().claims,1);assert.equal(p.bid.status,'accepted');assert.equal(p.task.assignedAgentId,aid)});
function completion(prior,owns=true){
 const task={_id:new ObjectId(tid),title:'Task',status:'In Review',budgetAmount:25,clientAddress:'owner'};let verifications=0,claims=0;
 const db={collection:name=>({
  findOne:async q=>name==='tasks'?task:name==='payment_signatures'?prior:name==='bids'?q.status==='Completed'?null:{agentId:aid}:name==='agents'?{solanaAddress:'2'.repeat(32)}:name==='clients'?{solanaAddress:'1'.repeat(32)}:null,
  insertOne:async()=>{if(name==='payment_signatures'&&prior)throw Object.assign(Error('duplicate'),{code:11000});return{}},createIndex:async()=>{},deleteOne:async()=>{},updateMany:async()=>{},
  updateOne:async(q,u)=>{if(name==='tasks'){claims++;assert.equal(q.status,'In Review');if(task.status!=='In Review')return{matchedCount:0};Object.assign(task,u.$set)}return{matchedCount:1}},
 })};
 const route=load('../app/api/tasks/[id]/complete/route.ts',{...common,'@/lib/db':{getDb:async()=>db,COLLECTIONS:names},'@/lib/client-ownership':{verifiedClientOwnsResource:()=>owns,getClientActorAddress:()=> 'owner'},'@/lib/solana-pay':{verifyUsdcPayment:async()=>{verifications++;return{verified:true,confirmedAmount:25}}},'@/lib/reputation':{calculateReputation:()=>0},'@/lib/points':{awardPoints:async()=>{}}});
 return{task,stats:()=>({claims,verifications}),run:()=>route.POST(new Request('http://localhost/task',{method:'POST',body:JSON.stringify({txSignature:sig})}),{params:Promise.resolve({id:tid})})};
}
test('same-task same-owner payment retry re-verifies and completes once',async()=>{const c=completion({taskId:tid,clientAddress:'owner',status:'pending'});assert.equal((await c.run()).status,200);assert.equal(c.task.status,'Completed');assert.equal((await c.run()).status,200);assert.deepEqual(c.stats(),{claims:1,verifications:1})});
test('signature reuse for another task or client is still denied before chain verification',async()=>{
 for(const prior of [{taskId:aid,clientAddress:'owner'},{taskId:tid,clientAddress:'other'}]){const c=completion(prior);assert.equal((await c.run()).status,400);assert.equal(c.stats().verifications,0)}
 const c=completion(null,false);assert.equal((await c.run()).status,403);assert.equal(c.stats().claims,0);
});
test('task access is explicit and personalized response is never publicly cached',async()=>{
 const task={_id:new ObjectId(tid),title:'Task',status:'Open',clientPrivyUserId:'owner'};
 const route=load('../app/api/tasks/[id]/route.ts',{...common,'@/lib/db':{getDb:async()=>({collection:()=>({findOne:async()=>task,countDocuments:async()=>0})}),COLLECTIONS:names},'@/lib/admin-auth':{},'@/lib/public-redaction':{redactTaskForPublic:({clientPrivyUserId,...rest})=>rest}});
 const request=new Request('http://localhost/task');request.nextUrl=new URL(request.url);
 const result=await route.GET(request,{params:Promise.resolve({id:tid})});const body=await result.json();
 assert.equal(body.access.isOwner,true);assert.equal(body.clientPrivyUserId,undefined);assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.match(result.headers.get('Vary'),/Authorization/);
});
test('task history validates IDs, bounds stored events and applies public redaction',async()=>{
 let query,sort,limit,reads=0;
 const cursor={sort:v=>{sort=v;return cursor},limit:v=>{limit=v;return cursor},toArray:async()=>[{id:bidId,clientPrivyUserId:'private'}]};
 const route=load('../app/api/tasks/[id]/activity/route.ts',{...common,'@/lib/db':{getDb:async()=>{reads++;return{collection:()=>({find:q=>{query=q;return cursor}})}},COLLECTIONS:names},'@/lib/public-redaction':{redactActivityForPublic:({clientPrivyUserId,...event})=>event}});
 const req=new Request('http://localhost/task');
 assert.equal((await route.GET(req,{params:Promise.resolve({id:'invalid'})})).status,400);assert.equal(reads,0);
 const result=await route.GET(req,{params:Promise.resolve({id:tid})});const data=await result.json();
 assert.equal(query.taskId.$in[0],tid);assert.equal(query.taskId.$in[1].toHexString(),tid);assert.deepEqual(sort,{createdAt:-1,_id:-1});assert.equal(limit,100);assert.equal(data.events[0].clientPrivyUserId,undefined);
});
