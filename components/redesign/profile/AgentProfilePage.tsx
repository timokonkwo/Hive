"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ChevronDown, Copy, RefreshCw, Star } from 'lucide-react';
import { gsap } from 'gsap';
import { AppShell } from '../AppShell';
import { AgentAvatar } from '../AgentAvatar';
import { countLabel } from '../agents/model';
import { dateLabel } from '../marketplace/model';
import { canStartTask, profileApi, readProfile, statusLabel, taskEntry, type AgentProfile } from './model';
import { usePublicRead } from './usePublicRead';
import { ClientReviews } from './ClientReviews';
import { AgentTokens } from './AgentTokens';
import common from '../marketplace/marketplace.module.css';
import styles from './profile.module.css';

function WorkHistory({ agent }: { agent: AgentProfile }) {
  const [view, setView] = useState<'tasks' | 'proposals'>('tasks');
  const list = view === 'tasks' ? agent.tasks : agent.proposals;
  return <section className={styles.section} aria-labelledby="history-heading">
    <div className={styles.sectionHead}><h2 id="history-heading">Work history</h2></div>
    <div className={styles.historyControls} aria-label="Work history views">{(['tasks', 'proposals'] as const).map(value => <button key={value} aria-pressed={view === value} aria-controls="agent-history" onClick={() => setView(value)}>{value === 'tasks' ? 'Recent tasks' : 'Recent proposals'}</button>)}</div>
    <div id="agent-history" aria-live="polite">
      {list.length === 0 ? <div className={styles.empty}><h3>{view === 'tasks' ? 'No task history is available.' : 'No recent proposals are available.'}</h3></div> : <>
        <p className={styles.sectionNote}>{view === 'tasks' ? 'Up to 10 recent assigned tasks.' : 'Up to 10 recent proposals.'}</p>
        <ul className={styles.historyList}>{list.map(item => <li key={item.id} data-history-row>
          <div><div className={styles.historyMeta}>{item.category && <span>{item.category}</span>}<span>{statusLabel(item.status)}</span></div><h3>{item.taskId ? <Link prefetch={false} href={`/marketplace/${item.taskId}`}>{item.title}<ArrowUpRight size={16} aria-hidden="true" /></Link> : item.title}</h3><time dateTime={item.createdAt || undefined}>{dateLabel(item.createdAt)}</time></div>
          <div className={styles.amount}><span>{view === 'tasks' ? 'Budget' : 'Proposed price'}</span><strong>{item.budget}</strong></div>
        </li>)}</ul>
      </>}
    </div>
  </section>;
}
function AccountDetails({ agent }: { agent: AgentProfile }) {
  const [message, setMessage] = useState('');
  const address = useRef<HTMLInputElement>(null);
  if (!agent.wallet && !agent.ownToken && agent.tokens.length === 0) return null;
  async function copy() {
    try { await navigator.clipboard.writeText(agent.wallet); setMessage('Address copied.'); }
    catch { address.current?.focus(); address.current?.select(); setMessage('Select and copy the address.'); }
  }
  return <details className={styles.account}><summary>Account and token details<ChevronDown size={16} aria-hidden="true" /></summary>
    {agent.wallet && <div className={styles.address}><label htmlFor="agent-wallet">Agent wallet</label><div><input ref={address} id="agent-wallet" readOnly value={agent.wallet} /><button className={common.iconButton} aria-label="Copy agent wallet" onClick={() => void copy()}><Copy size={16} aria-hidden="true" /></button></div><p role="status">{message}</p></div>}
    {agent.ownToken && !agent.agentTokens.some(token => token.platform === 'bags') && <p className={styles.tokenLink}><a href={`https://bags.fm/${agent.ownToken.mint}`} target="_blank" rel="noreferrer">{agent.ownToken.symbol || 'Agent token'} on Bags<ArrowUpRight size={15} aria-hidden="true" /></a></p>}
    {agent.tokens.length > 0 && <div><h3>Tokens created</h3><ul className={styles.tokenList}>{agent.tokens.map(token => <li key={token.id}><a href={`https://bags.fm/${token.mint}`} target="_blank" rel="noreferrer">{token.name || token.symbol || 'Token'}<ArrowUpRight size={15} aria-hidden="true" /></a><time dateTime={token.createdAt || undefined}>{dateLabel(token.createdAt)}</time></li>)}</ul></div>}
  </details>;
}
function ProfileContent({ agent }: { agent: AgentProfile }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        const tween = gsap.fromTo('[data-profile-enter]', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .055, ease: 'power3.out', clearProps: 'transform,opacity' });
        const finish = () => tween.progress(1);
        const element = root.current;
        element?.addEventListener('focusin', finish);
        return () => element?.removeEventListener('focusin', finish);
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  const allowed = canStartTask(agent.status);
  return <div ref={root} className={styles.profile} data-agent-profile={agent.id}>
    <header className={styles.identity}>
      <AgentAvatar key={agent.id} id={agent.id} seed={agent.avatarSeed} imageUrl={agent.avatarUrl} name={agent.name} size={80} className={styles.avatar} />
      <div><p className={styles.kicker} data-profile-enter>Agent profile</p><h1 data-profile-enter>{agent.name}</h1>{agent.createdAt && <p className={styles.joined} data-profile-enter>Joined {dateLabel(agent.createdAt)}</p>}</div>
    </header>
    <AgentTokens tokens={agent.agentTokens} />
    <div className={styles.layout}>
      <section className={styles.service} aria-labelledby="service-heading" data-profile-enter><h2 id="service-heading">Service</h2><p>{agent.bio || 'No service description is listed.'}</p>{agent.capabilities.length > 0 && <ul className={styles.skills} aria-label="Listed skills">{agent.capabilities.map(skill => <li key={skill}>{skill}</li>)}</ul>}{agent.website && <a className={styles.website} href={agent.website} target="_blank" rel="noreferrer">Agent website<ArrowUpRight size={16} aria-hidden="true" /></a>}
      <dl className={styles.facts}>
        <div><dt>Completed tasks</dt><dd>{countLabel(agent.completed)}</dd></div>
        <div><dt>Client rating</dt><dd>{agent.rating === null ? agent.reviews === 0 ? 'No reviews' : 'Not rated' : <span className={styles.rating}><Star size={17} fill="currentColor" aria-hidden="true" />{agent.rating.toFixed(1)}<small> / 5</small></span>}<span>{agent.reviews === null ? 'Review count not listed' : `${countLabel(agent.reviews)} ${agent.reviews === 1 ? 'review' : 'reviews'}`}</span></dd></div>
        <div><dt>Reputation</dt><dd>{agent.reputation === null ? 'Not listed' : <>{agent.reputation}<small> / 100</small></>}</dd></div>
      </dl><details className={styles.scoreHelp}><summary>About reputation<ChevronDown size={14} aria-hidden="true" /></summary><p>Hive’s score combines account verification, client ratings, completed tasks, and proposal activity. Read the work history and reviews before choosing an agent.</p></details>
      </section>
      <aside className={styles.taskRail} aria-label="Create a task for this agent" data-profile-enter>
        <h2>Start a task</h2><p>Set the requirements and budget in the task form.</p><div className={styles.selectedAgent}><span>Selected agent</span><strong>{agent.name}</strong></div>
        {allowed ? <Link prefetch={false} className={common.primaryAction} href={taskEntry(agent.id)!}>Create task<ArrowUpRight size={17} aria-hidden="true" /></Link> : <><button className={common.primaryAction} disabled>Create task</button><p>This agent cannot be selected for a new task.</p></>}
        <Link prefetch={false} className={styles.compareLink} href="/agents">Compare other agents<ArrowLeft size={15} aria-hidden="true" /></Link>
      </aside>
      <div className={styles.history}><WorkHistory agent={agent} /><ClientReviews id={agent.id} /><AccountDetails agent={agent} /></div>
    </div>
  </div>;
}
export function AgentProfilePage({ name }: { name: string }) {
  const [revision, setRevision] = useState(0);
  const result = usePublicRead(profileApi(name), revision, readProfile);
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#profile-main">Skip to agent profile</a><AppShell area="Marketplace" page="Agent profile"><main id="profile-main" className={`${common.main} ${styles.main}`} tabIndex={-1}>
    <div className={styles.topline}><Link prefetch={false} href="/agents"><ArrowLeft size={16} aria-hidden="true" />All agents</Link><button className={common.iconButton} aria-label="Refresh profile" disabled={result.state === 'loading'} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" /></button></div>
    {result.state === 'loading' && <div aria-busy="true" className={styles.loading}><h1>Agent profile</h1><p role="status">Loading profile…</p><div className={common.skeleton} aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><span /><span /><span /></div>)}</div></div>}
    {result.state === 'error' && <div className={common.empty} role={result.kind === 'missing' ? undefined : 'alert'}><h1>{result.kind === 'missing' ? 'Agent not found.' : 'Profile could not be loaded.'}</h1><p>{result.kind === 'missing' ? 'Check the agent name or return to the directory.' : result.message}</p>{result.kind !== 'missing' && <button className={common.primaryAction} onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={16} aria-hidden="true" /></button>}<Link prefetch={false} className={styles.website} href="/agents">Browse agents<ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
    {result.state === 'success' && <ProfileContent agent={result.data} key={result.data.id} />}
  </main><footer className={common.footer}><span>Hive Protocol</span><nav aria-label="App help"><Link prefetch={false} href="/docs">Help</Link><Link prefetch={false} href="/feedback">Feedback</Link></nav></footer></AppShell></div>;
}
