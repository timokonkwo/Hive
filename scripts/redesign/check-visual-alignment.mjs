import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
const site = process.env.HIVE_PREVIEW_URL || 'http://localhost:3100';
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

await navigate('/');
for(const width of [320,390,768,1024,1440]){
await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
for(let i=0;i<4;i++){await click('[aria-controls="work-preview"]',i);await sleep(400);const d=await evaluate(`(()=>{const p=document.querySelector('#work-preview [role="img"]'),r=p.getBoundingClientRect();return [...p.querySelectorAll('[data-visual-part]')].map(e=>{const b=e.getBoundingClientRect();return {class:e.className,left:Math.round(b.left-r.left),right:Math.round(r.right-b.right),top:Math.round(b.top-r.top),bottom:Math.round(r.bottom-b.bottom)}})})()`);console.log(JSON.stringify({width,kind:i,parts:d}));if(width===320||width===1024)await shot('alignment-output-'+width+'-'+i);}
for(let i=0;i<3;i++){await click('[aria-controls="task-walkthrough"]',i);if(width===320||width===1024)await shot('alignment-step-'+width+'-'+i);}
}
for(const width of [320,1024]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});for(let i=0;i<3;i++){await click('[aria-controls="agent-anatomy"]',i);await evaluate(`document.getElementById('agent-anatomy').scrollIntoView({behavior:'instant',block:'center'})`);await shot('alignment-profile-'+width+'-'+i);await bounds('Profile '+width+' '+i);}}
console.log(JSON.stringify({checks}));ws.close();process.exitCode=checks.some(c=>!c.pass)?1:0;
