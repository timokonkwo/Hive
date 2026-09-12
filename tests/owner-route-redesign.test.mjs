import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import crypto from 'node:crypto';
import {ObjectId} from 'mongodb';
function load(path,imports={}){const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>{if(!(n in imports))throw Error(n);return imports[n]},m,m.exports);return m.exports;}
const common={'next/server':{NextResponse:{json:(d,o)=>Response.json(d,o)}},'@/lib/rate-limit':{checkRateLimit:()=>({allowed:true}),getClientIp:()=>'',RATE_LIMITS:{}},'@/lib/logger':{logger:{error(){},info(){}}},crypto,mongodb:{ObjectId}};
const id='0123456789abcdef01234567',work=load('../lib/agent-work.ts');
function workRoute(authenticated=true) {
 const calls=[];
 const cursor={sort(){return this},skip(n){calls.push({skip:n});return this},limit(n){calls.push({limit:n});return this},async toArray(){return[{_id:new ObjectId(id),title:'Report',budget:'10 USDC',status:'In Progress',secret:'not projected in stub'}]}};
 const collection={countDocuments:async q=>{calls.push(q);return 21},find:(q,options)=>{calls.push({q,options});return cursor}};
 const route=load('../app/api/agents/me/work/route.ts',{...common,'@/lib/db':{getDb:async()=>({collection:()=>collection})},'@/lib/api-key':{authenticateRequest:async()=>authenticated?{agent:{id}}:null},'@/lib/agent-work':work});
 return{run:()=>route.GET(new Request('http://local/api?agentId=attacker&q=.*&page=999')),calls};
}
test('private work route authenticates, ignores supplied agent identity, escapes search and clamps pages',async()=>{const r=workRoute();const response=await r.run(),d=await response.json();assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(d.agentId,id);assert.equal(d.page,2);assert.equal(d.tasks[0].secret,undefined);assert.equal(r.calls[0].title.$regex,'\\.\\*');assert.ok(JSON.stringify(r.calls).includes(id));assert.ok(!JSON.stringify(r.calls).includes('attacker'));assert.ok(r.calls.some(x=>x.skip===20));assert.ok(r.calls.some(x=>x.limit===20));assert.equal((await workRoute(false).run()).status,401)});
function pinRoute({existing='',modified=1,logFailure=false}={}){let query;const route=load('../app/api/agents/set-pin/route.ts',{...common,'@/lib/db':{getDb:async()=>({collection:name=>({findOne:async()=>({_id:new ObjectId(id),ownerPinHash:existing,name:'Sage'}),updateOne:async q=>{query=q;return{modifiedCount:modified}},insertOne:async()=>{if(logFailure)throw Error('log');return{}}})}),COLLECTIONS:{AGENTS:'agents',ACTIVITY:'activity'}},'@/lib/api-key':{extractApiKey:()=> 'valid',hashApiKey:()=> 'old'}});return{run:body=>route.POST(new Request('http://local',{method:'POST',body:JSON.stringify(body)})),getQuery:()=>query};}
test('first owner PIN setup compares the prior empty value to prevent concurrent overwrite',async()=>{const r=pinRoute({modified:0});assert.equal((await r.run({pin:'123456'})).status,409);assert.deepEqual(r.getQuery().ownerPinHash,{$in:[null,'']})});
test('PIN change requires current PIN and uses the previous hash in the atomic update',async()=>{const previous=crypto.createHash('sha256').update('123456').digest('hex'),r=pinRoute({existing:previous});assert.equal((await r.run({pin:'234567',currentPin:'bad'})).status,403);assert.equal((await r.run({pin:'234567',currentPin:'123456'})).status,200);assert.equal(r.getQuery().ownerPinHash,previous)});
test('PIN activity logging failure cannot hide a successfully saved PIN',async()=>{assert.equal((await pinRoute({logFailure:true}).run({pin:'123456'})).status,200)});
function rotate(modified){let query;const route=load('../app/api/agents/regenerate-key/route.ts',{...common,'@/lib/db':{getDb:async()=>({collection:()=>({updateOne:async q=>{query=q;return{modifiedCount:modified}}})})},'@/lib/api-key':{authenticateRequest:async()=>({agent:{id,name:'Sage',apiKeyHash:'old'}}),generateApiKey:()=> 'new',hashApiKey:()=> 'newhash'}});return{run:()=>route.POST(new Request('http://local',{method:'POST'})),query:()=>query};}
test('key rotation uses the current hash and never returns a losing concurrent key',async()=>{const failure=rotate(0);assert.equal((await failure.run()).status,409);assert.equal(failure.query().apiKeyHash,'old');const success=rotate(1),r=await success.run();assert.equal((await r.json()).apiKey,'new');assert.equal(r.headers.get('Cache-Control'),'private, no-store')});
