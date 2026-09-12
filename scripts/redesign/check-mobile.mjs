import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
await fs.mkdir('/private/tmp/hive-redesign-qa', {recursive:true});
const tabs = await (await fetch(base+'/json/list')).json();
const tab = tabs.find(t=>t.type==='page' && t.url==='about:blank') || tabs.find(t=>t.type==='page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let counter=0;const pending=new Map();const errors=[];
ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result)}}else if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
const shot=async(name,full=false)=>{const m=await send('Page.getLayoutMetrics');const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(full?{clip:{x:0,y:0,width:m.cssContentSize.width,height:m.cssContentSize.height,scale:1}}:{})});await fs.writeFile('/private/tmp/hive-redesign-qa/'+name+'.png',Buffer.from(data.data,'base64'));};

await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Runtime.enable');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Page.navigate',{url:'http://localhost:3100/'});await sleep(1800);
const results=[];
for(const theme of ['light','dark']){await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[600,800],[601,800],[760,800],[761,800],[768,1024],[844,390],[932,430]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(120);
 results.push({theme,width,height,...await evaluate(`(()=>{
 const shown=e=>{if(e.closest('details:not([open])')&&!e.matches('summary'))return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('svg')};
 const text=[];const controls=[];
 for(const e of document.querySelectorAll('[data-hive-site] *')){if(!shown(e))continue;
 for(const n of e.childNodes){if(n.nodeType!==3||!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects()){if(b.left< -1||b.right>innerWidth+1)text.push({text:n.textContent.trim().slice(0,45),left:Math.round(b.left),right:Math.round(b.right)})}}
 if(e.matches('button,a,summary,input,textarea')&& !e.matches('[class*=skipLink]')){const r=e.getBoundingClientRect();if(r.x< -1||r.right>innerWidth+1)controls.push({text:e.textContent.slice(0,30),x:r.x,right:r.right});}
 }
 const header=[...document.querySelectorAll('header a,header button,header summary')].filter(shown).map(e=>({text:e.textContent||e.getAttribute('aria-label'),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right}));
 return {overflow:document.documentElement.scrollWidth>innerWidth,text,controls,header};})()`)});
 if(theme==='dark'&&[320,390,601,844].includes(width)){await evaluate(`(async()=>{for(const e of document.querySelectorAll('main>section')){e.scrollIntoView({behavior:'instant'});await new Promise(r=>setTimeout(r,100));}})()`);await evaluate('window.scrollTo({top:0,behavior:"instant"})');await shot('audit-'+width+'-hero');const m=await send('Page.getLayoutMetrics');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:m.cssContentSize.height,scale:1}});await fs.writeFile('/private/tmp/hive-redesign-qa/audit-'+width+'-full.png',Buffer.from(s.data,'base64'));}
}
}
await send('Emulation.setDeviceMetricsOverride',{width:667,height:320,deviceScaleFactor:1,mobile:true});
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await evaluate('document.querySelector("[class*=mobileMenu]").open=true');
const menu=await evaluate('(()=>{const e=document.querySelector("[class*=mobileMenu] nav");return {bottom:e.getBoundingClientRect().bottom,height:innerHeight,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}})()');

await evaluate('document.querySelector("[class*=mobileMenu]").open=false');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await evaluate('window.scrollTo({top:0,behavior:"instant"})');await sleep(100);
const smooth=await evaluate(`new Promise(resolve=>{const link=document.querySelector('[aria-label="See work examples"]');link.click();const points=[scrollY];const timer=setInterval(()=>points.push(scrollY),50);setTimeout(()=>{clearInterval(timer);resolve({style:getComputedStyle(document.documentElement).scrollBehavior,points,target:document.getElementById('work').getBoundingClientRect().top,header:document.querySelector('header').offsetHeight});},1600)})`);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await sleep(200);const reduced=await evaluate('getComputedStyle(document.documentElement).scrollBehavior');
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
await evaluate(`(()=>{const nodes=[...document.querySelectorAll('[data-hive-site] *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('svg'));const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=sizes[i]*1.25+'px');window.scrollTo({top:0,behavior:'instant'});})()`);
const largeText=await evaluate(`(()=>{const els=[...document.querySelectorAll('header a,header button,header summary')].filter(e=>e.getBoundingClientRect().width&&!e.closest('details:not([open]) nav'));return {overflow:document.documentElement.scrollWidth>innerWidth,header:els.map(e=>({text:e.textContent||e.getAttribute('aria-label'),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})),fields:[...document.querySelectorAll('input,textarea')].map(e=>({id:e.id,size:getComputedStyle(e).fontSize}))}})()`);

await shot('audit-320-large-text');
await send('Page.reload');await sleep(1200);
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
const touchChecks=[];
for(const selector of ['[aria-label="Explore agent roles"] button','[aria-controls="work-preview"]','[aria-controls="task-walkthrough"]','[aria-controls="agent-anatomy"]']){
 const count=await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
 for(let i=0;i<count;i++){
  await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${i}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(100);
  const point=await evaluate(`(()=>{const e=document.querySelectorAll(${JSON.stringify(selector)})[${i}],r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(150);
  touchChecks.push({selector,index:i,selected:await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${i}].getAttribute('aria-pressed')==='true'`)});
 }
}

await fs.writeFile('/private/tmp/hive-redesign-qa/mobile-audit.json',JSON.stringify({results,menu,smooth,reduced,largeText,touchChecks},null,2));
const failures=[];
for(const result of results)if(result.overflow||result.text.length||result.controls.length)failures.push({layout:result});
for(const result of touchChecks)if(!result.selected)failures.push({touch:result});
if(menu.bottom>menu.height+1||menu.clientHeight>menu.height)failures.push({menu});
if(smooth.style!=='smooth'||new Set(smooth.points).size<4||smooth.target<smooth.header)failures.push({smooth});
if(reduced!=='auto')failures.push({reduced});
if(largeText.overflow||largeText.header.some((e,i)=>e.right>320||(i&&e.x<largeText.header[i-1].right)))failures.push({largeText});
console.log(JSON.stringify({layouts:results.length,touchChecks:touchChecks.length,failures},null,2));ws.close();process.exitCode=failures.length?1:0;


