"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import gsap from 'gsap';
import {AppShell} from '../AppShell';
import {AccessGate} from '../owner/AccessGate';
import {AgentAvatar} from '../AgentAvatar';
import {ResourceState} from '../dashboard/ResourceState';
import {useResource} from '../task/useResource';
import {readOwner,readTab,tabs} from './model';
import {ToolList} from './ToolList';
import {Webhooks} from './Webhooks';
import {Tokens} from './Tokens';
import {Points} from './Points';
import common from '../marketplace/marketplace.module.css';
import styles from './tools.module.css';
export function ToolsPage(){const [session,setSession]=useState<{id:string;key:string}|null>(null),[version,setVersion]=useState(0),[error,setError]=useState('');const root=useRef<HTMLElement>(null),tokenFocus=useRef(false),params=useSearchParams(),tab=readTab(params.get('view'));
 const request=useCallback((url:string,init?:RequestInit)=>fetch(url,{...init,credentials:'omit',cache:'no-store',headers:{...init?.headers,'x-hive-api-key':session?.key||''}}),[session]);
 const parse=useCallback((v:unknown)=>{const a=readOwner(v);if(a.id!==session?.id)throw Error('This profile belongs to another agent. Sign in again.');return a;},[session?.id]);
 const profile=useResource(session?'/api/agents/me':null,parse,request,version,session?.id||'');
 useEffect(()=>{if(profile.state==='success'&&tokenFocus.current){tokenFocus.current=false;root.current?.querySelector<HTMLButtonElement>('[data-owner-token-action]')?.focus();}},[profile.state]);
 useEffect(()=>{if(!root.current||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const ctx=gsap.context(()=>gsap.fromTo('[data-tools-enter]',{opacity:0,y:10},{opacity:1,y:0,duration:.32,stagger:.035,clearProps:'all'}),root);return()=>ctx.revert();},[tab,profile.state]);
 function exit(){tokenFocus.current=false;try{sessionStorage.removeItem('hive_agent_key');setSession(null);}catch{setError('Close this tab to leave the agent session.');}}
 return <div className={common.page} data-hive-app><a className={common.skipLink} href="#tools-main">Skip to owner tools</a><AppShell area="My agents" page="Owner tools"><main id="tools-main" tabIndex={-1} className={`${common.main} ${styles.main}`} ref={root} data-tools-state={!session?'access':profile.state}><Link className={styles.textLink} href={params.get('from')==='registry'?'/registry':'/agent/dashboard'}><ArrowLeft size={15}/>{params.get('from')==='registry'?'Tool registry':'My agents'}</Link><header className={styles.heading} data-tools-enter><div><h1>Owner tools</h1><p>Configure how your agent works.</p></div>{session&&<button className={styles.secondary} onClick={exit}>Switch agent</button>}</header>{error&&<p className={styles.error} role="alert">{error}</p>}{!session?<AccessGate enter={(key,id)=>setSession({key,id})}/>:profile.state!=='success'?<ResourceState value={profile} retry={()=>setVersion(v=>v+1)}/>:<><div className={styles.identity} data-tools-enter><AgentAvatar key={profile.data.avatarSeed||profile.data.id} id={profile.data.id} seed={profile.data.avatarSeed} name={profile.data.name} className={styles.avatar} size={42}/><span className={styles.identityName}>{profile.data.name}</span><Link className={styles.textLink} href={'/agent/'+encodeURIComponent(profile.data.name)}>View profile<ArrowRight size={15}/></Link></div><nav className={styles.views} aria-label="Owner tools">{tabs.map(v=><Link key={v} href={'/agent/dashboard/tools?view='+v} scroll={false} aria-current={tab===v?'page':undefined}>{v.charAt(0).toUpperCase()+v.slice(1)}</Link>)}</nav><div key={session.id+':'+tab}>{tab==='tools'?<ToolList request={request} owner={profile.data}/>:tab==='webhooks'?<Webhooks request={request} id={session.id}/>:tab==='tokens'?<Tokens request={request} owner={profile.data} refresh={()=>{tokenFocus.current=true;setVersion(v=>v+1);}}/>:<Points request={request} owner={profile.data}/>}</div></>}</main></AppShell></div>;
}
