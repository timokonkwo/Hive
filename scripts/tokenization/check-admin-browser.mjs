import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'hive-token-admin-'));
let browser,server;
try {
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {AgentTokensPanel} from '${root}components/redesign/admin/AgentTokensPanel';import foundation from '${root}components/redesign/foundation.module.css';
 const stats={stats:{totalLaunched:13,totalQueued:0,totalFailed:0,byChain:{solana:12,robinhood:1},launchesThisMonth:1,launchesToday:1,walletBalance:.2531,walletAddress:'8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z'},revenue:{totalClaimable:.006046,perTokenFees:[{name:'Research Agent',symbol:'RESEARCH',mintAddress:'test',lifetimeFees:.003,bagsUrl:'https://bags.fm/test'}]},recentLaunches:[{id:'sage',agentName:'Sage Agent',tokenSymbol:'SAGE',chain:'Robinhood',status:'launched',createdAt:'2026-10-19T23:03:48Z',tradeUrl:'https://www.ponsfamily.com/launchpad/0x'+'1'.repeat(40)}]};
 stats.feeSources=[{source:'bags-creator',totalClaimable:.006046,error:null},{source:'bags-deployer',totalClaimable:.001,error:null},{source:'pump',totalClaimable:.002,error:null}];
 const f=window.fixture={stats,fail:false,claim:null,postCount:0,statusFail:false,dropResponse:false,requests:[]};
 const request=async(url,options={})=>{f.requests.push({url,method:options.method||'GET'});await new Promise(r=>setTimeout(r,50));if(options.method==='POST'){f.postCount++;f.claim={source:JSON.parse(options.body).source,pending:true,confirmed:0,failed:0,message:'Confirming fee claims…',transactions:[{signature:'a'.repeat(88),confirmed:false}]};if(f.dropResponse)throw Error('lost response');return Response.json({claim:f.claim},{status:202});}if(url.includes('claimStatus'))return f.statusFail?Response.json({error:'offline'},{status:503}):Response.json({claim:f.claim});if(f.fail)return Response.json({error:'offline'},{status:503});return Response.json(f.stats);};
 createRoot(document.getElementById('root')).render(<main className={foundation.surface} style={{padding:'24px',maxWidth:'1100px',margin:'0 auto'}}><AgentTokensPanel request={request}/></main>);`;
 await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,jsx:'automatic',format:'iife',outfile:dir+'/app.js',external:['/redesign/fonts/*']});
 const html='<html data-hive-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0}*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script></html>';
 server=http.createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(['/app.js','/app.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('js')?'application/javascript':'text/css');res.end(await readFile(dir+req.url));}else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);const claim=page.getByRole('button',{name:'Claim Bags creator fees',exact:true});await claim.waitFor();await page.waitForFunction(()=>!document.querySelector('button[class*="primary"]').disabled);
 for(const theme of ['dark','light'])for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.hiveTheme=t,theme);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${theme}/${width} overflow`);
  assert.equal(await claim.evaluate(el=>getComputedStyle(el).color),'rgb(24, 32, 21)');
  assert.equal(await claim.evaluate(el=>el.getBoundingClientRect().height>=44),true);
  await page.screenshot({path:`/tmp/hive-token-admin-${theme}-${width}.png`,fullPage:true});
 }
 await page.evaluate(()=>fixture.fail=true);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').filter({hasText:'last successful refresh'}).waitFor();assert.equal(await claim.isDisabled(),true);
 await page.evaluate(()=>{fixture.fail=false;fixture.stats.revenue.error='Solana fee data unavailable';fixture.stats.revenue.totalClaimable=null;fixture.stats.feeSources[0].error='Fee data unavailable';fixture.stats.feeSources[0].totalClaimable=null;});await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText('Unavailable',{exact:false}).first().waitFor();assert.equal(await claim.isDisabled(),true);
 await page.evaluate(()=>{fixture.stats.revenue.error=null;fixture.stats.revenue.totalClaimable=.006046;fixture.stats.feeSources[0].error=null;fixture.stats.feeSources[0].totalClaimable=.006046;});await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('button[class*="primary"]').disabled);
 await claim.evaluate(el=>{el.click();el.click();});await page.getByRole('link',{name:'Pending transaction 1'}).waitFor();assert.equal(await page.evaluate(()=>fixture.postCount),1);
 assert.equal(await page.getByRole('button',{name:'Claiming fees…',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{fixture.claim.pending=false;fixture.claim.confirmed=1;fixture.claim.message='1 fee claim confirmed.';fixture.claim.transactions[0].confirmed=true;});await page.getByRole('button',{name:'Check status',exact:true}).click();await page.getByRole('link',{name:'Confirmed transaction 1'}).waitFor();
 await page.evaluate(()=>{fixture.dropResponse=true;});await claim.click();await page.getByRole('alert').filter({hasText:'interrupted'}).waitFor();assert.equal(await page.getByRole('button',{name:'Claiming fees…',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('link',{name:'Pending transaction 1'}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Claim Bags deployer fees',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Claim pump.fun creator fees',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS admin layout at 320/390/768/1440, both themes, contrast, stale/error/unknown balances, duplicate-click guard, pending recovery and confirmed explorer links');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
