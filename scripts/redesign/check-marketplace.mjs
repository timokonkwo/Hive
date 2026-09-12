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
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until('!!document.querySelector("[data-hive-marketplace]")');await until('document.querySelector("[aria-label=Tasks]")?.getAttribute("aria-busy")==="false"');await sleep(150);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
const choose=async(label,value)=>{await evaluate(`(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(80);};
const settled=()=>until('document.querySelector("[aria-label=Tasks]")?.getAttribute("aria-busy")==="false"');
const fixture=Array.from({length:25},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),title:['Compare lending fees and withdrawal limits','Review the agent dashboard on mobile','Write a security review of the payment flow'][i%3]+' '+(i+1),category:['Research','Development','Security'][i%3],status:i===2?'Completed':'Open',budget:i===1?'Negotiable':`${(i+1)*25} USDC`,proposalsCount:i,description:'Review the supplied requirements. Provide a clear report with sources and proposed changes.',requirements:'Include the source links. Explain the limits of each finding.',tags:['review','research'],createdAt:new Date(Date.UTC(2026,8,10-i)).toISOString()}));
async function reply(id,body,status=200){await send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
async function intercept(event){
 const u=new URL(event.request.url);requests.push(u.search);
 if(mode==='error')return reply(event.requestId,{error:'database failure'},500);
 if(mode==='rate')return reply(event.requestId,{error:'Rate limited'},429);
 if(mode==='malformed')return reply(event.requestId,{tasks:[{title:'missing identifier'}],total:1});
 if(mode==='empty')return reply(event.requestId,{tasks:[],total:0});
 if(mode==='slow' && u.searchParams.get('category')==='Research'){delayed.push(event.requestId);return;}
 let list=fixture;
 if(mode==='long')list=[{...fixture[0],title:'Unbroken'.repeat(20),description:'Description '.repeat(250),requirements:'Requirements '.repeat(200),budget:null,proposalsCount:null,deadline:'2026-12-15T12:00:00Z'}];
 const category=u.searchParams.get('category'),status=u.searchParams.get('status'),search=u.searchParams.get('search');
 if(category)list=list.filter(x=>x.category===category);if(status)list=list.filter(x=>x.status===status);if(search)list=list.filter(x=>x.title.toLowerCase().includes(search.toLowerCase()));
 const sign=u.searchParams.get('order')==='asc'?1:-1;list=[...list].sort((a,b)=>(u.searchParams.get('sort')==='proposalsCount'?a.proposalsCount-b.proposalsCount:Date.parse(a.createdAt)-Date.parse(b.createdAt))*sign);
 const page=Number(u.searchParams.get('page')||1);return reply(event.requestId,{tasks:list.slice((page-1)*12,page*12),total:list.length,page,limit:12});
}
await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await navigate('/marketplace');
check('Public API returns a real task list',await evaluate('document.querySelectorAll("[data-task-row]").length>0'));
check('App navigation and task heading',await evaluate('document.querySelector("h1").innerText==="Tasks" && !!document.querySelector("[aria-label=\\\"App navigation\\\"]")'));
check('Agents remains a separate route',await evaluate('document.querySelector("[aria-label=\\\"Browse marketplace\\\"] a[href=\\\"/agents\\\"]")!==null'));
check('Supplied Hive wordmark',await evaluate('!!document.querySelector("aside [data-hive-brand=wordmark] path")'));
for(const theme of ['light','dark']){await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);await shot('marketplace-live-'+theme+'-1440',true);}
await send('Fetch.enable',{patterns:[{urlPattern:'*/api/tasks?*',requestStage:'Request'}]});mode='fixtures';await navigate('/marketplace?status=All');
check('Pagination renders one page',await evaluate('document.querySelectorAll("[data-task-row]").length===12'));
await click('[aria-label="Next page"]');await until('new URL(location.href).searchParams.get("page")==="2"');await settled();
check('Next page has correct range',await evaluate('document.querySelector("[aria-label=\\\"Task pages\\\"]").innerText.includes("13–24 of 25")'));
await send('Page.reload');await settled();check('Reload retains page',await evaluate('new URL(location.href).searchParams.get("page")==="2"'));
await choose('Category','Research');await until('new URL(location.href).searchParams.get("category")==="Research"');await settled();
check('Filtering resets pagination',await evaluate('!new URL(location.href).searchParams.has("page")'));
check('Category applied to all rows',await evaluate('[...document.querySelectorAll("[data-task-row]")].every(e=>e.innerText.includes("Research"))'));
await evaluate('history.back()');await until('new URL(location.href).searchParams.get("page")==="2"');await settled();
check('Back restores category and page',await evaluate('document.querySelector("select[aria-label=Category]").value==="All" && document.querySelectorAll("[data-task-row]").length===12'));
await choose('Sort by','proposals');await until('new URL(location.href).searchParams.get("sort")==="proposals"');await settled();
check('Proposal sorting uses API semantics',requests.at(-1).includes('sort=proposalsCount')&&requests.at(-1).includes('order=desc'));
check('Highest proposal count is first',await evaluate('document.querySelector("[data-task-row]").innerText.includes("25")'));
await choose('Status','Completed');await until('new URL(location.href).searchParams.get("status")==="Completed"');await settled();check('Closed tasks retain their status',await evaluate('document.querySelectorAll("[data-task-row]").length===1 && document.querySelector("[data-task-row]").innerText.includes("Completed")'));
await click('[class*=resultActions] button',0);await until('location.search===""');await settled();check('Reset restores all-status defaults',await evaluate('document.querySelector("select[aria-label=Status]").value==="All" && document.querySelector("select[aria-label=\\\"Sort by\\\"]").value==="newest"'));
await click('#task-search');await send('Input.insertText',{text:'C++ & [fees].*'});await click('form[role=search] button');await until('new URL(location.href).searchParams.get("search")==="C++ & [fees].*"');await settled();
check('Search query is encoded and preserved',requests.at(-1).includes('search=C%2B%2B+%26+%5Bfees%5D.*'));
check('No match recovery is explicit',await evaluate('document.querySelector("main").innerText.includes("No tasks match these filters.")'));
await click('[aria-label="Clear search"]');await until('!new URL(location.href).searchParams.has("search")');await settled();
await click('[aria-label^="Preview "]',1);await until('new URL(location.href).searchParams.has("task")');
check('Desktop selection updates the brief',await evaluate('document.querySelector("[aria-label=\\\"Task preview\\\"] [data-task-brief]").dataset.taskBrief===new URL(location.href).searchParams.get("task")'));
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await until('document.querySelector("dialog").open');
check('Mobile preview uses a modal',await evaluate('document.querySelector("dialog").matches(":modal")'));
check('Modal focus stays inside',await evaluate('document.querySelector("dialog").contains(document.activeElement)'));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector("dialog").open');
check('Escape closes and restores preview focus',await evaluate('document.activeElement.getAttribute("aria-label")?.startsWith("Preview ") && document.body.style.overflow!=="hidden"'));
await click('[aria-label="App navigation menu"]');check('Mobile navigation opens',await evaluate('document.querySelector("[aria-label=\\\"Mobile app navigation\\\"]").checkVisibility()'));
await click('[aria-label="Mobile app navigation"] [class*=more] summary');check('Secondary pages are grouped',await evaluate('document.querySelector("[aria-label=\\\"Mobile app navigation\\\"] a[href=\\\"/registry\\\"]").checkVisibility()'));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
check('Menu Escape returns focus',await evaluate('document.activeElement.getAttribute("aria-label")==="App navigation menu"'));
const layoutChecks=[];
for(const theme of ['light','dark']){
 await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
 for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[600,800],[760,900],[768,1024],[1024,768],[1100,900],[1280,900],[1440,1000],[667,320]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1100});await sleep(80);
  const findings=await evaluate(`(()=>{const shown=e=>e.checkVisibility()&&!e.closest('svg,option,dialog:not([open])')&&!(e.closest('details:not([open])')&&!e.matches('summary'));const outside=[];for(const e of document.querySelectorAll('[data-hive-marketplace] *')){if(!shown(e)||e.matches('[class*=srOnly],[class*=skipLink]'))continue;if(e.matches('a,button,input,select,summary')){const r=e.getBoundingClientRect();if(r.x< -1||r.right>innerWidth+1)outside.push(e.textContent.slice(0,40));}for(const n of e.childNodes){if(n.nodeType!==3||!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(b.x< -1||b.right>innerWidth+1)outside.push(n.textContent.slice(0,40));}}return {overflow:document.documentElement.scrollWidth>innerWidth,outside};})()`);
  layoutChecks.push({theme,width,height,...findings});check(`${theme} ${width}x${height} text and controls fit`,!findings.overflow&&!findings.outside.length,findings.outside);
 }
}
mode='long';await navigate('/marketplace');await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await sleep(100);
check('Missing budget/count remain explicit',await evaluate('document.querySelector("[data-task-row]").innerText.match(/Not listed/g)?.length===2'));
check('Long task title does not overflow',await evaluate('document.documentElement.scrollWidth===innerWidth'));
await click('[aria-label^="Preview "]');await until('document.querySelector("dialog").open');check('Long brief fits modal width',await evaluate('document.querySelector("dialog").scrollWidth<=document.querySelector("dialog").clientWidth'));
await click('[aria-label="Close task preview"]');await until('!document.querySelector("dialog").open');
mode='error';await click('[aria-label="Refresh tasks"]');await until('!!document.querySelector("[role=alert]")');check('Server failure shows retry',await evaluate('document.querySelector("[role=alert]").innerText.includes("Try again")'));
mode='fixtures';await click('[role=alert] button');await settled();check('Retry loads tasks without reload',await evaluate('document.querySelectorAll("[data-task-row]").length>0'));
mode='rate';await click('[aria-label="Refresh tasks"]');await until('!!document.querySelector("[role=alert]")');check('Rate-limit state is honest',await evaluate('document.querySelector("[role=alert]").innerText.includes("Wait a moment")'));
mode='malformed';await click('[role=alert] button');await until('!!document.querySelector("[role=alert]")');check('Malformed response is an error',await evaluate('!document.querySelector("main").innerText.includes("No open tasks right now.")'));
mode='empty';await click('[role=alert] button');await settled();check('No open tasks has an all-tasks action',await evaluate('document.querySelector("main").innerText.includes("No open tasks right now.")&&document.querySelector("main").innerText.includes("See all tasks")'));
mode='fixtures';await navigate('/marketplace?page=999');check('Out of range page can recover',await evaluate('document.querySelector("main").innerText.includes("Go to first page")'));
await click('[class*=empty] button');await until('!new URL(location.href).searchParams.has("page")');await settled();
mode='slow';await choose('Category','Research');await until('new URL(location.href).searchParams.get("category")==="Research"');await until('document.querySelector("[aria-label=Tasks]")?.getAttribute("aria-busy")==="true"');
check('Loading does not present old rows',await evaluate('document.querySelectorAll("[data-task-row]").length===0'));
await choose('Category','Development');await until('new URL(location.href).searchParams.get("category")==="Development"');await settled();
for(const id of delayed){try{await reply(id,{tasks:[fixture[0]],total:1});}catch{}}
await sleep(200);check('A stale response cannot replace the active filter',await evaluate('[...document.querySelectorAll("[data-task-row]")].every(e=>e.innerText.includes("Development"))'));
check('No runtime exceptions',errors.length===0,errors);
await fs.writeFile('/private/tmp/hive-redesign-qa/marketplace-results.json',JSON.stringify({checks,layoutChecks},null,2));
console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)},null,2));
await send('Fetch.disable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate('/marketplace');
ws.close();process.exitCode=checks.some(c=>!c.pass)?1:0;
