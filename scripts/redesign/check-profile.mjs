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
const settled=()=>until(`!!document.querySelector('[data-agent-profile]') || !!document.querySelector('main [role="alert"]') || document.querySelector('main h1')?.innerText==='Agent not found.'`);
const reviewsReady=()=>until(`document.querySelector('[aria-label="Client review list"]')?.getAttribute('aria-busy')==='false'`);
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until(`document.readyState==='complete'`);await settled();await sleep(500);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
const aid='0123456789abcdef01234567';
const tid='1123456789abcdef01234567';
const fixture={agent:{id:aid,name:'100% / C++',bio:'Research service. Compare supplied sources and prepare a report.',capabilities:['Research','Analysis'],reputation:0,reviewCount:6,avgSatisfaction:4.5,status:'active',website:'https://example.com/service',walletAddress:'7'.repeat(44),createdAt:'2026-03-20T12:00:00Z'},stats:{tasksCompleted:0},taskHistory:[{id:tid,title:'Compare lending fees',status:'Completed',category:'Research',budget:'$12 USDC',createdAt:'2026-04-01'}],recentBids:[{id:aid,taskId:tid,taskTitle:'Review the task brief',status:'WorkSubmitted',amount:'Negotiable',createdAt:'2026-05-01'}],tokenLaunches:[]};
const reviews=Array.from({length:6},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),taskId:tid,taskTitle:'Review task '+(i+1),satisfaction:5,comment:'Included the requested source links. '+(i+1),tags:[],createdAt:'2026-06-01'}));
async function reply(id,body,status=200){await send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
async function intercept(event){
 const u=new URL(event.request.url);requests.push(u.pathname+u.search);
 const isReview=u.pathname.endsWith('/reviews');
 if(isReview){
  if(mode==='review-error')return reply(event.requestId,{error:'Failed'},500);
  if(mode==='review-malformed')return reply(event.requestId,{reviews:[{id:'bad'}],total:1});
  if(mode==='slow-reviews' && u.searchParams.get('page')==='2'){delayed.push(event.requestId);return;}
  if(mode==='empty')return reply(event.requestId,{reviews:[],total:0});
  const page=Number(u.searchParams.get('page')||1);return reply(event.requestId,{reviews:reviews.slice((page-1)*5,page*5),total:6});
 }
 if(mode==='missing')return reply(event.requestId,{error:'Not found'},404);
 if(mode==='error')return reply(event.requestId,{error:'Failed'},500);
 if(mode==='rate')return reply(event.requestId,{error:'Limited'},429);
 if(mode==='malformed')return reply(event.requestId,{agent:{name:'No ID'}});
 if(mode==='slow-profile'){delayed.push(event.requestId);return;}
 let payload=structuredClone(fixture);
 if(mode==='empty')payload={...payload,agent:{id:aid,name:'New agent',status:'pending',reputation:0,reviewCount:0,avgSatisfaction:0},taskHistory:[],recentBids:[]};
 if(mode==='long'){payload.agent.name='LongAgent'.repeat(20);payload.agent.bio='Description '.repeat(200);payload.agent.capabilities=['LongSkill'.repeat(30),'Research'];payload.agent.website='javascript:alert(1)';payload.agent.reputation=999;payload.agent.avgSatisfaction=9;payload.taskHistory[0].title='Title'.repeat(80);payload.taskHistory[0].budget=null;}
 return reply(event.requestId,payload);
}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await navigate('/agent/Sage');await reviewsReady();
check('Actual profile and client reviews load',await evaluate(`document.querySelector('h1').innerText==='Sage' && document.querySelectorAll('[data-client-review]').length>0`));
check('Written review ratings have a star',await evaluate(`!!document.querySelector('[data-client-review] .lucide-star')`));
check('Profile uses app navigation without legacy navbar',await evaluate(`!!document.querySelector('[aria-label="App navigation"]') && document.querySelectorAll('h1').length===1 && !!document.querySelector('[data-hive-app]')`));
const actual=await evaluate(`(async()=>{const p=await(await fetch('/api/agents/by-name/Sage')).json();const d=await(await fetch('/api/leaderboard?search=Sage&limit=12')).json();const r=await(await fetch('/api/agents/'+p.agent.id+'/reviews?limit=5')).json();return{profile:p,entry:d.agents.find(a=>a.id===p.agent.id),review:r.reviews[0]};})()`);
check('Completed tasks agree with directory',actual.profile.stats.tasksCompleted===actual.entry.completedTasks,{profile:actual.profile.stats.tasksCompleted,directory:actual.entry.completedTasks});
check('Rendered review matches actual comment',await evaluate(`document.querySelector('[data-client-review]').innerText.includes(${JSON.stringify(actual.review.comment)})`));
check('Task action preserves actual agent ID',await evaluate(`document.querySelector('aside[aria-label="Create a task for this agent"] a[href^="/create"]').getAttribute('href')===${JSON.stringify('/create?agent='+actual.profile.agent.id)}`));
const avatar=await evaluate(`document.querySelector('[data-agent-profile] img').getAttribute('src')`);
await send('Page.navigate',{url:site+'/agents?search=Sage'});await until(`!!document.querySelector('[data-agent-row] img')`);
check('Directory and profile share identical generated avatar',await evaluate(`document.querySelector('[data-agent-row] img').getAttribute('src')===${JSON.stringify(avatar)}`));
await click('[data-agent-row] h2 a');await settled();await reviewsReady();
check('Directory link opens the new profile',await evaluate(`location.pathname==='/agent/Sage' && document.querySelector('[data-agent-profile]').dataset.agentProfile===${JSON.stringify(actual.profile.agent.id)}`));
for(const theme of ['light','dark']){
 await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
 for(const width of [320,375,390,600,760,768,1024,1100,1280,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<1100});await sleep(100);
  const layout=await evaluate(`(()=>{const bad=[];for(const e of document.querySelectorAll('main h1,main h2,main h3,main dt,main dd,main button,main a')){if(!e.checkVisibility()||e.closest('details:not([open])')&&!e.matches('summary'))continue;const r=e.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5)bad.push(e.textContent.slice(0,60));}return{overflow:document.documentElement.scrollWidth>innerWidth,bad}})()`);
  check(theme+' '+width+'px content bounds',!layout.overflow&&!layout.bad.length,layout);
  if([320,390,1440].includes(width)){await evaluate(`scrollTo({top:0,behavior:'instant'})`);await shot('profile-live-'+theme+'-'+width);}
 }
}
await send('Emulation.setDeviceMetricsOverride',{width:667,height:320,deviceScaleFactor:1,mobile:true});await sleep(150);
check('Landscape keeps content within viewport',await evaluate(`document.documentElement.scrollWidth===innerWidth`));
await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await sleep(150);
await evaluate(`window.__profileFontRestore=[...document.querySelectorAll('[data-hive-app] *')].map(e=>[e,e.getAttribute('style'),parseFloat(getComputedStyle(e).fontSize)]);for(const [e,,size] of window.__profileFontRestore)e.style.fontSize=(size*1.25)+'px';`);
check('Enlarged text preserves main controls',await evaluate(`document.documentElement.scrollWidth===innerWidth && [...document.querySelectorAll('header a,header button,header summary')].filter(e=>e.checkVisibility()).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`));
await evaluate(`for(const [e,style] of window.__profileFontRestore){if(style===null)e.removeAttribute('style');else e.setAttribute('style',style)}delete window.__profileFontRestore;`);
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate(`document.querySelector('#reviews').scrollIntoView({behavior:'instant',block:'start'})`);await shot('profile-reviews-dark-1440');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('#reviews').scrollIntoView({behavior:'instant',block:'start'})`);await shot('profile-reviews-dark-390');
await click('aside[aria-label="Create a task for this agent"] a[href^="/create"]');await until(`location.pathname==='/create'`);await until(`document.querySelector('main')?.innerText.includes('Sage')`);
check('Existing task form resolves the selected agent',await evaluate(`new URL(location.href).searchParams.get('agent')===${JSON.stringify(actual.profile.agent.id)} && document.querySelector('main').innerText.includes('Sage')`));
// No form submission or authenticated actions occur.
await send('Fetch.enable',{patterns:[{urlPattern:'*/api/agents/by-name/*',requestStage:'Request'},{urlPattern:'*/api/agents/*/reviews*',requestStage:'Request'}]});mode='fixture';await navigate('/agent/'+encodeURIComponent('100% / C++'));await reviewsReady();
check('Stored zero remains zero in profile',await evaluate(`document.querySelector('dl').innerText.includes('0') && !document.querySelector('dl').innerText.includes('999')`));
check('No invented badges or success rate',await evaluate(`!/(Trusted|Veteran|Success Rate|Elite|Online now)/i.test(document.querySelector('main').innerText)`));
await click('[aria-controls="agent-history"]',1);check('Proposal view has accurate label and price',await evaluate(`document.querySelector('#agent-history').innerText.includes('Proposed price') && document.querySelector('#agent-history').innerText.includes('Negotiable') && document.querySelector('#agent-history').innerText.includes('Work submitted')`));
await click('[aria-controls="agent-history"]',0);check('Task view preserves actual budget text',await evaluate(`document.querySelector('#agent-history').innerText.includes('$12 USDC')`));
await click('[aria-label="Next reviews"]');await until(`new URL(location.href).searchParams.get('reviewPage')==='2'`);await reviewsReady();await until(`document.querySelectorAll('[data-client-review]').length===1`);
check('Review pagination and encoded profile route',await evaluate(`decodeURIComponent(location.pathname)==='/agent/100% / C++' && document.querySelectorAll('[data-client-review]').length===1 && document.activeElement.id==='reviews-heading'`));
check('Names encoded exactly once in request',requests.some(r=>r.includes('/by-name/100%25%20%2F%20C%2B%2B')));
await send('Page.reload');await settled();await reviewsReady();check('Review page survives reload',await evaluate(`new URL(location.href).searchParams.get('reviewPage')==='2'`));
await evaluate('history.back()');await until(`!new URL(location.href).searchParams.has('reviewPage')`);await settled();await reviewsReady();await until(`document.querySelectorAll('[data-client-review]').length===5`);check('Back restores reviews',await evaluate(`document.querySelectorAll('[data-client-review]').length===5`));
await click('[class*="account"]>summary');await send('Browser.grantPermissions',{permissions:['clipboardReadWrite','clipboardSanitizedWrite'],origin:site});await click('[aria-label="Copy agent wallet"]');
check('Wallet copy writes exact address',await evaluate(`navigator.clipboard.readText()`)==='7'.repeat(44));
await evaluate(`window.__clipboardWrite=navigator.clipboard.writeText;Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('blocked'))})`);await click('[aria-label="Copy agent wallet"]');
check('Clipboard failure selects readable address',await evaluate(`document.activeElement.id==='agent-wallet' && document.querySelector('#agent-wallet').selectionEnd===44 && document.querySelector('[class*="address"] [role="status"]').textContent==='Select and copy the address.'`));
await evaluate(`Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:window.__clipboardWrite})`);
mode='empty';await navigate('/agent/Sage');await reviewsReady();
check('Empty profile and pending registration are honest',await evaluate(`document.querySelector('main').innerText.includes('No service description') && document.querySelector('main').innerText.includes('No task history') && document.querySelector('main').innerText.includes('No written reviews') && document.querySelector('aside[aria-label="Create a task for this agent"] button').disabled && !document.querySelector('aside a[href^="/create"]')`));
mode='long';await navigate('/agent/Sage');await reviewsReady();await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
check('Long identity and skill names wrap',await evaluate(`document.documentElement.scrollWidth===innerWidth && document.querySelector('h1').scrollWidth<=document.querySelector('h1').clientWidth+1`));
check('Unsafe website and out-of-range scores omitted',await evaluate(`!document.querySelector('a[href^="javascript:"]') && !document.querySelector('dl').innerText.includes('999') && document.querySelector('dl').innerText.includes('Not listed')`));
await click('[aria-label="App navigation menu"]');check('Mobile app navigation works',await evaluate(`document.querySelector('[aria-label="Mobile app navigation"]').checkVisibility()`));
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});check('Menu Escape restores focus',await evaluate(`document.activeElement.getAttribute('aria-label')==='App navigation menu'`));
for(const state of ['missing','error','rate','malformed']){mode=state;await navigate('/agent/Sage');const content=await evaluate(`document.querySelector('main').innerText`);check(state+' profile response shown',state==='missing'?content.includes('Agent not found.'):state==='rate'?content.includes('Too many requests'):content.includes('Profile could not be loaded.'));}
mode='fixture';await click('main [role="alert"] button');await settled();await reviewsReady();check('Profile retry recovers',await evaluate(`!!document.querySelector('[data-agent-profile]')`));
mode='review-error';await click('[aria-label="Refresh reviews"]');await reviewsReady();check('Review failure preserves service and task action',await evaluate(`document.querySelector('#reviews').innerText.includes('Reviews could not be loaded.') && !!document.querySelector('#service-heading') && !!document.querySelector('aside a[href^="/create"]')`));
mode='fixture';await click('#reviews [role="alert"] button');await reviewsReady();check('Independent review retry recovers',await evaluate(`document.querySelectorAll('[data-client-review]').length===5`));
mode='review-malformed';await click('[aria-label="Refresh reviews"]');await reviewsReady();check('Malformed reviews show an error',await evaluate(`document.querySelector('#reviews').innerText.includes('Reviews could not be loaded.')`));
mode='fixture';await navigate('/agent/Sage?reviewPage=999');await reviewsReady();check('Out-of-range reviews have recovery',await evaluate(`document.querySelector('#reviews').innerText.includes('This page has no reviews.')`));
await click('#reviews button:not([aria-label])');await until(`!new URL(location.href).searchParams.has('reviewPage')`);await settled();await reviewsReady();
mode='slow-reviews';await click('[aria-label="Next reviews"]');await until(`document.querySelector('[aria-label="Client review list"]').getAttribute('aria-busy')==='true'`);await evaluate('history.back()');await until(`!new URL(location.href).searchParams.has('reviewPage')`);await reviewsReady();
for(const id of delayed){try{await reply(id,{reviews:[reviews[5]],total:6});}catch{}}await sleep(300);check('Stale review response cannot overwrite current page',await evaluate(`document.querySelectorAll('[data-client-review]').length===5`));
mode='fixture';await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await navigate('/agent/Sage');await sleep(800);check('Profile element entrances finish',await evaluate(`[...document.querySelectorAll('[data-profile-enter]')].every(e=>getComputedStyle(e).opacity==='1' && getComputedStyle(e).transform==='none')`));
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate('/agent/Sage');check('Reduced-motion profile stays visible',await evaluate(`[...document.querySelectorAll('[data-profile-enter]')].every(e=>getComputedStyle(e).opacity==='1')`));
check('No redesigned-profile runtime exceptions',errors.length===0,errors);
await send('Fetch.disable');mode='real';await navigate('/agent/Sage');await reviewsReady();
await fs.writeFile('/private/tmp/hive-redesign-qa/profile-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,failures:checks.filter(x=>!x.pass)},null,2));ws.close();process.exitCode=checks.some(x=>!x.pass)?1:0;
