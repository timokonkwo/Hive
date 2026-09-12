import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/auth-fetch.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fetchWithAccessToken:request}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('a rejected authenticated read refreshes its token and retries once',async()=>{
 let tokenReads=0;const sent=[];
 const r=await request('/api/dashboard',{},true,async()=>++tokenReads===1?'old':'fresh',async(url,init)=>{sent.push(init);return new Response('{}',{status:sent.length===1?401:200});});
 assert.equal(r.status,200);assert.equal(sent.length,2);assert.equal(sent[0].headers.get('Authorization'),'Bearer old');assert.equal(sent[1].headers.get('Authorization'),'Bearer fresh');assert.ok(sent.every(s=>s.credentials==='include'));
});
test('a failed refresh stops after one read retry without pretending success',async()=>{let calls=0;const r=await request('/api/dashboard',{},true,async()=>null,async()=>{calls++;return new Response('{}',{status:401});});assert.equal(calls,2);assert.equal(r.status,401);});
test('unauthenticated reads do not loop',async()=>{let calls=0;await request('/api/dashboard',{},false,async()=>null,async()=>{calls++;return new Response('{}',{status:401});});assert.equal(calls,1);});
test('writes are never replayed after an authorization failure',async()=>{for(const method of ['POST','PATCH','PUT','DELETE']){let calls=0;await request('/api/tasks',{method,body:'reviewed body'},true,async()=>'token',async(u,i)=>{calls++;assert.equal(i.body,'reviewed body');return new Response('{}',{status:401});});assert.equal(calls,1);}});
test('aborting after the first rejection prevents the retry',async()=>{const controller=new AbortController();let calls=0;await assert.rejects(()=>request('/api/dashboard',{signal:controller.signal},true,async()=>'token',async()=>{calls++;controller.abort();return new Response('{}',{status:401});}),{name:'AbortError'});assert.equal(calls,1);});
test('cookie sessions and caller headers remain supported',async()=>{let calls=0;await request('/api/dashboard',{headers:{'X-Test':'kept'}},true,async()=>null,async(u,i)=>{calls++;assert.equal(i.credentials,'include');assert.equal(i.headers.get('X-Test'),'kept');assert.equal(i.headers.has('Authorization'),false);return new Response('{}',{status:200});});assert.equal(calls,1);});
test('permission failures and network errors are not retried',async()=>{for(const status of [403,429,500]){let calls=0;await request('/api/dashboard',{},true,async()=>'token',async()=>{calls++;return new Response('{}',{status});});assert.equal(calls,1);}let calls=0;await assert.rejects(()=>request('/api/dashboard',{},true,async()=>'token',async()=>{calls++;throw Error('offline');}),/offline/);assert.equal(calls,1);});
