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

await navigate('/admin');await until(`document.querySelector('[data-admin-state="allowed"]')&&document.body.innerText.includes('Review the agent payment integration')`);
check('Verified admin has desktop Admin link',await evaluate(`!!document.querySelector('nav[aria-label="App navigation"] a[href="/admin"]')`));
const sections=['overview','tasks','agents','submissions','stakers','dao','tokens','feedback','roadmap','activity'];
for(const section of sections){
 await evaluate(`history.pushState({},'', '/admin?section=${section}');dispatchEvent(new Event('popstate'))`);await sleep(500);
 check(section+' has a rendered workspace',await evaluate(`document.querySelector('[data-admin-state="allowed"]')&&!!document.querySelector('nav[aria-label="Admin sections"] [aria-current]')`));
 for(const theme of ['dark','light']){await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');dispatchEvent(new Event('storage'))`);for(const width of [320,390,768,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<600});await sleep(60);const d=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth})`);check(section+' '+theme+' '+width+' fits',d.scroll<=d.width,d);}}
 if(section==='overview'){await shot('admin-overview-light-1440');await send('Emulation.setDeviceMetricsOverride',{width:390,height:960,deviceScaleFactor:1,mobile:true});await shot('admin-overview-light-390');}
 if(section==='tasks')await shot('admin-tasks-light-1440');
}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
await evaluate(`history.pushState({},'', '/admin?section=tasks');dispatchEvent(new Event('popstate'))`);await sleep(500);
await click('input[aria-label="Select all tasks on this page"]');await button('Delete Selected');await until(`document.querySelector('dialog[open]')`);
check('Bulk delete names target before sending anything',await evaluate(`document.querySelector('dialog').innerText.includes('Review the agent payment integration')&&!window.qa.requests.some(r=>r.method!=='GET')`));await escape();check('Escape closes confirmation',await evaluate(`!document.querySelector('dialog[open]')`));
await evaluate(`window.qa.fail=true`);await click('button[aria-label="Refresh admin data"]');await sleep(500);check('Failed read has visible retry',await evaluate(`document.querySelector('[role="alert"]')?.innerText.includes('Try again')`));await evaluate(`window.qa.fail=false`);await button('Try again');await sleep(500);check('Retry recovers from failed read',await evaluate(`!document.querySelector('[role="alert"]')`));
await click('summary[aria-label="Account menu"]');check('Connected wallet shows Change wallet and address',await evaluate(`document.querySelector('[data-account-state="signed-in"]').innerText.includes('Change wallet')&&document.querySelector('[data-account-state="signed-in"]').innerText.includes('Connected')`));await escape();
await evaluate(`window.qa.connected=false;dispatchEvent(new Event('qa-change'))`);await click('summary[aria-label="Account menu"]');check('Disconnected wallet shows Connect wallet',await evaluate(`document.querySelector('[data-account-state="signed-in"]').innerText.includes('Connect wallet')&&!document.querySelector('[data-account-state="signed-in"]').innerText.includes('Connected')`));await escape();
for(const role of ['denied','error','signed-out','loading']){await evaluate(`window.qa.role='${role}';dispatchEvent(new Event('qa-change'))`);await sleep(100);check(role+' hides admin sidebar entry and workspace',await evaluate(`!document.querySelector('nav[aria-label="App navigation"] a[href="/admin"]')&&!document.querySelector('nav[aria-label="Admin sections"]')`));}
await evaluate(`window.qa.role='allowed';dispatchEvent(new Event('qa-change'))`);await sleep(500);await send('Emulation.setDeviceMetricsOverride',{width:320,height:960,deviceScaleFactor:1,mobile:true});await click('summary[aria-label="App navigation menu"]');check('Admin appears in mobile app navigation',await evaluate(`!!document.querySelector('nav[aria-label="Mobile app navigation"] a[href="/admin"]')`));await escape();
check('No runtime exceptions',errors.length===0,errors.map(e=>e.exception?.description||e.text));check('No administrative writes were sent',await evaluate(`!window.qa.requests.some(r=>r.method!=='GET')`));
await fs.writeFile('/private/tmp/hive-redesign-qa/admin-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)},null,2));ws.close();process.exitCode=checks.some(c=>!c.pass)?1:0;
