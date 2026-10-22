// Fixture-backed checks of the real owner pages. No wallet or launch writes are allowed.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.HIVE_PREVIEW_URL||'http://localhost:3107';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage(),errors=[],launchRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 const first='0123456789abcdef01234567',second='1123456789abcdef01234567',key='hive_sk_'+'a'.repeat(48);
 const evm='0x'+'1'.repeat(40),sol='8CrDTtkdDr54LsB9vQi1PZzVNmAA1KHkcts2EAK9W11z';
 let id=first,tokens=[];
 const metadata=()=>({name:'Owner Research Agent',description:'Research agent on Hive.',symbol:'RESEARCH',avatarSeed:'fixture',socials:{website:`https://uphive.xyz/agent/id/${id}`,twitter:'',telegram:''}});
 await page.route('**/api/agents/**',async route=>{
   const r=route.request(),path=new URL(r.url()).pathname;
   const reply=body=>route.fulfill({json:body});
   if(path==='/api/agents/verify-pin')return reply({verified:true,agent:{id}});
   if(path==='/api/agents/me')return reply({agent:{id,name:metadata().name,status:'active',bio:metadata().description,capabilities:['Research'],agentTokens:tokens}});
   if(path==='/api/agents/me/work')return reply({agentId:id,tasks:[],total:0,page:1,pages:1});
   if(path==='/api/agents/me/opportunities')return reply({agentId:id,opportunities:[]});
   if(path==='/api/agents/payments')return reply({agentId:id,payments:[]});
   if(path.endsWith('/tokenization/session')) {
     launchRequests.push({path,method:r.method(),role:new URL(r.url()).searchParams.get('role'),key:r.headers()['x-hive-api-key']});
     assert.equal(r.method(),'GET','opening the owner dialog must not submit a launch');
     assert.equal(r.headers()['x-hive-api-key'],key);
     return reply({preview:{agentId:id,role:'owner',metadata:metadata(),issues:[],existingToken:null,requiredSigner:null,recipient:null,signingEnabled:true},profileRevision:'a'.repeat(64),tokens,session:null,review:null,readOnly:false,deployers:null,wallets:{evm:null,solana:null},options:['pons','bags','pump'].map(platform=>({platform,available:false,purchaseAvailable:true,token:tokens.find(t=>t.platform===platform),reason:'Verify your wallet in settings'}))});
   }
   return route.fulfill({status:403,json:{error:'Not permitted by owner browser fixture'}});
 });
 async function signIn(){await page.getByLabel('API key',{exact:true}).fill(key);await page.getByLabel('Owner PIN',{exact:true}).fill('123456');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('region',{name:'Current agent'}).waitFor();}
 for(const theme of ['light','dark'])for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/agent/dashboard',{waitUntil:'domcontentloaded'});
   await page.evaluate(theme=>document.documentElement.dataset.hiveTheme=theme,theme);
   assert.equal(await page.getByRole('button',{name:'Tokenize agent',exact:true}).count(),0);
   await signIn();
   const button=page.getByRole('button',{name:'Tokenize agent',exact:true});
   assert.equal(await button.isVisible(),true);
   assert.equal(await button.evaluate(el=>getComputedStyle(el).color),'rgb(24, 32, 21)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-owner-enter]')].every(el=>getComputedStyle(el).opacity==='1'));
   await page.screenshot({path:`/tmp/hive-owner-token-${theme}-${width}.png`});
   await button.click();await page.getByRole('dialog',{name:'Agent tokens',exact:true}).waitFor();
   await page.getByText(/Verify your wallet in settings/).first().waitFor();
   assert.equal(await page.getByText(/Verify your wallet in settings/).count(),3);
   assert.equal(await page.getByRole('radio',{name:'Hive deployer'}).count(),0);
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Agent tokens',exact:true}).waitFor({state:'detached'});
   await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-owner-token-action'));
   assert.equal(await button.evaluate(el=>el===document.activeElement),true);
   for(const name of ['Opportunities','Payments','Settings','Work']){await page.getByRole('navigation',{name:'Agent workspace'}).getByRole('link',{name,exact:true}).click();await button.waitFor();}
 }
 await page.getByRole('button',{name:'Switch agent',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Tokenize agent',exact:true}).count(),0);
 id=second;await signIn();await page.getByRole('button',{name:'Tokenize agent',exact:true}).click();
 await page.getByRole('dialog',{name:'Agent tokens',exact:true}).waitFor();
 assert.equal(launchRequests.at(-1).path,`/api/agents/${second}/tokenization/session`);
 assert.ok(launchRequests.every(r=>r.role==='owner'&&r.method==='GET'));
 await page.keyboard.press('Escape');
 tokens=[{platform:'pons',network:'robinhood',address:evm,symbol:'RESEARCH',transactionHash:'0x'+'a'.repeat(64)},
   {platform:'pump',network:'solana',address:sol,symbol:'RESEARCH',transactionHash:'2'.repeat(88)}];
 await page.reload({waitUntil:'domcontentloaded'});await signIn();
 await page.getByRole('button',{name:'Manage tokens',exact:true}).click();await page.getByRole('dialog',{name:'Agent tokens',exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.goto(origin+'/agent/dashboard/tools?view=tokens',{waitUntil:'domcontentloaded'});
 await page.getByLabel('API key',{exact:true}).fill(key);await page.getByLabel('Owner PIN',{exact:true}).fill('123456');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Manage tokens',exact:true}).waitFor();
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await page.getByRole('link',{name:'Trade on Pons',exact:true}).waitFor();await page.getByRole('link',{name:'Trade on pump.fun',exact:true}).waitFor();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Manage tokens',exact:true}).click();
 await page.getByRole('dialog',{name:'Agent tokens',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: actual owner pages, all workspace tabs, both themes at 320/390/1280, focus restoration, agent switching, existing-token management and multi-platform trade. No launch writes.');
}finally{await browser.close();}
