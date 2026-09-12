"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { BrandWordmark } from '../BrandMark';
import { useHiveTheme } from '../theme';
import { groups, resolveTopic, searchTopics, sectionHash, topics, type Topic } from './content';
import { Article } from './Article';
import styles from './docs.module.css';
function TopicIndex({active,onChoose}: {active:string;onChoose?:()=>void}) {
 return <nav aria-label="Documentation topics">{groups.map(group=><div className={styles.navGroup} key={group}><h2>{group}</h2>{topics.filter(t=>t.group===group).map(t=><a href={'#'+t.id} key={t.id} aria-current={active===t.id?'page':undefined} onClick={onChoose}>{t.title}</a>)}</div>)}</nav>;
}
function Outline({topic,active,onChoose}: {topic:Topic;active:string;onChoose?:()=>void}) {
 return <nav aria-label="On this page">{topic.sections.map(s=><a href={'#'+sectionHash(topic,s)} key={s.id} aria-current={active===sectionHash(topic,s)?'location':undefined} onClick={onChoose}>{s.title}</a>)}</nav>;
}
export default function DocsPage() {
 const {theme,toggle}=useHiveTheme();
 const [location,setLocation]=useState({topic:topics[0],anchor:'intro',unknown:false});
 const [activeSection,setActiveSection]=useState(''),[modal,setModal]=useState<'search'|'topics'|null>(null),[query,setQuery]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null),article=useRef<HTMLElement>(null),mobileOutline=useRef<HTMLDetailsElement>(null),searchInput=useRef<HTMLInputElement>(null);
 const topic=location.topic,index=topics.indexOf(topic),results=searchTopics(query);
 function open(mode:'search'|'topics',source?:HTMLElement) {trigger.current=source||document.activeElement as HTMLElement;setQuery('');setModal(mode);}
 function close(restore=true) {dialog.current?.close();setModal(null);if(restore)trigger.current?.focus();}
 useEffect(()=>{
  const sync=()=>{const resolved=resolveTopic(window.location.hash);setLocation(resolved?{...resolved,unknown:false}:{topic:topics[0],anchor:'intro',unknown:true});};
  sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);
 },[]);
 useEffect(()=>{
  document.title=`${topic.title} | Hive Docs`;
  const frame=requestAnimationFrame(()=>{if(!window.location.hash){window.scrollTo({top:0,behavior:'instant'});return;}const el=document.getElementById(location.anchor);if(!el)return;const isHeading=location.anchor===topic.id;el.scrollIntoView({block:'start',behavior:!isHeading&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});if(window.location.hash)el.focus({preventScroll:true});});
  return()=>cancelAnimationFrame(frame);
 },[location,topic]);
 useEffect(()=>{
  const root=article.current;if(!root||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const ctx=gsap.context(()=>gsap.fromTo('[data-doc-enter]',{opacity:0,y:8},{opacity:1,y:0,duration:.25,stagger:.025,clearProps:'opacity,transform'}),root);return()=>ctx.revert();
 },[topic]);
 useEffect(()=>{
  let frame=0;
  const update=()=>{frame=0;const sections=topic.sections.map(s=>document.getElementById(sectionHash(topic,s))).filter((e):e is HTMLElement=>!!e);let current=sections[0];for(const s of sections){if(s.getBoundingClientRect().top<=170)current=s;}setActiveSection(current?.id||'');};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};update();window.addEventListener('scroll',scroll,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',scroll);};
 },[topic]);
 useEffect(()=>{
  if(!modal)return;const d=dialog.current;if(!d)return;
  d.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  if(modal==='search')searchInput.current?.focus();else d.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{document.body.style.overflow=previous;if(d.open)d.close();};
 },[modal]);
 useEffect(()=>{const shortcut=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!dialog.current?.open)open('search');}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[]);
 return <div className={styles.page} data-hive-docs onClick={e=>{const a=(e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');if(a&&a.hash===window.location.hash){const resolved=resolveTopic(a.hash);if(resolved){e.preventDefault();setLocation({...resolved,unknown:false});}}}}>
  <a className={styles.skip} href="#docs-main" onClick={e=>{e.preventDefault();document.getElementById('docs-main')?.focus();}}>Skip to documentation</a>
  <header className={styles.header}><div className={styles.identity}><Link prefetch={false} href="/" aria-label="Hive home"><BrandWordmark/></Link><span>Docs</span></div><button className={styles.searchTrigger} onClick={e=>open('search',e.currentTarget)} aria-label="Search documentation"><Search size={17} aria-hidden="true"/><span>Search documentation</span><kbd>⌘ K</kbd></button><div className={styles.headerActions}><button className={styles.iconButton} onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><Link prefetch={false} className={styles.launch} href="/marketplace">Launch App<ArrowUpRight size={15} aria-hidden="true"/></Link></div></header>
  <div className={styles.mobileBar}><button onClick={e=>open('topics',e.currentTarget)}><Menu size={17} aria-hidden="true"/>Topics<ChevronDown size={14} aria-hidden="true"/></button><span>{topic.title}</span></div>
  <div className={styles.layout}><aside className={styles.sidebar}><TopicIndex active={topic.id}/><Link className={styles.homeLink} prefetch={false} href="/"><ArrowLeft size={15}/>Back to website</Link></aside>
   <main id="docs-main" ref={article} className={styles.article} tabIndex={-1}>
    {location.unknown&&<div className={styles.unknown} role="status">That topic could not be found. Choose a topic or search the docs.</div>}
    <details className={styles.mobileOutline} ref={mobileOutline}><summary>On this page<ChevronDown size={14} aria-hidden="true"/></summary><Outline topic={topic} active={activeSection} onChoose={()=>{if(mobileOutline.current)mobileOutline.current.open=false;}}/></details>
    <Article topic={topic} key={topic.id}/>
    <nav className={styles.pager} aria-label="Adjacent topics">{index>0?<a href={'#'+topics[index-1].id}><ArrowLeft size={16}/><span><small>Previous</small>{topics[index-1].title}</span></a>:<span/>}{index<topics.length-1&&<a href={'#'+topics[index+1].id}><span><small>Next</small>{topics[index+1].title}</span><ArrowRight size={16}/></a>}</nav>
    <footer className={styles.footer}><span>Hive documentation</span><Link prefetch={false} href="/feedback">Report an issue<ArrowUpRight size={14}/></Link></footer>
   </main>
   <aside className={styles.outline}><span>On this page</span><Outline topic={topic} active={activeSection}/><div><BookOpen size={16} aria-hidden="true"/><Link prefetch={false} href="/feedback">Need help?</Link></div></aside>
  </div>
  <dialog ref={dialog} className={`${styles.dialog} ${modal==='topics'?styles.topicDialog:''}`} aria-labelledby="docs-dialog-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
   <div className={styles.dialogHeader}><h2 id="docs-dialog-title">{modal==='topics'?'Documentation topics':'Search documentation'}</h2><button className={styles.iconButton} onClick={()=>close()} aria-label="Close documentation dialog"><X size={19}/></button></div>
   {modal==='topics'?<TopicIndex active={topic.id} onChoose={()=>close(false)}/>:<><div className={styles.searchField}><Search size={18} aria-hidden="true"/><input ref={searchInput} aria-label="Search documentation topics" placeholder="Search tasks, wallets, API…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();dialog.current?.querySelector<HTMLAnchorElement>('[data-search-result]')?.focus();}}}/>{query&&<button onClick={()=>{setQuery('');searchInput.current?.focus();}} aria-label="Clear search"><X size={16}/></button>}</div><p className={styles.resultCount} role="status">{query.trim()?`${results.length} ${results.length===1?'topic':'topics'} found`:'Suggested topics'}</p><div className={styles.searchResults}>{results.length?results.map(t=><a data-search-result key={t.id} href={'#'+t.id} onClick={()=>close(false)}><span><small>{t.group}</small><strong>{t.title}</strong><span>{t.summary}</span></span><ArrowUpRight size={17}/></a>):<div className={styles.noResults}><h3>No matching topics</h3><p>Try a task, feature or endpoint name.</p><button onClick={()=>{setQuery('');searchInput.current?.focus();}}>Clear search</button></div>}</div></>}
  </dialog>
 </div>;
}
