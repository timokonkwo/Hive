// Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/tokenization/check-browser.mjs
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'hive-pons-browser-'));
let browser,server;
try {
  await build({entryPoints:[root+'scripts/tokenization/browser-fixture.jsx'],bundle:true,external:['/redesign/fonts/*'],format:'iife',jsx:'automatic',outfile:dir+'/app.js',plugins:[{name:'fixture-boundaries',setup(b){
    b.onResolve({filter:/^@\//},args=>({path:root+args.path.slice(2)+'.ts'}));
    b.onResolve({filter:/^@privy-io\/react-auth$|^next\/(image|link)$/},args=>({path:args.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/link'?`import React from '${root}node_modules/react/index.js';export default function Link({children,...props}){return React.createElement('a',props,children)}`:args.path==='next/image'
      ?`import React from '${root}node_modules/react/index.js';export default function Image({unoptimized,...props}){return React.createElement('img',props)}`
      :`import {useSyncExternalStore} from '${root}node_modules/react/index.js';export function usePrivy(){return{connectWallet(){window.fixture.modalOpen=true;window.dispatchEvent(new Event('fixture-modal'))}}}export function useModalStatus(){return{isOpen:useSyncExternalStore(cb=>{window.addEventListener('fixture-modal',cb);return()=>window.removeEventListener('fixture-modal',cb)},()=>!!window.fixture.modalOpen)}}export function useWallets(){return{wallets:[window.fixture.wallet]}}`,resolveDir:root,loader:'js'}));
  }}]});
  const html=`<!doctype html><html lang="en"><head><title>Token launch fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--paper:#fafbf5;--ink:#182015;--muted:#5a6254;--rule:#d0d6c7;--accent:#ccff00;--accent-ink:#182015;--accent-text:#4a6200;--soft:#e9eddf}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:24px;background:var(--paper)}button,input,select{font:inherit}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  server=http.createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(['/app.js','/app.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/css');res.end(await readFile(dir+req.url));}else{res.statusCode=404;res.end();}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const open=async(role='Owner')=>{await page.getByRole('button',{name:role+' tokenize'}).click();await page.getByLabel('Ticker',{exact:true}).waitFor();};
  const prepare=async()=>{await page.getByLabel('Launch wallet',{exact:true}).selectOption('0x'+'1'.repeat(40));await page.getByRole('button',{name:'Review launch',exact:true}).click();};
  const fresh=async()=>{await page.goto(origin);await page.getByRole('button',{name:'Owner tokenize'}).waitFor();};
  await fresh();
  const sage=page.getByRole('row').filter({hasText:'Sage Agent'});
  assert.equal(await sage.getByRole('button',{name:'Tokenize',exact:true}).count(),0);
  assert.equal(await sage.getByRole('button',{name:'View token',exact:true}).count(),1);
  assert.equal(await sage.getByRole('link',{name:'SAGE · Robinhood'}).getAttribute('href'),'https://www.ponsfamily.com/launchpad/0x2222222222222222222222222222222222222222');
  assert.equal(await page.getByRole('row').filter({hasText:'Untokenized agent'}).getByRole('button',{name:'Tokenize',exact:true}).count(),1);
  for (const theme of ['light','dark']) {
    await page.evaluate(value=>document.documentElement.dataset.hiveTheme=value,theme);
    for(const width of [320,1280]) {
      await page.setViewportSize({width,height:900});
      const trade=page.getByRole('link',{name:'Trade on Pons',exact:true});
      assert.equal(await trade.getAttribute('href'),'https://www.ponsfamily.com/launchpad/0x2222222222222222222222222222222222222222');
      await open('Admin');
      const action=page.getByRole('button',{name:'Review launch',exact:true});
      for(const state of ['normal','hover','focus']) {
        if(state==='hover')await action.hover();if(state==='focus')await action.focus();
        assert.equal(await action.evaluate(el=>getComputedStyle(el).color),'rgb(24, 32, 21)',`${theme} ${state} button contrast`);
      }
      await page.getByRole('button',{name:'Close token launch'}).click();
      assert.equal(await trade.evaluate(el=>getComputedStyle(el).color),'rgb(24, 32, 21)');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    }
  }
  console.log('PASS profile trade section and primary button contrast in light/dark at mobile and desktop');
  await fresh();await open();assert.equal(await page.getByRole('button',{name:'Edit agent details'}).count(),0);
  await page.getByRole('button',{name:'Close token launch'}).click();await open('Admin');
  await page.getByRole('button',{name:'Edit agent details'}).click();
  await page.getByLabel('Agent name',{exact:true}).fill('Renamed agent');
  await page.getByLabel('Bio',{exact:true}).fill('Updated services and work history.');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('heading',{name:'Research agent',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit agent details'}).click();
  await page.getByLabel('Agent name',{exact:true}).fill('Renamed agent');
  await page.getByLabel('Bio',{exact:true}).fill('Updated services and work history.');
  await page.locator('input[type=file]').setInputFiles({name:'agent.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA8sAAAAASUVORK5CYII=','base64')});
  await page.evaluate(()=>fixture.profileFail=true);
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Image upload unavailable'}).waitFor();
  assert.equal(await page.getByLabel('Agent name',{exact:true}).inputValue(),'Renamed agent');
  await page.evaluate(()=>fixture.profileFail=false);
  await page.getByRole('button',{name:'Save changes',exact:true}).evaluate(b=>{b.click();b.click();});
  await page.getByRole('heading',{name:'Renamed agent',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.includes('/profile?')).length),2);
  assert.equal(await page.getByRole('link',{name:'View agent profile'}).getAttribute('href'),'https://uphive.xyz/agent/Renamed%20agent');
  await page.getByRole('button',{name:'Edit agent details'}).click();
  assert.equal(await page.getByLabel('Agent name',{exact:true}).inputValue(),'Renamed agent');
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.screenshot({path:`/tmp/hive-agent-editor-${width}.png`});
  }
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  console.log('PASS admin edit, cancel, image preview, failed-save recovery, double-submit and responsive layout');
  await fresh();await open();assert.equal(await page.evaluate(()=>fixture.walletCalls.length),0);
  await page.getByRole('button',{name:'Connect another wallet'}).click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
  await page.evaluate(()=>{fixture.modalOpen=false;window.dispatchEvent(new Event('fixture-modal'));});await page.waitForFunction(()=>document.querySelector('dialog').open);
  await prepare();await page.getByRole('heading',{name:'Review transaction'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.sent.length),0);
  await page.getByRole('button',{name:'Approve launch'}).evaluate(button=>{button.click();button.click();});
  await page.getByRole('heading',{name:'Confirming your launch…'}).waitFor();assert.equal(await page.evaluate(()=>fixture.sent.length),1);
  await page.getByRole('button',{name:'Close token launch'}).click();await page.getByRole('button',{name:'Owner tokenize'}).click();
  await page.getByRole('heading',{name:'Confirming your launch…'}).waitFor();assert.equal(await page.evaluate(()=>fixture.sent.length),1);
  await page.evaluate(()=>fixture.confirm());await page.getByRole('button',{name:'Check status',exact:true}).click();
  await page.getByRole('heading',{name:'RESEARCH is live'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Creator fees on Pons'}).getAttribute('href'),'https://ponsfamily.com/profile');
  await page.getByRole('button',{name:'Close token launch'}).click();assert.equal(await page.getByRole('button',{name:'Owner tokenize'}).evaluate(el=>el===document.activeElement),true);
  console.log('PASS wallet choice, separate authorization/review, duplicate-click guard, reopen recovery, final success and focus return');

  await fresh();await page.evaluate(()=>fixture.rejectSign=true);await open();await prepare();
  await page.getByRole('alert').filter({hasText:'Wallet request declined'}).waitFor();assert.equal(await page.evaluate(()=>fixture.sent.length),0);
  await page.evaluate(()=>{fixture.rejectSign=false;fixture.prepareFail=true;});await prepare();
  await page.getByRole('heading',{name:'Your pending launch'}).waitFor();assert.equal(await page.getByLabel('Ticker',{exact:true}).count(),0);
  await page.evaluate(()=>{fixture.prepareFail=false;fixture.expired=true;});await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('button',{name:'Refresh estimate'}).waitFor();assert.equal(await page.getByRole('button',{name:'Approve launch'}).count(),0);
  await page.evaluate(()=>fixture.expired=false);await page.getByRole('button',{name:'Refresh estimate'}).click();await page.getByRole('button',{name:'Approve launch'}).waitFor();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Cancel launch',exact:true}).click();
  await page.getByRole('heading',{name:'Cancel pending launch'}).waitFor();await page.getByRole('button',{name:'Confirm cancellation'}).click();
  await page.getByRole('heading',{name:'Confirming cancellation…'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.sent[0].to), '0x'+'1'.repeat(40));assert.equal(await page.evaluate(()=>fixture.sent[0].value),'0x0');assert.equal(await page.evaluate(()=>fixture.sent[0].nonce),'0x4');
  await page.evaluate(()=>fixture.saved.phase='cancelled');await page.getByRole('button',{name:'Check status',exact:true}).click();
  await page.getByRole('button',{name:'Start a new launch'}).click();await page.getByLabel('Ticker',{exact:true}).waitFor();
  console.log('PASS wallet rejection, interrupted preparation, same-intent expiry refresh and explicit cancellation');

  await fresh();await page.evaluate(()=>fixture.statusFail=true);await page.getByRole('button',{name:'Owner tokenize'}).click();
  await page.getByRole('button',{name:'Try again'}).waitFor();assert.equal(await page.getByLabel('Ticker',{exact:true}).count(),0);
  await page.evaluate(()=>fixture.statusFail=false);await page.getByRole('button',{name:'Try again'}).click();await page.getByLabel('Ticker',{exact:true}).waitFor();
  await page.evaluate(()=>fixture.noHash=true);await prepare();await page.getByRole('button',{name:'Approve launch'}).click();
  await page.getByRole('heading',{name:'Your pending launch'}).waitFor();assert.equal(await page.evaluate(()=>fixture.sent.length),1);
  assert.equal(await page.getByLabel('Ticker',{exact:true}).count(),0);
  console.log('PASS unavailable status blocks new launch and missing wallet hash preserves recovery');

  await fresh();await open('Admin');
  for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`overflow at ${width}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  }
  await page.setViewportSize({width:375,height:900});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'/tmp/hive-pons-launch-mobile.png',animations:'disabled'});
  await page.getByRole('radio',{name:'Connected wallet',exact:true}).check();
  await prepare();await page.getByRole('heading',{name:'Review transaction'}).waitFor();
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.screenshot({path:'/tmp/hive-pons-transaction-mobile.png'});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Admin tokenize'}).evaluate(el=>el===document.activeElement),true);
  await fresh();await open('Admin');
  assert.equal(await page.getByRole('radio',{name:'Hive deployer',exact:true}).isChecked(),true);
  assert.equal(await page.getByLabel('Launch wallet',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('button',{name:'Confirm launch',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.walletCalls.length),0);
  assert.equal(await page.evaluate(()=>fixture.managedSent||0),0);
  await page.screenshot({path:'/tmp/hive-managed-review-mobile.png'});
  await page.evaluate(()=>fixture.managedTimeout=true);
  await page.getByRole('button',{name:'Confirm launch',exact:true}).evaluate(b=>{b.click();b.click();});
  await page.getByRole('button',{name:'Retry submission',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.managedSent),1);
  assert.equal(await page.evaluate(()=>fixture.walletCalls.length),0);
  await page.getByRole('button',{name:'Retry submission',exact:true}).click();
  await page.getByRole('heading',{name:'Confirming your launch…'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.managedRetried),1);
  await page.getByRole('button',{name:'Close token launch'}).click();
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('button',{name:'Retry submission',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Connect launch wallet'}).count(),0);
  await page.evaluate(()=>fixture.saved.phase='confirming');await page.getByRole('button',{name:'Check status',exact:true}).click();
  await page.getByText('Waiting for network confirmation.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Retry submission',exact:true}).count(),0);
  await page.evaluate(()=>fixture.confirm());await page.getByRole('button',{name:'Check status',exact:true}).click();
  await page.getByRole('heading',{name:'RESEARCH is live'}).waitFor();
  await fresh();await page.evaluate(()=>fixture.managedUnavailable=true);await open('Admin');
  assert.equal(await page.getByRole('button',{name:'Review launch',exact:true}).isDisabled(),true);
  await page.getByRole('radio',{name:'Connected wallet',exact:true}).check();await prepare();
  await page.getByRole('button',{name:'Approve launch'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.walletCalls.filter(c=>c[0]==='personal_sign').length),1);
  await fresh();await open('Admin');await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Discard review',exact:true}).click();
  await page.getByRole('button',{name:'Start a new launch'}).click();await page.getByLabel('Ticker',{exact:true}).waitFor();
  assert.equal(await page.getByRole('radio',{name:'Hive deployer',exact:true}).isChecked(),true);
  console.log('PASS managed default, explicit confirmation, no wallet prompts, timeout/reopen recovery, unsigned discard and connected fallback');
  assert.deepEqual(errors,[]);console.log('PASS owner/admin responsive layouts, keyboard dismissal and no browser exceptions');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
