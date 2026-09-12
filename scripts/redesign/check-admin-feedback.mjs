import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
const site = process.env.HIVE_PREVIEW_URL || 'http://127.0.0.1:3112';
await fs.mkdir('/private/tmp/hive-redesign-qa',{recursive:true});
const tab = await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let counter=0;const pending=new Map();const errors=[];
ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);if(p){pending.delete(v.id);if(v.error)p.reject(v.error);else p.resolve(v.result)}}else if(v.method==='Fetch.requestPaused'){void intercept(v.params);}else if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result.value};
const shot=async(name,full=false)=>{const m=await send('Page.getLayoutMetrics');const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(full?{clip:{x:0,y:0,width:m.cssContentSize.width,height:m.cssContentSize.height,scale:1}}:{})});await fs.writeFile('/private/tmp/hive-redesign-qa/'+name+'.png',Buffer.from(data.data,'base64'));};

const checks=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});if(!pass)console.error('FAIL',name,detail||'');};
const until=async(expression)=>{for(let i=0;i<80;i++){if(await evaluate(`!!(${expression})`))return;await sleep(100);}throw new Error('Timed out: '+expression);};
const settled=()=>until(`!!document.querySelector('main')`);
const navigate=async(path)=>{await send('Page.navigate',{url:site+path});await until(`document.readyState==='complete'`);await settled();await sleep(500);};
const click=async(selector,index=0)=>{await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({behavior:'instant',block:'center'})`);await sleep(80);const point=await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(120);};
async function escape(){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(100);}



async function intercept(e){return send('Fetch.continueRequest',{requestId:e.requestId});}
await send('Page.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});

await navigate('/admin');
await evaluate(`window.qa.data['/api/admin/feedback']={feedback:[{id:'feedback-layout',type:'bug',status:'open',title:'A long feedback title that must remain readable without squeezing the message',description:'Hello Hive team. We would like to share detailed feedback on the task workflow. This message should use the available width instead of wrapping each word onto a separate line.\\n\\nPlease review the following link: https://feedback.example.test/'+ 'details'.repeat(30),contactInfo:'contact-'+ 'team'.repeat(20)+'@example.test',createdAt:'2026-09-12T10:00:00Z'}],total:1};history.pushState({},'', '/admin?section=feedback');dispatchEvent(new Event('popstate'))`);
await until(`document.querySelector('[class*=feedbackDescription]')`);
for(const width of [320,390,768,1024,1440]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<600});
 for(const theme of ['dark','light']){
  await evaluate(`document.documentElement.dataset.hiveTheme='${theme}'`);await sleep(100);
  const d=await evaluate(`(()=>{const row=document.querySelector('[class*=feedbackRow]').getBoundingClientRect(),body=document.querySelector('[class*=feedbackBody]').getBoundingClientRect(),status=document.querySelector('[class*=feedbackStatus]').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,row:row.width,body:body.width,status:status.width,stacked:status.top>=body.bottom-1,overlap:status.left<body.right&&status.top<body.bottom}})()`);
  check('Feedback columns '+width+' '+theme,!d.overflow&&d.body>Math.min(170,d.row-45)&&d.status<=201&&!d.overlap&&(width>=768||d.stacked),d);
  await click('[role="combobox"][aria-label^="Status for"]');
  const menu=await evaluate(`(()=>{const r=document.querySelector('[role=listbox]').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})()`);
  check('Status menu fits '+width+' '+theme,menu.left>=0&&menu.right<=width&&menu.bottom<=960,menu);await escape();
  if(width===390||width===1440)await shot('admin-feedback-'+width+'-'+theme);
 }
}
await click('[role="combobox"][aria-label^="Status for"]');await evaluate(`document.querySelectorAll('[role=option]')[1].click()`);await sleep(100);
check('Status update keeps authenticated handler',await evaluate(`window.qa.requests.some(r=>r.method==='PATCH'&&JSON.parse(r.body).status==='reviewed')`));
check('No runtime errors',errors.length===0,errors.map(e=>e.text));
console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,failures:checks.filter(c=>!c.pass)},null,2));ws.close();process.exitCode=checks.some(c=>!c.pass)?1:0;
