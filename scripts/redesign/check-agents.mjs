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
const settled=()=>until(`document.querySelector('[aria-label="Agent directory"]')?.getAttribute('aria-busy')==='false'`);
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until(`!!document.querySelector('#agents-main')`);await settled();await sleep(400);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
const choose=async(value)=>{await evaluate(`(()=>{const e=document.querySelector('select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(100);};
const fixture=Array.from({length:25},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),name:i===0?'C++ / ETH & Research':'Agent '+(i+1),bio:'Compare lending fees and withdrawal requirements. Return a report with sources.',capabilities:['Research','Analysis'],completedTasks:i,reputation:100-i,reviewCount:i===0?0:i,avgSatisfaction:i===0?0:4.5,totalProposals:i+100}));
async function reply(id,body,status=200){await send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
async function intercept(event){
 const u=new URL(event.request.url);requests.push(u.search);
 if(mode==='error')return reply(event.requestId,{error:'Failed'},500);
 if(mode==='rate')return reply(event.requestId,{error:'Limited'},429);
 if(mode==='malformed')return reply(event.requestId,{agents:[{name:'missing identity'}],total:1});
 if(mode==='empty')return reply(event.requestId,{agents:[],total:0});
 if(mode==='slow' && u.searchParams.get('sort')==='completed'){delayed.push(event.requestId);return;}
 let list=fixture;
 if(mode==='long')list=[{...fixture[0],name:'Agent'.repeat(28),bio:'Requirements '.repeat(100),capabilities:['Unbroken'.repeat(20),'Research','Code review','More skills'],completedTasks:null,reputation:500,reviewCount:null,avgSatisfaction:0}];
 const search=u.searchParams.get('search');if(search)list=list.filter(x=>x.name.toLowerCase().includes(search.toLowerCase()));
 list=[...list].sort((a,b)=>u.searchParams.get('sort')==='completed'?b.completedTasks-a.completedTasks:b.reputation-a.reputation);
 const page=Number(u.searchParams.get('page')||1);return reply(event.requestId,{agents:list.slice((page-1)*12,page*12),total:list.length});
}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await navigate('/agents');
check('Directory ratings include a star',await evaluate(`!!document.querySelector('[data-agent-row] .lucide-star')`));

check('Actual public directory loads',await evaluate(`document.querySelectorAll('[data-agent-row]').length>0`));
check('Compact app shell and Agents tab',await evaluate(`document.querySelector('h1').innerText==='Agents' && document.querySelector('[aria-label="Browse marketplace"] a[aria-current="page"]').getAttribute('href')==='/agents'`));
check('Public values bind to rows',await evaluate(`(async()=>{const data=await(await fetch('/api/leaderboard?limit=12&page=1&sort=reputation')).json();const row=document.querySelector('[data-agent-row]');return row.dataset.agentRow===data.agents[0].id && row.innerText.includes(data.agents[0].name) && row.querySelector('dd').textContent===data.agents[0].completedTasks.toLocaleString('en');})()`));
check('Completed sort is descending in actual endpoint',await evaluate(`(async()=>{const d=await(await fetch('/api/leaderboard?limit=12&sort=completed')).json();return d.sortBy==='completed' && d.agents.every((a,i)=>!i || a.completedTasks<=d.agents[i-1].completedTasks);})()`));
check('Malformed page and limit have valid defaults',await evaluate(`(async()=>{const d=await(await fetch('/api/leaderboard?page=NaN&limit=-2')).json();return d.page===1 && d.limit===20;})()`));
check('Avatars generated locally',await evaluate(`[...document.querySelectorAll('[data-agent-row] img')].every(e=>e.src.startsWith('data:image/svg+xml') && e.complete && e.naturalWidth>0)`));
for(const theme of ['light','dark']){
 await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
 for(const width of [320,375,390,600,760,768,1024,1100,1280,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<1100});await sleep(120);
  const layout=await evaluate(`(()=>{const bad=[];for(const e of document.querySelectorAll('main button, main input, main select, [data-agent-row] dt, [data-agent-row] dd, [data-agent-row] h2')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();if(r.left<-.5 || r.right>innerWidth+.5 || e.scrollWidth>e.clientWidth+1)bad.push(e.textContent.slice(0,80)||e.tagName)}return{overflow:document.documentElement.scrollWidth>innerWidth,bad}})()`);
  check(theme+' '+width+'px readable bounds',!layout.overflow&&!layout.bad.length,layout);
  if([320,390,1440].includes(width)){await evaluate(`scrollTo({top:0,behavior:'instant'})`);await shot('agents-live-'+theme+'-'+width);}
 }
}
await send('Fetch.enable',{patterns:[{urlPattern:'*/api/leaderboard*',requestStage:'Request'}]});mode='fixture';await navigate('/agents');
check('Twelve rows per page',await evaluate(`document.querySelectorAll('[data-agent-row]').length===12`));
check('Zero completed work and no reviews remain explicit',await evaluate(`document.querySelector('[data-agent-row] dd').textContent==='0' && document.querySelector('[data-agent-row]').innerText.includes('No reviews')`));
check('No fake ranks or execution count',await evaluate(`!/(Elite|Rising|Veteran|executions|success rate)/i.test(document.querySelector('main').innerText)`));
check('Profile name is one encoded path segment',await evaluate(`document.querySelector('[data-agent-row] h2 a').getAttribute('href')==='/agent/'+encodeURIComponent('C++ / ETH & Research')`));
await click('[aria-label="Next page"]');await until(`new URL(location.href).searchParams.get('page')==='2'`);await settled();
check('Pagination updates range and focus',await evaluate(`document.querySelector('[aria-label="Agent pages"]').innerText.includes('13–24 of 25') && document.activeElement.querySelector('[role="status"]')!==null`));
await send('Page.reload');await settled();check('Reload retains page',await evaluate(`new URL(location.href).searchParams.get('page')==='2'`));
await choose('completed');await until(`new URL(location.href).searchParams.get('sort')==='completed'`);await settled();
check('Sort resets page and binds sorted data',await evaluate(`!new URL(location.href).searchParams.has('page') && document.querySelector('[data-agent-row] dd').textContent==='24'`));
await evaluate('history.back()');await until(`new URL(location.href).searchParams.get('page')==='2'`);await settled();check('Back restores page and sort',await evaluate(`document.querySelector('select').value==='reputation'`));
await click('#agent-search');await send('Input.insertText',{text:'C++ / ETH & Research'});await click('form[role="search"] button');await until(`new URL(location.href).searchParams.has('search')`);await settled();
check('Search is encoded and matched',requests.at(-1).includes('C%2B%2B+%2F+ETH+%26+Research')&&await evaluate(`document.querySelectorAll('[data-agent-row]').length===1`));
await click('[aria-label="Clear search"]');await until(`!new URL(location.href).searchParams.has('search')`);await settled();
await click('#agent-search');await send('Input.insertText',{text:'No match [fees].*'});await click('form[role="search"] button');await until(`new URL(location.href).searchParams.has('search')`);await settled();check('No matches recovery',await evaluate(`document.querySelector('main').innerText.includes('No agents match your search.')`));
await navigate('/agents?page=999');check('Out-of-range recovery',await evaluate(`document.querySelector('main').innerText.includes('This page has no agents.')`));
await click('section button');await until(`!new URL(location.href).searchParams.has('page')`);await settled();
mode='long';await navigate('/agents');
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
await click('[class*="service"] summary');check('Long service can be read',await evaluate(`document.querySelector('[class*="service"]').open && document.querySelector('[class*="service"] p').textContent.length>1000`));
check('Missing metrics stay missing',await evaluate(`document.querySelector('[data-agent-row]').innerText.includes('Not listed') && !document.querySelector('[data-agent-row]').innerText.includes('500')`));
check('Long names and skills do not overflow',await evaluate(`document.documentElement.scrollWidth===innerWidth && [...document.querySelectorAll('[data-agent-row] h2, [class*="skills"] li')].every(e=>e.scrollWidth<=e.clientWidth+1)`));
await evaluate(`document.querySelector('[data-agent-row] img').dispatchEvent(new Event('error'))`);await sleep(100);check('Avatar failure has visible identity fallback',await evaluate(`!document.querySelector('[data-agent-row] img') && document.querySelector('[class*="avatar"]').textContent.length===2`));
await click('[aria-label="App navigation menu"]');check('Mobile navigation opens',await evaluate(`document.querySelector('[aria-label="Mobile app navigation"]').checkVisibility()`));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});check('Escape restores menu focus',await evaluate(`document.activeElement.getAttribute('aria-label')==='App navigation menu'`));
for(const state of ['empty','error','rate','malformed']){mode=state;await navigate('/agents');const content=await evaluate(`document.querySelector('main').innerText`);check(state+' state shown',state==='empty'?content.includes('No agents listed yet.'):state==='rate'?content.includes('Too many requests'):content.includes('We could not load the agents.'));}
mode='fixture';await click('section button');await settled();check('Retry recovers',await evaluate(`document.querySelectorAll('[data-agent-row]').length===12`));
mode='slow';await choose('completed');await until(`document.querySelector('[aria-label="Agent directory"]').getAttribute('aria-busy')==='true'`);check('Old rows hidden while request is pending',await evaluate(`document.querySelectorAll('[data-agent-row]').length===0`));
await choose('reputation');await settled();for(const id of delayed){try{await reply(id,{agents:[fixture[24]],total:1});}catch{}}await sleep(350);check('Late responses cannot overwrite new selection',await evaluate(`document.querySelectorAll('[data-agent-row]').length===12 && document.querySelector('[data-agent-row]').dataset.agentRow==='000000000000000000000001'`));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});mode='fixture';await click('[aria-label="Refresh agents"]');await settled();await sleep(800);check('Rows finish their entrance',await evaluate(`[...document.querySelectorAll('[data-agent-row]')].every(e=>getComputedStyle(e).opacity==='1' && getComputedStyle(e).transform==='none')`));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await click('[aria-label="Refresh agents"]');await settled();check('Reduced motion keeps rows visible',await evaluate(`getComputedStyle(document.querySelector('[data-agent-row]')).opacity==='1'`));
check('No runtime exceptions',errors.length===0,errors);
await send('Fetch.disable');mode='real';await navigate('/agents');
await fs.writeFile('/private/tmp/hive-redesign-qa/agents-results.json',JSON.stringify(checks,null,2));
console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,failures:checks.filter(x=>!x.pass)},null,2));ws.close();process.exitCode=checks.some(x=>!x.pass)?1:0;
