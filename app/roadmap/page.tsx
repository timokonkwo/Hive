"use client";
import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Clock3, Flag, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/redesign/AppShell';
import common from '@/components/redesign/marketplace/marketplace.module.css';
import styles from '@/components/redesign/roadmap/roadmap.module.css';
type Item = { id:string; title:string; description:string; status:'completed'|'in-progress'|'planned'; date?:string; tag?:string };
const groups = [ { status:'in-progress', label:'In progress', icon:Clock3 }, { status:'planned', label:'Up next', icon:Flag }, { status:'completed', label:'Completed', icon:Check } ] as const;
export default function RoadmapPage(){
 const [items,setItems]=useState<Item[]>([]),[state,setState]=useState<'loading'|'ready'|'error'>('loading'),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch('/api/roadmap',{signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok||!data.success||!Array.isArray(data.items))throw Error('Roadmap unavailable');setItems(data.items);setState('ready');}).catch(()=>{if(!controller.signal.aborted)setState('error');});return()=>controller.abort();},[revision]);
 return <div className={common.page} data-hive-app><a className={common.skipLink} href="#roadmap-main">Skip to roadmap</a><AppShell area="Roadmap" page="Milestones"><main id="roadmap-main" className={`${common.main} ${styles.main}`} tabIndex={-1}>
 <header className={styles.heading}><div><h1>Roadmap</h1><p>What we’re building.</p></div><button className={styles.refresh} disabled={state==='loading'} onClick={()=>{setState('loading');setRevision(v=>v+1);}}><RefreshCw size={16} aria-hidden="true"/>Refresh</button></header>
 {state==='loading'?<div role="status" className={styles.loading}>Loading roadmap…<div/><div/><div/></div>:state==='error'?<div role="alert" className={common.empty}><h2>Roadmap unavailable</h2><p>Please try again.</p><button className={styles.refresh} onClick={()=>{setState('loading');setRevision(v=>v+1);}}>Try again</button></div>:!items.length?<div className={common.empty}><Flag size={28} aria-hidden="true"/><h2>No milestones yet</h2><p>Updates will appear here.</p></div>:<>
 <dl className={styles.summary}>{groups.map(g=><div key={g.status}><dt>{g.label}</dt><dd>{items.filter(i=>i.status===g.status).length}</dd></div>)}</dl>
 <div className={styles.timeline}>{groups.map(({status,label,icon:Icon})=><section key={status} aria-labelledby={`roadmap-${status}`}><header><Icon size={20} aria-hidden="true"/><h2 id={`roadmap-${status}`}>{label}</h2></header><div>{items.filter(i=>i.status===status).length?items.filter(i=>i.status===status).map(item=><article key={item.id}><div className={styles.itemHeading}><h3>{item.title}</h3>{item.date&&<span>{item.date}</span>}</div><p>{item.description}</p>{item.tag&&<span className={styles.tag}>{item.tag}</span>}</article>):<p className={styles.noItems}>No milestones in this stage.</p>}</div></section>)}</div>
 </>}
 <footer className={styles.footer}><a href="https://x.com/uphivexyz" target="_blank" rel="noopener noreferrer">Updates on X<ArrowUpRight size={16} aria-hidden="true"/></a></footer>
 </main></AppShell></div>
}
