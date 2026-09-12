// Isolated browser fixture. Never mounts in Next.js or calls real admin APIs.
import {build} from 'esbuild';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
const root=process.cwd(),out='/private/tmp/hive-admin-fixture';await mkdir(out,{recursive:true});
const state=`import React from 'react';
export function useQA(){const [v,set]=React.useState(0);React.useEffect(()=>{const f=()=>set(v=>v+1);addEventListener('qa-change',f);addEventListener('popstate',f);return()=>{removeEventListener('qa-change',f);removeEventListener('popstate',f)}},[]);return v;}
export const auth={ready:true,authenticated:true,user:{id:'did:privy:fixture-admin',wallet:{address:'0x1234567890123456789012345678901234567890'},email:{address:'admin@example.test'}},login(){window.loginClicks=(window.loginClicks||0)+1},logout:async()=>{window.qa.role='signed-out';dispatchEvent(new Event('qa-change'))},connectWallet(){window.connectClicks=(window.connectClicks||0)+1}};
export const usePrivy=()=>{useQA();return {...auth,authenticated:window.qa.role!=='signed-out',ready:window.qa.role!=='loading'}};
export const useAuth=usePrivy;
export const useWallets=()=>{useQA();return{wallets:window.qa.connected?[{address:auth.user.wallet.address}]:[]}};
export const useAdminAccess=()=>{useQA();return{state:window.qa.role,retry(){window.qa.role='allowed';dispatchEvent(new Event('qa-change'))}}};
export const request=async(url,options={})=>{window.qa.requests.push({url,method:options.method||'GET',body:options.body});await new Promise(r=>setTimeout(r,30));if(window.qa.fail)return Response.json({error:'Unavailable'},{status:503});const u=new URL(url,location.origin);let data=window.qa.data[u.pathname]||{};if(options.method&&options.method!=='GET')data={success:true};return Response.json(data)};
export const useAuthFetch=()=>request;
export function usePathname(){useQA();return location.pathname}
export function useSearchParams(){useQA();return new URLSearchParams(location.search)}
const router={push(url){history.pushState({},'',url);dispatchEvent(new Event('popstate'))}};export const useRouter=()=>router;
export default function Link({href,children,prefetch,...props}){return <a href={href} {...props} onClick={e=>{props.onClick?.(e);if(href.startsWith('/admin')){e.preventDefault();router.push(href)}}}>{children}</a>}
`;
await writeFile(out+'/mocks.tsx',state);
await writeFile(out+'/solana.ts',`export const useWallets=()=>({wallets:[]});`);
await writeFile(out+'/entry.tsx',`import React from 'react';import {createRoot} from 'react-dom/client';import {AdminPage} from '${root}/components/redesign/admin/AdminPage';createRoot(document.getElementById('root')!).render(<AdminPage/>);`);
await build({entryPoints:[out+'/entry.tsx'],outdir:out,bundle:true,jsx:'automatic',format:'esm',nodePaths:[root+'/node_modules'],loader:{'.module.css':'local-css'},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(next\/(link|navigation)|@privy-io\/react-auth|@\/hooks\/(useAuth|useAuthFetch))$|AdminAccess$/},()=>({path:out+'/mocks.tsx'}));b.onResolve({filter:/^@privy-io\/react-auth\/solana$/},()=>({path:out+'/solana.ts'}));b.onResolve({filter:/^\/(redesign|fonts)\//},a=>({path:a.path,external:true}));b.onResolve({filter:/^@\//},a=>({path:path.join(root,a.path.slice(2)+(path.extname(a.path)?'':'.tsx'))}));}}],logLevel:'warning'});
const task={id:'0123456789abcdef01234567',title:'Review the agent payment integration',category:'Development',status:'Open',budget:125,proposalsCount:4,createdAt:'2026-09-11T10:00:00Z',clientAddress:'did:privy:fixture-client'};
const agent={id:'0123456789abcdef01234568',name:'Atlas',walletAddress:'0x1234567890123456789012345678901234567890',reputation:84,isVerified:true,tasksCompleted:12,createdAt:'2026-09-10T10:00:00Z'};
const stats={totalTasks:32,openTasks:8,inProgressTasks:6,completedTasks:18,totalAgents:14,totalBids:70};
const data={
 '/api/admin/stats':{stats,recentTasks:[task],recentAgents:[agent],recentActivity:[]},
 '/api/admin/tasks':{tasks:[task],total:41},'/api/admin/agents':{agents:[agent],total:21},
 '/api/admin/submissions':{submissions:[],total:0,stats:{totalSubmissions:0}},
 '/api/admin/stakers':{stakers:[],total:0,stats:{}},'/api/admin/dao':{reports:[],disputes:[],stats:{}},
 '/api/admin/feedback':{feedback:[],total:0},'/api/admin/token-stats':{stats:{totalLaunched:0,totalQueued:0,totalFailed:0,monthlyRemaining:10,walletBalance:null},revenue:{totalLifetimeFees:0,totalClaimable:0,perTokenFees:[]},recentLaunches:[],tokenizedAgents:[]},
 '/api/roadmap':{success:true,items:[{id:'roadmap-fixture',title:'Agent reviews',description:'Display reviews on agent profiles.',status:'planned',icon:'Star'}]},
};
const css=(await readdir(root+'/.next/static/css')).filter(f=>f.endsWith('.css'));
const html=`<!doctype html><html data-hive-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated admin fixture</title>${css.map(f=>`<link rel="stylesheet" href="/compiled/${f}">`).join('')}<link rel="stylesheet" href="/entry.css"><body><div id="root"></div><script>window.qa={role:'allowed',connected:true,fail:false,requests:[],data:${JSON.stringify(data)}};</script><script type="module" src="/entry.js"></script></body></html>`;
createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;let file;if(pathname==='/entry.js'||pathname==='/entry.css')file=out+pathname;else if(pathname.startsWith('/compiled/'))file=root+'/.next/static/css/'+path.basename(pathname);else if(pathname.startsWith('/redesign/')||pathname.startsWith('/brand/')||pathname.startsWith('/_next/static/media/'))file=pathname.startsWith('/_next/')?root+'/.next/static/media/'+path.basename(pathname):root+'/public'+pathname;if(file){const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(data);}else{res.setHeader('Content-Type','text/html');res.end(html)}}catch{res.statusCode=404;res.end('Not found')}}).listen(3112,'127.0.0.1',()=>console.log('Admin fixture: http://127.0.0.1:3112/admin'));
