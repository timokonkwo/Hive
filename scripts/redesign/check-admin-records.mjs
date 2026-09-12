import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
const site = process.env.HIVE_PREVIEW_URL || 'http://127.0.0.1:3112';
await fs.mkdir('/private/tmp/hive-redesign-qa',{recursive:true});
const tabs = await (await fetch(base+'/json/list')).json();
const tab = await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
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
const until=async(expression)=>{for(let i=0;i<80;i++){if(await evaluate(`!!(${expression})`))return;await sleep(100);}throw new Error('Timed out: '+expression);};
const settled=()=>until(`!!document.querySelector('main')`);
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until(`document.readyState==='complete'`);await settled();await sleep(500);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(80);}
async function button(label){await evaluate(`(()=>{document.querySelector('[data-qa-click]')?.removeAttribute('data-qa-click');const b=[...document.querySelectorAll('main button,dialog button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.setAttribute('data-qa-click','true');})()`);await click('[data-qa-click]');}
async function escape(){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(100);}
async function bounds(label){const d=await evaluate(`(()=>{const bad=[...document.querySelectorAll('main button,main input,main select,main textarea,header a,header button')].filter(e=>e.checkVisibility()&&e.getAttribute('aria-hidden')!=='true').filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).map(e=>e.textContent.slice(0,30));return{overflow:document.documentElement.scrollWidth>innerWidth,bad}})()`);check(label,!d.overflow&&!d.bad.length,d);}



async function intercept(e){return send('Fetch.continueRequest',{requestId:e.requestId});}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});


await navigate('/admin?section=tasks');await until(`document.querySelector('tbody tr')`);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:960,deviceScaleFactor:1,mobile:true});await evaluate(`localStorage.setItem('hive-redesign-theme','dark');dispatchEvent(new Event('storage'))`);await sleep(150);await shot('admin-tasks-dark-390',true);
check('Mobile task actions fit without horizontal scrolling',await evaluate(`(()=>{const r=document.querySelector('tbody tr').getBoundingClientRect();return r.width<=innerWidth&&[...document.querySelectorAll('tbody button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})})()`));
await click('button[aria-label^="Status for"]');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(300);
check('Status control sends the selected value through the authenticated handler fixture',await evaluate(`window.qa.requests.some(r=>r.method==='PATCH'&&JSON.parse(r.body).status==='In Progress')`));
await evaluate(`history.pushState({},'', '/admin?section=agents');dispatchEvent(new Event('popstate'))`);await sleep(500);await shot('admin-agents-dark-390',true);
check('Mobile agent actions fit',await evaluate(`[...document.querySelectorAll('tbody button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`));
await click('button[aria-label="Edit reputation for Atlas"]');check('Reputation edit has a labeled input',await evaluate(`!!document.querySelector('input[aria-label="Reputation for Atlas"]')`));await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});check('Escape cancels reputation edit',await evaluate(`!document.querySelector('input[aria-label="Reputation for Atlas"]')`));
await button('Launch token');await until(`document.querySelector('dialog[open]')`);check('Token launch names agent and effect before execution',await evaluate(`document.querySelector('dialog').innerText.includes('Atlas')&&document.querySelector('dialog').innerText.includes('Solana')&&!window.qa.requests.some(r=>r.method==='POST')`));await escape();
await click('button[aria-label="Delete Atlas"]');await until(`document.querySelector('dialog[open]')`);check('Delete confirmation names the selected agent',await evaluate(`document.querySelector('dialog').innerText.includes('Atlas')`));await button('Cancel');check('Cancel leaves the agent record intact',await evaluate(`!!document.querySelector('tbody tr')&&!window.qa.requests.some(r=>r.method==='DELETE')`));
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});await evaluate(`history.pushState({},'', '/admin?section=tasks');dispatchEvent(new Event('popstate'))`);await sleep(500);await shot('admin-tasks-dark-1440');
check('No runtime exceptions in record controls',errors.length===0,errors.map(e=>e.exception?.description||e.text));await fs.writeFile('/private/tmp/hive-redesign-qa/admin-records-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)},null,2));ws.close();process.exitCode=checks.some(c=>!c.pass)?1:0;
