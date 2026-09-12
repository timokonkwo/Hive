import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
const site = process.env.HIVE_PREVIEW_URL || 'http://localhost:3100';
await fs.mkdir('/private/tmp/hive-redesign-qa',{recursive:true});
const tabs = await (await fetch(base+'/json/list')).json();
const tab = tabs.find(t=>t.type==='page' && t.url==='about:blank') || tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let counter=0;const pending=new Map();const errors=[];
ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result)}}else if(v.method==='Fetch.requestPaused'){void intercept(v.params);}else if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value};
const shot=async(name,full=false)=>{const m=await send('Page.getLayoutMetrics');const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(full?{clip:{x:0,y:0,width:m.cssContentSize.width,height:m.cssContentSize.height,scale:1}}:{})});await fs.writeFile('/private/tmp/hive-redesign-qa/'+name+'.png',Buffer.from(data.data,'base64'));};

const checks=[];const requests=[];let mode='real';let delayed=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});if(!pass)console.error('FAIL',name,detail||'');};
const until=async(expression)=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timed out: '+expression);};
const settled=()=>until(`!!document.querySelector('[data-create-task]') && !document.querySelector('main').innerText.includes('Loading your draft')`);
const reviewsReady=()=>until(`document.querySelector('[aria-label="Client review list"]')?.getAttribute('aria-busy')==='false'`);
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until(`document.readyState==='complete'`);await settled();await sleep(500);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
const aid='69d4a15da63b69b835bdf914', tid='0123456789abcdef01234567';
let writes=0;
async function intercept(e){
 const path=new URL(e.request.url).pathname;
 if(e.request.method!=='GET'){writes++;return send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:403,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{"error":"Browser QA blocks writes"}').toString('base64')});}
 if(mode==='real' || !path.startsWith('/api/agents/'))return send('Fetch.continueRequest',{requestId:e.requestId});
 const payload=mode==='missing'?{error:'Not found'}:mode==='malformed'?{agent:{id:'wrong',name:'Other'}}:{agent:{id:aid,name:mode==='long'?'Agent'.repeat(70):'Sage',status:mode==='inactive'?'pending':'active'}};
 return send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:mode==='missing'?404:mode==='error'?500:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(payload)).toString('base64')});
}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(80);}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Fetch.enable',{patterns:[{urlPattern:'*/api/tasks*',requestStage:'Request'},{urlPattern:'*/api/agents/*',requestStage:'Request'}]});
await navigate('/create');await evaluate(`sessionStorage.removeItem('hive_create_task_draft');sessionStorage.removeItem('hive_create_task_attempt_v1')`);await navigate('/create');
check('New task editor uses app shell',await evaluate(`document.querySelector('h1').innerText==='What do you need done?' && !!document.querySelector('[aria-label="App navigation"]') && document.querySelectorAll('h1').length===1`));
await click('button[type="submit"]');check('Empty review focuses first invalid field',await evaluate(`document.activeElement.id==='title' && !!document.querySelector('#title-error') && !!document.querySelector('#budget-error')`));
await input('#title','Compare lending fees');await input('#category','Research');await input('#description','Compare the fees in the supplied documents. Include a table and a link to each source.');await input('#requirements','Return a Markdown report with a comparison table.');await input('#checklist','Include each source link\nState the date of each quote');await input('#budget','25.50');
await click('button[type="submit"]');
check('Review shows full brief and exact budget',await evaluate(`document.querySelector('h1').innerText==='Review your task' && document.querySelector('main').innerText.includes('25.50 USDC') && document.querySelector('main').innerText.includes('State the date of each quote')`));
await until(`document.querySelector('button[type="submit"]').innerText==='Sign in to post'`);
check('Posting requires sign-in and does not transfer funds',await evaluate(`document.querySelector('main').innerText.includes('Posting a task does not transfer funds.') && document.querySelector('button[type="submit"]').innerText==='Sign in to post'`));
await evaluate(`localStorage.setItem('hive-redesign-theme','light');dispatchEvent(new Event('storage'))`);await sleep(100);await shot('create-review-light-1440',true);
await click('button[type="submit"]');await until(`!!document.querySelector('[role="dialog"]')`);
check('Sign-in opens a dialog without posting',await evaluate(`!!document.querySelector('[role="dialog"]') && document.querySelector('h1').innerText==='Review your task'`));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(300);
await until(`!document.querySelector('[role="dialog"]')`);
await click('button[type="button"][class*="textButton"]');
check('Edit restores fields without losing text',await evaluate(`document.querySelector('#title').value==='Compare lending fees' && document.querySelector('#budget').value==='25.50'`));
await send('Page.reload');await settled();await until(`document.querySelector('#title')?.value==='Compare lending fees'`);
check('Reload restores complete session draft',await evaluate(`document.querySelector('#checklist').value.includes('each quote') && document.querySelector('#requirements').value.includes('Markdown')`));
for(const theme of ['light','dark']){
 await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');dispatchEvent(new Event('storage'))`);
 for(const width of [320,375,390,600,700,768,900,1024,1100,1280,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<1100});await sleep(80);
  const layout=await evaluate(`(()=>{const bad=[];for(const e of document.querySelectorAll('main input,main textarea,main select,main h1,main button,header a,header button')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5)bad.push(e.textContent.slice(0,40)||e.id);}return{overflow:document.documentElement.scrollWidth>innerWidth,bad}})()`);
  check(theme+' '+width+'px content bounds',!layout.overflow&&!layout.bad.length,layout);
  if([320,390,1440].includes(width)){await evaluate(`scrollTo({top:0,behavior:'instant'})`);await shot('create-brief-'+theme+'-'+width,true);}
 }
}
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
await click('button[type="submit"]');await shot('create-review-dark-320',true);
check('Mobile review has no horizontal overflow',await evaluate(`document.documentElement.scrollWidth===innerWidth`));
await click('button[type="button"][class*="textButton"]');
await input('#category','Token Launch');await click('main details summary');await input('#tokenName','Example');
await click('button[type="submit"]');
check('Conditional token errors open disclosure and focus missing field',await evaluate(`document.activeElement.id==='tokenSymbol' && document.querySelector('main details').open`));
await input('#tokenSymbol','EX');await input('#tokenDescription','Token details for the task.');await click('button[type="submit"]');
check('Review includes token details and actual supported chain',await evaluate(`document.querySelector('main').innerText.includes('Example (EX)') && document.querySelector('main').innerText.includes('Bags · Solana')`));
await navigate('/create?agent='+aid);await until(`document.querySelector('aside[aria-label="Budget and agent"]').innerText.includes('Sage')`);
check('Real profile handoff resolves correct selected agent',await evaluate(`new URL(location.href).searchParams.get('agent')==='${aid}' && document.querySelector('aside[aria-label="Budget and agent"]').innerText.includes('Sage')`));
await send('Page.reload');await settled();await until(`document.querySelector('aside[aria-label="Budget and agent"]').innerText.includes('Sage')`);
check('Selection persists through reload',await evaluate(`!!document.querySelector('a[href="/agent/Sage"]')`));
for(const state of ['inactive','missing','error','malformed','long']){mode=state;await navigate('/create?agent='+aid);await until(`!document.querySelector('aside[aria-label="Budget and agent"]').innerText.includes('Loading selected agent')`);await click('button[type="submit"]');
 if(state==='long')check('Long selected-agent names wrap',await evaluate(`document.documentElement.scrollWidth===innerWidth`));
 else check(state+' selection blocks posting',await evaluate(`document.querySelector('button[type="submit"]').disabled && /cannot be assigned|not found|could not be loaded/.test(document.querySelector('aside[aria-label="Budget and agent"]').innerText)`));
}
mode='real';await navigate('/create?agent=invalid');check('Invalid selection remains explicit',await evaluate(`document.querySelector('main').innerText.includes('selected agent link is invalid')`));
await click('aside button[class*="textButton"]',1);await until(`!new URL(location.href).searchParams.has('agent')`);check('Deliberate removal restores choice',await evaluate(`!!document.querySelector('input[name="method"]')`));
await click('input[name="price"][value="negotiable"]');await click('input[name="method"]',1);await click('button[type="submit"]');
check('Negotiable and automatic choice are explicit in review',await evaluate(`document.querySelector('main').innerText.includes('Negotiable') && document.querySelector('main').innerText.includes('Hive will choose and assign')`));
await click('[aria-label="App navigation menu"]');check('Mobile navigation opens',await evaluate(`document.querySelector('[aria-label="Mobile app navigation"]').checkVisibility()`));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});check('Escape closes menu and restores focus',await evaluate(`document.activeElement.getAttribute('aria-label')==='App navigation menu'`));
// Receipt fixtures live only in this isolated tab. No create/assign request is made.
for(const kind of ['created','assigned','assignment-failed','unknown']){
 await evaluate(`sessionStorage.setItem('hive_create_task_attempt_v1',JSON.stringify(${JSON.stringify(kind==='unknown'?{pending:true}:{receipt:{kind,id:tid,agentId:aid,agentName:'Sage'}})}))`);await navigate('/create');
 check(kind+' receipt is recoverable without a duplicate create',await evaluate(kind==='unknown'?`document.querySelector('h1').innerText==='Check your task' && !document.querySelector('form') && !!document.querySelector('main a[href="/dashboard"]')`:`!!document.querySelector('main a[href="/marketplace/${tid}"]') && !document.querySelector('form')`));
 if(kind==='assignment-failed')check('Partial result never claims assignment success',await evaluate(`document.querySelector('h1').innerText==='Task created. Assignment incomplete.' && document.querySelector('main').innerText.includes('could not confirm')`));
}
check('Unknown result requires checking tasks before fresh start',await evaluate(`document.querySelector('main button').disabled`));
await evaluate(`sessionStorage.removeItem('hive_create_task_attempt_v1');sessionStorage.removeItem('hive_create_task_draft')`);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await navigate('/create');await sleep(700);
check('Element entrances finish without hiding the form',await evaluate(`[...document.querySelectorAll('[data-create-enter]')].every(e=>getComputedStyle(e).opacity==='1' && getComputedStyle(e).transform==='none')`));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate('/create');check('Reduced motion leaves form visible',await evaluate(`[...document.querySelectorAll('[data-create-enter]')].every(e=>getComputedStyle(e).opacity==='1')`));
check('No task writes were attempted',writes===0,{writes});check('No runtime exceptions',errors.length===0,errors);
await send('Fetch.disable');await fs.writeFile('/private/tmp/hive-redesign-qa/create-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,failures:checks.filter(x=>!x.pass)},null,2));ws.close();process.exitCode=checks.some(x=>!x.pass)?1:0;
