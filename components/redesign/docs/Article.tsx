"use client";
import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Hash } from 'lucide-react';
import Link from 'next/link';
import { apiReference } from './api-reference';
import { sectionHash, type Block, type Topic } from './content';
import styles from './docs.module.css';
function CodeBlock({label, code}: {label:string;code:string}) {
 const [message,setMessage]=useState(''), pre=useRef<HTMLPreElement>(null);
 async function copy() {
  try { await navigator.clipboard.writeText(code);setMessage('Copied.'); }
  catch {const selection=window.getSelection();if(pre.current&&selection){const range=document.createRange();range.selectNodeContents(pre.current);selection.removeAllRanges();selection.addRange(range);pre.current.focus();}setMessage('Select and copy the code below.');}
 }
 return <div className={styles.codeBlock}><div className={styles.codeHeader}><span>{label}</span><button onClick={()=>void copy()} aria-label={`Copy ${label} code`}>{message==='Copied.'?<Check size={15}/>:<Copy size={15}/>}<span>{message==='Copied.'?'Copied':'Copy'}</span></button></div><pre ref={pre} tabIndex={0} aria-label={`${label} code`}><code>{code}</code></pre><span className={styles.copyStatus} role="status">{message}</span></div>;
}
function BlockView({block:b}: {block:Block}) {
 switch(b.kind){
  case 'text':return <p>{b.text}</p>;
  case 'note':return <p className={styles.note}>{b.text}</p>;
  case 'list':return <ul>{b.items.map(i=><li key={i}>{i}</li>)}</ul>;
  case 'steps':return <ol className={styles.steps}>{b.items.map(i=><li key={i}>{i}</li>)}</ol>;
  case 'code':return <CodeBlock label={b.label} code={b.code}/>;
  case 'table':return <div className={styles.tableWrap}><table><thead><tr>{b.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r,i)=><tr key={i}>{r.map((cell,j)=>j===0?<th scope="row" key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
  case 'links':return <div className={styles.related}>{b.items.map(item=><Link prefetch={false} href={item.href} key={item.href} {...(item.href.startsWith('https:')?{target:'_blank',rel:'noopener noreferrer'}:{})}><span><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</span><ArrowUpRight size={17} aria-hidden="true"/></Link>)}</div>;
  case 'api':return <div className={styles.endpoints}>{apiReference.filter(e=>b.paths.some(p=>e.path.startsWith(p))).map((e,i)=><details key={e.path+e.method+i}><summary><span className={styles.method}>{e.method}</span><code>{e.path}</code></summary><div><p>{e.description}</p>{e.fields&&<p><strong>Fields:</strong> <code>{e.fields}</code></p>}{e.auth&&<p className={styles.auth}>Authentication required. The caller must have permission for this operation.</p>}</div></details>)}</div>;
 }
}
export function Article({topic}: {topic:Topic}) {
 return <><header className={styles.articleHeader} data-doc-enter><span className={styles.eyebrow}>{topic.group}</span><h1 id={topic.id} tabIndex={-1}>{topic.title}</h1><p>{topic.summary}</p></header>{topic.sections.map(section=><section className={styles.section} key={section.id} aria-labelledby={sectionHash(topic,section)} data-doc-enter><h2 id={sectionHash(topic,section)} tabIndex={-1}>{section.title}<a href={'#'+sectionHash(topic,section)} aria-label={`Link to ${section.title}`}><Hash size={16} aria-hidden="true"/></a></h2>{section.blocks.map((block,i)=><BlockView block={block} key={i}/>)}</section>)}</>;
}
