import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/auth-fetch.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fetchWithAccessToken:request,sharedAccessToken,waitForToken}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('a rejected authenticated read refreshes its token and retries once',async()=>{
 let tokenReads=0;const sent=[];
 const r=await request('/api/dashboard',{},true,async()=>++tokenReads===1?'old':'fresh',async(url,init)=>{sent.push(init);return new Response('{}',{status:sent.length===1?401:200});});
 assert.equal(r.status,200);assert.equal(sent.length,2);assert.equal(sent[0].headers.get('Authorization'),'Bearer old');assert.equal(sent[1].headers.get('Authorization'),'Bearer fresh');assert.ok(sent.every(s=>s.credentials==='include'));
});
test('HttpOnly sessions reach the same-origin API without a readable bearer',async()=>{
 let calls=0;const response=await request('/api/dashboard',{},true,async()=>null,async(u,init)=>{
  calls++;assert.equal(init.headers.has('Authorization'),false);assert.equal(init.credentials,'include');return new Response('{}');
 });assert.equal(response.status,200);assert.equal(calls,1);
});
test('missing cookies remain unauthorized after one bounded read retry',async()=>{
 let calls=0;const response=await request('/api/dashboard',{},true,async()=>null,async()=>{calls++;return new Response('{}',{status:401});});
 assert.equal(response.status,401);assert.equal(calls,2);
});
test('missing bearer does not fall back to cookies on another origin',async()=>{
 for(const url of ['https://other.example/api','//other.example/api','/\\\\other.example/api']){
  let calls=0;await assert.rejects(request(url,{},true,async()=>null,async()=>{calls++;return new Response('{}');}),e=>e.status===401);assert.equal(calls,0);
 }
});
test('cookie-authenticated writes are sent once',async()=>{
 let calls=0;await request('/api/tasks',{method:'POST',body:'reviewed'},true,async()=>null,async(u,init)=>{calls++;assert.equal(init.body,'reviewed');return new Response('{}',{status:401});});assert.equal(calls,1);
});
test('unauthenticated reads do not loop',async()=>{let calls=0;await request('/api/dashboard',{},false,async()=>null,async()=>{calls++;return new Response('{}',{status:401});});assert.equal(calls,1);});
test('writes are never replayed after an authorization failure',async()=>{for(const method of ['POST','PATCH','PUT','DELETE']){let calls=0;await request('/api/tasks',{method,body:'reviewed body'},true,async()=>'token',async(u,i)=>{calls++;assert.equal(i.body,'reviewed body');return new Response('{}',{status:401});});assert.equal(calls,1);}});
test('aborting after the first rejection prevents the retry',async()=>{const controller=new AbortController();let calls=0;await assert.rejects(()=>request('/api/dashboard',{signal:controller.signal},true,async()=>'token',async()=>{calls++;controller.abort();return new Response('{}',{status:401});}),{name:'AbortError'});assert.equal(calls,1);});
test('caller headers and cookie transport are preserved alongside the bearer',async()=>{let calls=0;await request('/api/dashboard',{headers:{'X-Test':'kept'}},true,async()=>'token',async(u,i)=>{calls++;assert.equal(i.credentials,'include');assert.equal(i.headers.get('X-Test'),'kept');assert.equal(i.headers.get('Authorization'),'Bearer token');return new Response('{}',{status:200});});assert.equal(calls,1);});
test('permission failures and network errors are not retried',async()=>{for(const status of [403,429,500]){let calls=0;await request('/api/dashboard',{},true,async()=>'token',async()=>{calls++;return new Response('{}',{status});});assert.equal(calls,1);}let calls=0;await assert.rejects(()=>request('/api/dashboard',{},true,async()=>'token',async()=>{calls++;throw Error('offline');}),/offline/);assert.equal(calls,1);});

test('late credentials recover before a request is sent',async()=>{let reads=0,calls=0;await request('/api/dashboard',{},true,async()=>++reads<3?null:'ready',async()=>{calls++;return new Response('{}');});assert.equal(reads,3);assert.equal(calls,1);});
test('provider failures are outages, not lost sessions',async()=>{await assert.rejects(request('/api/dashboard',{},true,async()=>{throw Error('private provider payload');}),e=>e.status===503&&!e.message.includes('private'));});
test('an unchanged rejected token is not replayed in a loop',async()=>{let calls=0;const r=await request('/api/dashboard',{},true,async()=>'same',async()=>{calls++;return new Response('{}',{status:401});});assert.equal(r.status,401);assert.equal(calls,1);});
test('account switches abort rather than replaying a request',async()=>{let calls=0;await assert.rejects(request('/api/tasks',{method:'POST'},true,async()=>{throw new DOMException('Changed','AbortError');},async()=>{calls++;}),{name:'AbortError'});assert.equal(calls,0);});
test('shared acquisition isolates identities and forgets completed promises',async()=>{let calls=0,resolve;const getter=()=>{calls++;return new Promise(r=>{resolve=r;});};const a=sharedAccessToken(getter,'a'),b=sharedAccessToken(getter,'a');assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);resolve('first');assert.equal(await a,'first');await Promise.resolve();const c=sharedAccessToken(getter,'b');assert.notEqual(c,a);await Promise.resolve();resolve('second');assert.equal(await c,'second');});
test('aborting a waiter does not abort shared retrieval',async()=>{const c=new AbortController();let finish;const underlying=new Promise(r=>finish=r);const a=waitForToken(underlying,c.signal);c.abort();await assert.rejects(a,{name:'AbortError'});finish('okay');assert.equal(await underlying,'okay');});

test('a cookie-only read can recover after a server rejection',async()=>{let calls=0;const response=await request('/api/dashboard',{},true,async()=>null,async()=>new Response('{}',{status:++calls===1?401:200}));assert.equal(response.status,200);assert.equal(calls,2);});
test('upload and launch callers retain their explicit request deadline',async()=>{
 const controller=new AbortController();
 await request('/api/agents/test',{method:'POST',signal:controller.signal},true,async()=>'token',async(_url,init)=>{assert.equal(init.signal,controller.signal);return new Response('{}');});
});
