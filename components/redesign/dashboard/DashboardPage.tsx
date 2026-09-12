"use client";
import { Select } from '@/components/redesign/Select';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ClipboardList, FilePenLine, RefreshCw, Search, Star } from 'lucide-react';
import gsap from 'gsap';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { AppShell } from '../AppShell';
import { draftKey, restoreDraft } from '../create/model';
import { useResource } from '../task/useResource';
import { dateLabel } from '../task/model';
import { action, filters, readDashboard, readQuery, selectRows, type Row } from './model';
import { Account } from './Account';
import common from '../marketplace/marketplace.module.css';
import styles from './dashboard.module.css';
const labels = {all:'All tasks',attention:'Action needed',open:'Open',working:'In progress',review:'In review',completed:'Completed'};
export function DashboardPage() {
  const {ready,authenticated,user,login,logout}=useAuth(), request=useAuthFetch();
  const router=useRouter(), params=useSearchParams(), query=readQuery(new URLSearchParams(params.toString()));
  const identity=`${authenticated}:${user?.id || ''}:${user?.wallet?.address || ''}`;
  const [recovering,setRecovering]=useState(false),[recoveryError,setRecoveryError]=useState('');
  async function signInAgain(){setRecovering(true);setRecoveryError('');try{await logout();login();}catch{setRecoveryError('Sign-in could not be restarted. Refresh this page and try again.');}finally{setRecovering(false);}}
  const [version,setVersion]=useState(0),[search,setSearch]=useState(query.q),[draft,setDraft]=useState('');
  const root=useRef<HTMLElement>(null);
  const result=useResource(ready?'/api/dashboard':null,readDashboard,request,version,identity);
  const data=result.state==='success'?result.data:null;
  const rows=data?.rows || [], attention=rows.filter(r=>!!action(r)).sort((a,b)=>action(a)!.rank-action(b)!.rank);
  const filtered=selectRows(rows,query.filter,query.q,query.sort), page=Math.min(query.page,Math.max(1,Math.ceil(filtered.length/20)));
  useEffect(()=>{queueMicrotask(()=>setSearch(query.q));},[query.q]);
  useEffect(()=>{try{const saved=restoreDraft(sessionStorage.getItem(draftKey));if(saved && (saved.draft.title.trim() || saved.draft.description.trim()))queueMicrotask(()=>setDraft(saved.draft.title.trim() || 'Untitled draft'));}catch{}},[]);
  useEffect(()=>{if(!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches)return;const ctx=gsap.context(()=>{gsap.fromTo('[data-dashboard-enter]',{opacity:0,y:12},{opacity:1,y:0,duration:.3,stagger:.025,clearProps:'all'});},root);return()=>ctx.revert();},[data?.accountId,query.view,query.filter,page]);
  function update(next:Record<string,string>){const p=new URLSearchParams(params.toString());for(const [k,v]of Object.entries(next)){if(v)p.set(k,v);else p.delete(k);}router.push('/dashboard'+(p.size?'?'+p.toString():''),{scroll:false});}
  const unauthorized=result.state==='error' && result.status===401;
  const signedOut=ready&&!authenticated&&unauthorized;
  const sessionError=authenticated&&unauthorized;
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#dashboard-main">Skip to My tasks</a><AppShell area="My tasks" page={query.view==='account'?'Account':'Tasks'}><main id="dashboard-main" tabIndex={-1} className={`${common.main} ${styles.main}`} ref={root} data-dashboard-state={data?'ready':signedOut?'signed-out':result.state}>
    <header className={styles.heading} data-dashboard-enter><div><h1>My tasks</h1><p>Track tasks and review work.</p></div>{!signedOut && <button className={styles.iconButton} aria-label="Refresh My tasks" disabled={result.state==='loading'} onClick={()=>setVersion(v=>v+1)}><RefreshCw size={18} aria-hidden="true"/></button>}</header>
    {draft && <div className={styles.draft} data-dashboard-enter><FilePenLine size={20} aria-hidden="true"/><div><span>Saved on this browser</span><strong>{draft}</strong></div><Link href="/create">Resume draft<ArrowRight size={16} aria-hidden="true"/></Link></div>}
    {signedOut?<section className={styles.gate} aria-labelledby="dashboard-sign-in-title" data-dashboard-enter><div className={styles.gateContent}><span className={styles.gateIcon}><ClipboardList size={26} strokeWidth={1.5} aria-hidden="true"/></span><h2 id="dashboard-sign-in-title">Sign in to view your tasks</h2><p>Review proposals, check submitted work and manage payments.</p><div className={styles.gateActions}><button className={styles.primary} onClick={login}>Sign in<ArrowRight size={16} aria-hidden="true"/></button><Link href="/marketplace" className={styles.textLink}>Open marketplace</Link></div></div></section>:!data?<section role={result.state==='error'?'alert':'status'} className={styles.empty}>{result.state==='error'?<><h2>{sessionError?'Your session could not be verified.':'Your tasks could not be loaded.'}</h2><p>{sessionError?'Try again, or sign in again to restore access.':result.message}</p><button className={styles.secondary} onClick={()=>setVersion(v=>v+1)}>Try again</button>{sessionError&&<button className={styles.textButton} disabled={recovering} onClick={()=>void signInAgain()}>{recovering?'Opening sign-in…':'Sign in again'}</button>}{recoveryError&&<p role="alert">{recoveryError}</p>}</>:<><p>Loading your tasks…</p><div className={styles.skeleton} aria-hidden="true"><span/><span/><span/></div></>}</section>:<>
    <nav className={styles.views} aria-label="My tasks views"><Link href="/dashboard" aria-current={query.view==='tasks'?'page':undefined}>Tasks</Link><Link href="/dashboard?view=account" aria-current={query.view==='account'?'page':undefined}>Account</Link></nav>
    {query.view==='account'?<Account key={identity+data.accountId} owner={data.accountId} request={request} logout={logout}/>:<div data-dashboard-enter>
      {!rows.length?<section className={styles.empty}><h2>No tasks yet.</h2><p>Post a task to receive proposals or choose an agent.</p><Link className={styles.primary} href="/create">Post a task<ArrowRight size={16}/></Link><p className={styles.hint}>For older tasks posted with a Solana wallet, <Link className={styles.textLink} href="/dashboard?view=account">verify that wallet in Account</Link>.</p></section>:<>
      <section className={styles.attention} aria-labelledby="attention-title"><div className={styles.sectionHeading}><h2 id="attention-title">Action needed <span>{attention.length}</span></h2>{attention.length>3 && <button className={styles.textButton} onClick={()=>update({status:'attention',page:''})}>View all<ArrowRight size={15}/></button>}</div>{attention.length?<ul>{attention.slice(0,3).map(r=><li key={r.id} data-dashboard-enter><div><span>{r.status==='In Review'?'Work submitted':r.status==='Completed'?'Task completed':r.direct?'Selected agent':`${r.pending} pending ${r.pending===1?'proposal':'proposals'}`}</span><Link href={`/marketplace/${r.id}?tab=${action(r)!.tab}`}>{r.title}</Link></div><Link className={styles.actionLink} href={`/marketplace/${r.id}?tab=${action(r)!.tab}`}>{r.status==='Completed' && <Star size={14} aria-hidden="true"/>}{action(r)!.label}<ArrowRight size={16} aria-hidden="true"/></Link></li>)}</ul>:<p className={styles.hint}>No tasks need your review or assignment.</p>}</section>
      <section aria-labelledby="list-title" className={styles.taskSection}><div className={styles.sectionHeading}><h2 id="list-title">Your tasks</h2><span>{rows.length} total</span></div>
      <div className={styles.filters} aria-label="Filter task status">{filters.map(f=><button key={f} aria-pressed={query.filter===f} onClick={()=>update({status:f==='all'?'':f,page:''})}>{labels[f]}<span>{selectRows(rows,f,'','newest').length}</span></button>)}</div>
      <div className={styles.toolbar}><form role="search" onSubmit={e=>{e.preventDefault();update({q:search.trim(),page:''});}}><label className={styles.srOnly} htmlFor="task-search">Search your tasks</label><input id="task-search" type="search" placeholder="Search tasks or agents" value={search} maxLength={120} onChange={e=>setSearch(e.target.value)}/><button className={styles.iconButton} aria-label="Search your tasks"><Search size={18}/></button></form><div><label htmlFor="task-sort">Sort</label><Select id="task-sort" value={query.sort} onChange={e=>update({sort:e.target.value==='newest'?'':e.target.value,page:''})}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select></div></div>
      <p className={styles.hint} role="status">{filtered.length} {filtered.length===1?'task':'tasks'}{query.q?` matching “${query.q}”`:''}</p>
      {filtered.length?<><div className={styles.tableHead} aria-hidden="true"><span>Task</span><span>Agent</span><span>Budget</span><span>Status</span></div><ul className={styles.taskList}>{filtered.slice((page-1)*20,page*20).map(row=><TaskRow key={row.id} row={row}/>)}</ul>{filtered.length>20 && <nav className={styles.pagination} aria-label="Task pages"><button className={styles.secondary} disabled={page===1} onClick={()=>update({page:String(page-1)})}>Previous</button><span>Page {page} of {Math.ceil(filtered.length/20)}</span><button className={styles.secondary} disabled={page*20>=filtered.length} onClick={()=>update({page:String(page+1)})}>Next</button></nav>}</>:<div className={styles.empty}><h3>No tasks match these filters.</h3><button className={styles.secondary} onClick={()=>update({status:'',q:'',page:''})}>Clear filters</button></div>}
      </section></>}
    </div>}
    </>}
  </main></AppShell></div>;
}
function TaskRow({row}:{row:Row}) { const next=action(row);return <li data-task-row><Link href={`/marketplace/${row.id}${next?'?tab='+next.tab:''}`} className={styles.row}><div><strong>{row.title}</strong><small>{row.category}{row.category?' · ':''}{dateLabel(row.created)}</small></div><span className={styles.rowAgent}><small>Agent</small>{row.agent||'Not assigned'}</span><span className={styles.rowBudget}><small>Budget</small>{row.budget}</span><span className={styles.rowStatus}>{row.status||'Status not listed'}<ArrowRight size={15} aria-hidden="true"/></span></Link></li>; }
