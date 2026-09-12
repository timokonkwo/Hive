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
const until=async(expression)=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timed out: '+expression);};
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until('!!document.querySelector("[data-hive-marketplace]")');await until('document.querySelector("[aria-label=Tasks]")?.getAttribute("aria-busy")==="false"');await sleep(150);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
const choose=async(label,value)=>{await evaluate(`(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(80);};
const settled=()=>until('document.querySelector("[aria-label=Tasks]")?.getAttribute("aria-busy")==="false"');
const fixture=Array.from({length:25},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),title:['Compare lending fees and withdrawal limits','Review the agent dashboard on mobile','Write a security review of the payment flow'][i%3]+' '+(i+1),category:['Research','Development','Security'][i%3],status:i===2?'Completed':'Open',budget:i===1?'Negotiable':`${(i+1)*25} USDC`,proposalsCount:i,description:'Review the supplied requirements. Provide a clear report with sources and proposed changes.',requirements:'Include the source links. Explain the limits of each finding.',tags:['review','research'],createdAt:new Date(Date.UTC(2026,8,10-i)).toISOString()}));
async function reply(id,body,status=200){await send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
async function intercept(event){
 const u=new URL(event.request.url);requests.push(u.search);
 if(u.pathname==='/api/roadmap'){if(mode==='error')return reply(event.requestId,{error:'unavailable'},500);return reply(event.requestId,{success:true,items:mode==='empty'?[]:['in-progress','planned','completed'].map((status,i)=>({id:String(i),title:['Agent task discovery','Additional wallet support','Task marketplace'][i],description:'A milestone description supplied by the roadmap administrator.',status,date:'September 2026'}))});}
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

await send('Page.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Fetch.enable',{patterns:[{urlPattern:'*/api/tasks?*'},{urlPattern:'*/api/roadmap'}]});
mode='long';
for(const theme of ['light','dark']){for(const width of [320,390,768]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await navigate('/marketplace');await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');dispatchEvent(new Event('storage'))`);await click('button[aria-label^="Preview "]');await until('!!document.querySelector("dialog[open]")');
 const box=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();return{height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()`);check('Bottom sheet '+theme+width,box.height<=box.viewport*.73&&box.top>=box.viewport*.27&&Math.abs(box.bottom-box.viewport)<2&&!box.overflow,box);
 await shot('hierarchy-sheet-'+theme+'-'+width);await click('[aria-label="Close task preview"]');check('Dismiss sheet '+width,await evaluate(`!document.querySelector('dialog[open]')`));
}}
mode='fixtures';
for(const theme of ['light','dark']){for(const width of [320,390,768,1440]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:site+'/roadmap'});await until(`!!document.querySelector('#roadmap-in-progress')`);await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');dispatchEvent(new Event('storage'))`);
 check('Roadmap '+theme+width,await evaluate(`document.querySelectorAll('main article').length===3&&document.documentElement.scrollWidth<=innerWidth`));if(width===390||width===1440)await shot('hierarchy-roadmap-'+theme+'-'+width,true);
}}
for(const m of ['error','empty']){console.log('Testing roadmap',m);mode=m;await click('main button');await until(m==='error'?`!!document.querySelector('main [role="alert"]')`:`document.querySelector('main').textContent.includes('No milestones yet')`);check('Roadmap '+m,true);}
mode='fixtures';await click('main button');await until(`!!document.querySelector('#roadmap-in-progress')`);check('Roadmap retry',true);check('No runtime errors',errors.length===0,errors);await fs.writeFile('/private/tmp/hive-redesign-qa/hierarchy-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,failures:checks.filter(x=>!x.pass)},null,2));ws.close();process.exitCode=checks.some(x=>!x.pass)?1:0;
