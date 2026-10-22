// Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/tokenization/check-session-browser.mjs
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
  await build({entryPoints:[root+'scripts/tokenization/session-browser-fixture.jsx'],bundle:true,external:['/redesign/fonts/*'],format:'iife',jsx:'automatic',outfile:dir+'/app.js',plugins:[{name:'fixture-boundaries',setup(b){
    b.onResolve({filter:/^@\//},args=>({path:root+args.path.slice(2)+'.ts'}));
    b.onResolve({filter:/^@privy-io\/react-auth(?:\/solana)?$|^next\/(image|link)$/},args=>({path:args.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.endsWith('/solana')?`export function useWallets(){return{wallets:window.fixture.connected?[window.fixture.solanaWallet]:[]}}export function useSignTransaction(){return{signTransaction:({transaction})=>window.fixture.sign(transaction)}}`:args.path==='next/link'?`import React from '${root}node_modules/react/index.js';export default function Link({children,...props}){return React.createElement('a',props,children)}`:args.path==='next/image'
      ?`import React from '${root}node_modules/react/index.js';export default function Image({unoptimized,...props}){return React.createElement('img',props)}`
      :`import {useSyncExternalStore} from '${root}node_modules/react/index.js';export function usePrivy(){return{connectWallet(){window.fixture.modalOpen=true;window.dispatchEvent(new Event('fixture-modal'))}}}export function useModalStatus(){return{isOpen:useSyncExternalStore(cb=>{window.addEventListener('fixture-modal',cb);return()=>window.removeEventListener('fixture-modal',cb)},()=>!!window.fixture.modalOpen)}}export function useWallets(){return{wallets:[window.fixture.wallet]}}`,resolveDir:root,loader:'js'}));
  }}]});
  const html=`<!doctype html><html lang="en"><head><title>Token launch fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>:root{--paper:#fafbf5;--ink:#182015;--muted:#5a6254;--rule:#d0d6c7;--accent:#ccff00;--accent-ink:#182015;--accent-text:#4a6200;--soft:#e9eddf}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:24px;background:var(--paper)}button,input,select{font:inherit}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  server=http.createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(['/app.js','/app.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/css');res.end(await readFile(dir+req.url));}else if(/^\/redesign\/fonts\/manrope-(regular|medium|semibold)\.ttf$/.test(req.url)){res.setHeader('Content-Type','font/ttf');res.end(await readFile(root+'public'+req.url));}else{res.statusCode=404;res.end();}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const theme of ['light','dark'])for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:740});
    await page.goto(origin);
    await page.evaluate(theme=>document.documentElement.dataset.hiveTheme=theme,theme);
    await page.getByRole('button',{name:'Admin tokenize'}).click();
    await page.getByRole('button',{name:'Select all available'}).click();
    await page.screenshot({path:`/tmp/hive-session-selection-${theme}-${width}.png`});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('heading',{name:'Sage',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Pons purchase',{exact:true}).isVisible(),false,'optional buys start collapsed');
    const review=page.getByRole('button',{name:'Review launch',exact:true});
    assert.equal(await review.evaluate(el=>getComputedStyle(el).color),'rgb(24, 32, 21)');
    const actionFits=el=>{const r=el.getBoundingClientRect(),dialog=el.closest('dialog').getBoundingClientRect();return r.top>=dialog.top&&r.bottom<=dialog.bottom-12&&r.bottom<=innerHeight;};
    assert.equal(await review.evaluate(actionFits),true,'review stays fully inside the dialog with bottom padding');
    await page.screenshot({path:`/tmp/hive-session-review-${theme}-${width}.png`});
    await page.locator('summary').click();
    await page.getByLabel('Bags purchase',{exact:true}).fill('0.01');
    assert.equal(await review.evaluate(actionFits),true,'footer stays fully reachable with expanded fields');
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'detached'});
    assert.equal(await page.getByRole('button',{name:'Admin tokenize'}).evaluate(el=>el===document.activeElement),true);
  }
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto(origin);
    await page.getByRole('button',{name:'Admin tokenize'}).click();
    await page.getByRole('button',{name:'Select all available'}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.equal(await page.getByRole('radio',{name:'Hive deployer',checked:true}).count(),2);
    await page.getByLabel('Ticker',{exact:true}).fill('SAGEAI');
    await page.locator('summary').click();
    await page.getByLabel('Bags purchase',{exact:true}).fill('-1');
    assert.equal(await page.getByRole('button',{name:'Review launch',exact:true}).isDisabled(),true);
    await page.getByLabel('Bags purchase',{exact:true}).fill('0.001');
    await page.getByLabel('pump.fun purchase',{exact:true}).fill('-1');
    assert.equal(await page.getByRole('button',{name:'Review launch',exact:true}).isDisabled(),true);
    await page.getByLabel('pump.fun purchase',{exact:true}).fill('0.002');
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'SAGEAI');
    assert.equal(await page.getByLabel('Bags purchase',{exact:true}).inputValue(),'0.001');
    await page.getByRole('button',{name:'Edit agent details'}).click();
    await page.getByLabel('Agent name',{exact:true}).fill('Sage Research');
    await page.getByRole('button',{name:'Save changes'}).click();
    await page.getByRole('heading',{name:'Sage Research',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'SAGEAI','editing does not reset the ticker');
    assert.equal(await page.getByLabel('Bags purchase',{exact:true}).inputValue(),'0.001','editing preserves the purchase');
    assert.equal(await page.getByLabel('pump.fun purchase',{exact:true}).inputValue(),'0.002','editing preserves the pump.fun purchase');
    await page.screenshot({path:`/tmp/hive-session-review-${width}.png`});
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.getByRole('button',{name:'Review launch',exact:true}).click();
    await page.getByRole('heading',{name:'Ready to launch'}).waitFor();
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'approval fits mobile');
    await page.screenshot({path:`/tmp/hive-session-approval-${width}.png`});
    assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.body?.action==='confirm').length),0);
    assert.equal(await page.evaluate(()=>fixture.session.targets.find(t=>t.terms.platform==='pump').terms.purchase),'2000000');
    await page.getByRole('button',{name:'Close token launch'}).click();
    await page.getByRole('button',{name:'Admin tokenize'}).click();
    await page.getByRole('button',{name:'Edit remaining launches'}).waitFor();
    assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'overview actions fit mobile');
    await page.screenshot({path:`/tmp/hive-session-overview-${width}.png`});
    assert.equal(await page.getByRole('button',{name:'Approve transaction'}).count(),0);
    await page.getByRole('button',{name:'Edit remaining launches'}).click();
    await page.getByRole('checkbox',{name:/Bags/}).uncheck();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'SAGEAI');
    await page.getByRole('button',{name:'Review launch',exact:true}).click();
    await page.getByRole('button',{name:'Launch tokens',exact:true}).click();
    await page.getByRole('heading',{name:'Launch complete'}).waitFor({timeout:45000});
    assert.equal(await page.evaluate(()=>fixture.signs),0,'managed launches never open a wallet');
    assert.equal(await page.evaluate(()=>fixture.session.targets.filter(t=>t.phase==='confirmed').length),2);
    assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.body?.action==='approve').length),1);
    assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.body?.action==='create').length),1);
    await page.getByRole('button',{name:'Manage tokens',exact:true}).click();
    await page.getByRole('button',{name:'Close token launch'}).click();
  }
  // A pending hash has an explorer link; a successful receipt completes the flow.
  await page.setViewportSize({width:390,height:900});
  await page.goto(origin);
  await page.evaluate(()=>{
    fixture.readOnly=true;
    fixture.session={id:crypto.randomUUID(),agentId:'0123456789abcdef01234567',role:'admin',revision:0,
      metadata:{name:'Cipher Agent',symbol:'CIPHER'},paused:false,targets:[{terms:{platform:'pons',purchase:'0',mode:'managed'},
      phase:'confirming',awaitingFinality:true,transactionHash:'0x'+'a'.repeat(64)}]};
  });
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('status').filter({hasText:'Robinhood · Confirming launch…'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'View transaction'}).getAttribute('href'),'https://robinhoodchain.blockscout.com/tx/0x'+'a'.repeat(64));
  assert.equal(await page.getByRole('link',{name:'Trade',exact:true}).count(),0,'no trade association for a pending receipt');
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.screenshot({path:'/tmp/hive-session-pending-390.png'});

  await page.getByRole('button',{name:'Close token launch'}).click();
  await page.evaluate(()=>{
    fixture.session.targets[0].phase='confirmed';
    fixture.session.targets[0].token={platform:'pons',network:'robinhood',address:'0x'+'1'.repeat(40),symbol:'CIPHER',transactionHash:'0x'+'a'.repeat(64)};
  });
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('heading',{name:'Launch complete',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Trade',exact:true}).count(),1);
  assert.equal(await page.getByText('Transaction confirmed · Finalizing…').count(),0);

  // Deployer contention keeps the approved launch polling, including after reopening.
  await page.goto(origin);
  await page.evaluate(()=>fixture.deployerBusy=true);
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('checkbox',{name:/Pons/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('button',{name:'Launch tokens',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Waiting for Hive deployer…'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Launching tokens',exact:true}).isVisible(),true);
  assert.equal(await page.locator('dialog li svg.lucide-loader-circle').count(),1,'waiting has a spinner');
  assert.equal(await page.getByRole('alert').count(),0);
  await page.getByRole('button',{name:'Close token launch'}).click();
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('status').filter({hasText:'Waiting for Hive deployer…'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).count(),0,'no repeat approval while queued');
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.screenshot({path:'/tmp/hive-session-deployer-wait-390.png'});
  await page.evaluate(()=>fixture.deployerBusy=false);
  await page.getByRole('heading',{name:'Launch complete'}).waitFor({timeout:45000});
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.body?.action==='approve').length),1);
  assert.equal(await page.evaluate(()=>fixture.signs),0);

  // Insufficient SOL keeps the user on the overview without another approval loop.
  await page.setViewportSize({width:390,height:900});
  await page.goto(origin);
  await page.evaluate(()=>fixture.unfunded=true);
  await page.getByRole('button',{name:'Admin tokenize'}).click();
  await page.getByRole('checkbox',{name:/Bags/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'needs more SOL'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Launch tokens',exact:true}).count(),0);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'needs more SOL'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('dialog [aria-busy]')?.getAttribute('aria-busy')==='false');
  assert.equal(await page.getByRole('button',{name:'Launch tokens',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>['approve','advance','confirm'].includes(c.body?.action)).length),0);
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.screenshot({path:'/tmp/hive-session-insufficient-sol-390.png'});
  await page.evaluate(()=>fixture.unfunded=false);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('heading',{name:'Ready to launch'}).waitFor();
  assert.equal(await page.getByRole('alert').filter({hasText:'needs more SOL'}).count(),0);

  await page.goto(origin);
  await page.getByRole('button',{name:'Owner tokenize'}).click();
  await page.getByRole('checkbox',{name:/pump.fun/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  assert.equal(await page.getByRole('radio',{name:'Hive deployer'}).count(),1);
  await page.getByRole('radio',{name:'Connected wallet'}).check();
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.getByRole('button',{name:'Launch tokens',exact:true}).click();
  await page.getByRole('button',{name:'Sign transaction',exact:true}).waitFor();
  await page.evaluate(()=>fixture.reject=true);
  await page.getByRole('button',{name:'Sign transaction',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Wallet request declined'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.body?.action==='confirm').length),0);
  await page.evaluate(()=>fixture.reject=false);
  await page.getByRole('button',{name:'Sign transaction',exact:true}).click();
  await page.getByRole('heading',{name:'Launch complete'}).waitFor({timeout:20000});
  assert.equal(await page.evaluate(()=>fixture.signs),2);
  // A verified EVM address and its wallet provider can use different casing.
  await page.goto(origin);
  await page.getByRole('button',{name:'Owner tokenize'}).click();
  await page.getByRole('checkbox',{name:/Robinhood/}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('radio',{name:'Connected wallet'}).check();
  assert.equal(await page.getByLabel('Select Robinhood wallet',{exact:true}).inputValue(),await page.evaluate(()=>fixture.wallet.address));
  assert.equal(await page.getByRole('button',{name:'Review launch',exact:true}).isEnabled(),true);
  // Explicit connection gives the provider modal the top layer and returns focus afterward.
  const connect=page.getByRole('button',{name:'Connect another wallet'});
  await connect.click();
  assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
  await page.evaluate(()=>{fixture.modalOpen=false;window.dispatchEvent(new Event('fixture-modal'));});
  await page.getByRole('dialog').waitFor();
  assert.equal(await connect.evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: real batch dialog/hooks; both themes at 320/390/768/1280; reachable mobile actions; draft persistence and amount validation; wallet casing/picker focus; one-approval managed launches, editing/removing platforms after reopening, connected-wallet rejection and retry.');
}catch(error){console.error(await browser?.contexts()[0]?.pages()[0]?.locator('body').innerText());console.error(await browser?.contexts()[0]?.pages()[0]?.evaluate(()=>fixture.calls.slice(-6)));throw error;}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
