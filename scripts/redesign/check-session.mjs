// Real auth hook/resource lifecycle with explicit mock Privy and API boundaries.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'hive-session-'));let browser,server;
try {
 await build({stdin:{resolveDir:root,loader:'tsx',contents:`
 import React,{useSyncExternalStore} from 'react';import{createRoot}from'react-dom/client';
 import{useAuthFetch}from'./hooks/useAuthFetch';import{useResource}from'./components/redesign/task/useResource';
 const f=window.fixture={state:{ready:false,authenticated:false,id:''},reads:0,calls:[],mode:'late'};
 f.change=patch=>{f.state={...f.state,...patch};dispatchEvent(new Event('session-change'));};
 f.get=async()=>{const id=f.state.id,n=++f.reads;await new Promise(r=>setTimeout(r,f.mode==='slow'?250:25));if(f.mode==='outage')throw Error('private-provider-error');if(['missing','cookie'].includes(f.mode)||f.mode==='late'&&n<3)return null;return f.mode==='refresh'&&n===1?'expired':id;};
 window.fetch=async(url,options)=>{const bearer=options.headers.get('authorization');f.calls.push(bearer);await new Promise(r=>setTimeout(r,25));return Response.json({account:bearer},{status:bearer==='Bearer expired'||(!bearer&&f.mode!=='cookie')?401:200});};
 const subscribe=cb=>{addEventListener('session-change',cb);return()=>removeEventListener('session-change',cb);};
 const parse=data=>data;
 function Data({id}){const state=useSyncExternalStore(subscribe,()=>f.state),request=useAuthFetch();const result=useResource(state.ready&&state.authenticated?'/api/test':null,parse,request,0,state.id);return <output data-id={id}>{JSON.stringify(result)}</output>;}
 createRoot(document.getElementById('root')).render(<><Data id="one"/><Data id="two"/></>);`},bundle:true,format:'iife',jsx:'automatic',outfile:dir+'/app.js',plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/^@\//},a=>({path:root+a.path.slice(2)+'.ts'}));
  b.onResolve({filter:/^@privy-io\/react-auth$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({resolveDir:root,contents:`import{useSyncExternalStore}from'react';const subscribe=cb=>{addEventListener('session-change',cb);return()=>removeEventListener('session-change',cb);};export function usePrivy(){const s=useSyncExternalStore(subscribe,()=>window.fixture.state);return{ready:s.ready,authenticated:s.authenticated,user:s.id?{id:s.id}:null,getAccessToken:window.fixture.get};}export function useIdentityToken(){return{identityToken:null};}export async function getIdentityToken(){return null;}`}));
 }}]});
 server=http.createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?await readFile(dir+'/app.js'):'<div id="root"></div><script src="/app.js"></script>');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const reset=async mode=>{await page.goto(origin);await page.locator('output').first().waitFor();await page.evaluate(mode=>{fixture.mode=mode;fixture.change({ready:true,authenticated:true,id:'account-a'});},mode);};
 const state=async name=>page.waitForFunction(name=>[...document.querySelectorAll('output')].every(el=>JSON.parse(el.textContent).state===name),name);
 await page.goto(origin);await page.locator('output').first().waitFor();assert.equal(await page.evaluate(()=>fixture.calls.length),0);
 await reset('late');await state('success');assert.equal(await page.evaluate(()=>fixture.reads),3);assert.equal(await page.evaluate(()=>fixture.calls.length),2);
 console.log('PASS readiness and concurrent delayed-token acquisition');
 await reset('refresh');await state('success');assert.equal(await page.evaluate(()=>fixture.calls.length),4);assert.equal(await page.evaluate(()=>fixture.calls.filter(x=>x==='Bearer expired').length),2);
 console.log('PASS expired credentials refresh once per read');
 await reset('missing');await state('error');assert.equal(await page.evaluate(()=>fixture.calls.length),4);assert.equal(await page.locator('output').first().evaluate(el=>JSON.parse(el.textContent).status),401);
 await reset('outage');await state('error');assert.equal(await page.locator('output').first().evaluate(el=>JSON.parse(el.textContent).status),503);
 await reset('cookie');await state('success');assert.equal(await page.evaluate(()=>fixture.calls.length),2);assert.equal(await page.evaluate(()=>fixture.calls.every(x=>x===null)),true);
 console.log('PASS cookie sessions, rejected sessions and provider outages');
 await reset('slow');await page.waitForFunction(()=>fixture.reads>0);await page.evaluate(()=>fixture.change({id:'account-b'}));await state('success');
 assert.equal(await page.evaluate(()=>fixture.calls.every(x=>x==='Bearer account-b')),true);
 await page.evaluate(()=>fixture.change({id:'',authenticated:false}));await state('idle');
 assert.equal(await page.locator('output').first().evaluate(el=>el.textContent.includes('account-b')),false);
 assert.deepEqual(errors,[]);console.log('PASS account-switch cancellation, stale-state removal and logout');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
