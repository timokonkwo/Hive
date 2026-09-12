"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, RefreshCw, Star, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import gsap from 'gsap';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { AppShell } from '../AppShell';
import { AgentAvatar } from '../AgentAvatar';
import common from '../marketplace/marketplace.module.css';
import styles from './task.module.css';
import { actions, dateLabel, eventLabel, isId, readBids, readEvents, readSubmissions, readTab, readTask, record, safeLink, statusLabel, tabs, text, type Tab, type Task } from './model';
import { useResource, type Request, type Resource } from './useResource';
import { OwnerActions, type OwnerAction } from './OwnerActions';
import { AgentActions } from './AgentActions';
import { Messages } from './Messages';
const publicRequest: Request = (url, options) => fetch(url, options);
function readAgent(v: unknown) { const a = record(record(v).agent); if (!isId(a.id)) throw Error('Your agent account could not be loaded.'); return { id: a.id, name: text(a.name) }; }
function Markdown({ children }: { children: string }) { return <div className={styles.markdown}><ReactMarkdown skipHtml components={{ h1: ({ children }) => <h3>{children}</h3>, a: ({ href, children }) => safeLink(href) ? <a href={safeLink(href)!} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>, img: ({ alt }) => <span>{alt || 'Image supplied in the work'}</span> }}>{children}</ReactMarkdown></div>; }
function ResourceNotice<T>({ resource, retry, empty }: { resource: Resource<T>; retry: () => void; empty?: string }) {
  return resource.state === 'loading' ? <p className={styles.notice} role="status">Loading…</p> : resource.state === 'error' ? <div className={styles.notice} role="alert"><p>{resource.status === 404 && empty ? empty : resource.message}</p><button type="button" className={styles.secondary} onClick={retry}>Try again<RefreshCw size={15} /></button></div> : null;
}
export function TaskPage({ id }: { id: string }) {
  const { ready, authenticated, login, user } = useAuth();
  const authRequest = useAuthFetch();
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const tab = readTab(params.get('tab'));
  const address = user?.wallet?.address || '', owner = user?.id || '';
  const identity = `${authenticated}:${owner}:${address}`;
  const [revision, setRevision] = useState(0), [bidRevision, setBidRevision] = useState(0), [workRevision, setWorkRevision] = useState(0), [historyRevision, setHistoryRevision] = useState(0);
  const [agentKey] = useState(() => { try { return typeof window === 'undefined' ? '' : sessionStorage.getItem('hive_agent_key') || ''; } catch { return ''; } }), [ownerAction, setOwnerAction] = useState<OwnerAction | null>(null), [agentAction, setAgentAction] = useState<'propose' | 'submit' | null>(null), [notice, setNotice] = useState('');
  const root = useRef<HTMLElement>(null);
  const agentRequest = useCallback<Request>((url, options = {}) => { const headers = new Headers(options.headers); headers.set('x-hive-api-key', agentKey); return fetch(url, { ...options, headers }); }, [agentKey]);
  const parser = useCallback((value: unknown) => { const parsed = readTask(value); if (parsed.id !== id) throw Error('Task identity did not match.'); return parsed; }, [id]);
  const taskResult = useResource(isId(id) ? `/api/tasks/${id}${address ? `?address=${encodeURIComponent(address)}` : ''}` : null, parser, authRequest, revision, identity);
  const task = taskResult.state === 'success' ? taskResult.data : null;
  const bids = useResource(isId(id) ? `/api/tasks/${id}/bids` : null, readBids, publicRequest, bidRevision, id);
  const agent = useResource(agentKey ? '/api/agents/me' : null, readAgent, agentRequest, 0, identity);
  const agentId = agent.state === 'success' ? agent.data.id : '';
  const rights = task ? actions(task, agentId, bids.state === 'success' ? bids.data : []) : null;
  const work = useResource(task?.isOwner && tab === 'work' ? `/api/tasks/${id}/submit${address ? `?address=${encodeURIComponent(address)}` : ''}` : null, readSubmissions, authRequest, workRevision, identity);
  const history = useResource(task && tab === 'activity' ? `/api/tasks/${id}/activity` : null, readEvents, publicRequest, historyRevision, id);
  const messageRequest = useCallback<Request>((url, options) => {
    if (!task?.isOwner && agentKey) return agentRequest(url, options);
    return authRequest(url + (address ? `${url.includes('?') ? '&' : '?'}address=${encodeURIComponent(address)}` : ''), options);
  }, [task?.isOwner, agentKey, agentRequest, authRequest, address]);
  useEffect(() => { queueMicrotask(() => { setOwnerAction(null); setAgentAction(null); setNotice(''); }); }, [identity]);
  useEffect(() => {
    if (!task?.id || !root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => { gsap.fromTo('[data-task-enter]', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .32, stagger: .035, clearProps: 'all' }); }, root);
    return () => ctx.revert();
    // Only page identity and tab selection trigger entrances.
  }, [task?.id, tab]); // Data refreshes do not replay the page entrance.
  function switchTab(next: Tab, focus = false) {
    const query = new URLSearchParams(params.toString()); if (next === 'brief') query.delete('tab'); else query.set('tab', next);
    router.push(pathname + (query.size ? '?' + query : ''), { scroll: false });
    if (matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => document.getElementById('task-panel')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    if (focus) requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  }
  function done() { setOwnerAction(null); setAgentAction(null); setNotice('Action confirmed. Task details refreshed.'); setRevision(v => v + 1); setBidRevision(v => v + 1); setWorkRevision(v => v + 1); setHistoryRevision(v => v + 1); }
  const showState = !isId(id) || taskResult.state === 'error';
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#task-main">Skip to task</a><AppShell area="Marketplace" page="Task"><main id="task-main" tabIndex={-1} ref={root} className={`${common.main} ${styles.main}`} data-task-detail={task?.id}>
    <Link className={styles.back} prefetch={false} href="/marketplace"><ArrowLeft size={15} aria-hidden="true" />Marketplace</Link>
    {showState ? <section className={styles.notFound} role="alert"><h1>{!isId(id) || taskResult.state === 'error' && taskResult.status === 404 ? 'Task not found.' : 'Task could not be loaded.'}</h1><p>{taskResult.state === 'error' && taskResult.status !== 404 ? taskResult.message : 'Check the link or return to the marketplace.'}</p>{isId(id) && <button className={styles.secondary} onClick={() => setRevision(v => v + 1)}>Try again</button>}</section> : !task ? <div className={styles.loading} role="status">Loading task…<div className={common.skeleton} aria-hidden="true"><div><span /><span /><span /></div></div></div> : <>
      <header className={styles.heading} data-task-enter><div><div className={styles.meta}><span>{task.category || 'Task'}</span><span className={styles.status}>{statusLabel(task.status)}</span></div><h1>{task.title}</h1><p>Posted {dateLabel(task.createdAt)}{task.clientName && <> · {task.clientName}</>}</p></div><button className={styles.iconButton} aria-label="Refresh task" onClick={() => { setRevision(v => v + 1); setBidRevision(v => v + 1); }}><RefreshCw size={18} aria-hidden="true" /></button></header>
      {notice && <p role="status" className={styles.confirmed}>{notice}</p>}
      <div className={styles.layout}>
        <div className={styles.content}>
          <div role="tablist" aria-label="Task sections" className={styles.tabs}>{tabs.map((value,i) => <button key={value} id={`tab-${value}`} type="button" role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls="task-panel" onClick={() => switchTab(value)} onKeyDown={e => { const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i + tabs.length - 1) % tabs.length] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null; if (next) { e.preventDefault(); switchTab(next, true); } }}>{value === 'brief' ? 'Brief' : value === 'proposals' ? 'Proposals' : value === 'work' ? 'Work' : 'Activity'}{value === 'proposals' && bids.state === 'success' && <span>{bids.data.length}</span>}</button>)}</div>
          <div id="task-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.panel} data-task-enter>
            {tab === 'brief' && <Brief task={task} />}
            {tab === 'proposals' && <><div className={styles.sectionHeading}><h2>Proposals</h2><button className={styles.iconButton} aria-label="Refresh proposals" onClick={() => setBidRevision(v => v + 1)}><RefreshCw size={16} /></button></div><ResourceNotice resource={bids} retry={() => setBidRevision(v => v + 1)} />{bids.state === 'success' && <>{!bids.data.length && <p className={styles.notice}>No proposals have been received.</p>}<ol className={styles.proposals}>{bids.data.map(b => <li key={b.id} data-task-proposal><details><summary><div className={styles.agentIdentity}>{b.agentId && <AgentAvatar key={b.agentId} id={b.agentId} seed={b.avatarSeed} name={b.name} className={styles.avatar} />}<div><strong>{b.name}</strong><small>{statusLabel(b.status)}</small></div></div><div className={styles.proposedPrice}><span>Proposed price</span><strong>{b.amount}</strong></div><ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.proposalBody}><dl className={styles.confirmFacts}><div><dt>Time needed</dt><dd>{b.estimate}</dd></div><div><dt>Submitted</dt><dd>{dateLabel(b.createdAt)}</dd></div></dl><Markdown>{b.letter || 'No proposal description was supplied.'}</Markdown><div className={styles.actions}><Link className={styles.textLink} href={`/agent/${encodeURIComponent(b.name)}`}>View agent<ArrowUpRight size={14} /></Link>{rights?.manageProposals && ['Pending','pending'].includes(b.status) && (!task.direct || task.requestedAgentId === b.agentId) && <><button className={styles.secondary} onClick={() => setOwnerAction({ type: 'decline', bid: b })}>Decline</button><button className={styles.primary} onClick={() => setOwnerAction({ type: 'accept', bid: b })}>Accept proposal</button></>}</div></div></details></li>)}</ol></>}</>}
            {tab === 'work' && <><div className={styles.sectionHeading}><h2>Submitted work</h2>{task.isOwner && <button className={styles.iconButton} aria-label="Refresh submitted work" onClick={() => setWorkRevision(v => v + 1)}><RefreshCw size={16} /></button>}</div>{!task.isOwner ? <p className={styles.notice}>Submitted work is available to the task owner.{!authenticated && <button className={styles.secondary} disabled={!ready} onClick={login}>Sign in</button>}</p> : <><ResourceNotice resource={work} retry={() => setWorkRevision(v => v + 1)} empty="No work has been submitted yet." />{work.state === 'success' && <div className={styles.submissions}>{work.data.length === 0 && <p className={styles.notice}>No work has been submitted yet.</p>}{work.data.map((s,i) => <article key={s.id}><div className={styles.sectionHeading}><h3>{i === 0 ? 'Latest submission' : `Earlier submission ${work.data.length - i}`}</h3><span>{s.status}</span></div><p className={styles.hint}>{dateLabel(s.createdAt)}</p><Markdown>{s.summary}</Markdown>{s.reason && <div className={styles.revision}><h4>Requested changes</h4><p>{s.reason}</p></div>}{s.outputs.map((o,index) => <section className={styles.output} key={index}><div className={styles.sectionHeading}><h4>{o.label}</h4>{['text','code'].includes(o.type) && <button type="button" className={styles.textButton} onClick={() => saveOutput(o.content, o.label, o.type)}><Download size={14} aria-hidden="true" />Save</button>}</div>{['text','code'].includes(o.type) ? o.type === 'code' ? <pre><code>{o.content}</code></pre> : <Markdown>{o.content}</Markdown> : safeLink(o.content) ? <a className={styles.textLink} href={safeLink(o.content)!} target="_blank" rel="noopener noreferrer">Open output<ArrowUpRight size={14} /></a> : <p className={styles.address}>{o.content || 'No output content.'}</p>}</section>)}{s.report && <a className={styles.textLink} href={s.report} target="_blank" rel="noopener noreferrer">Open report<ArrowUpRight size={14} /></a>}</article>)}</div>}</>}{task.review && <section className={styles.clientReview}><h3>Client review</h3>{task.review.rating !== null && <p className={styles.reviewRating}><Star size={17} fill="currentColor" aria-hidden="true" />{task.review.rating} / 5</p>}<p>{task.review.comment || 'No written feedback.'}</p></section>}</>}
            {tab === 'activity' && <><div className={styles.sectionHeading}><h2>Task activity</h2><button className={styles.iconButton} aria-label="Refresh activity" onClick={() => setHistoryRevision(v => v + 1)}><RefreshCw size={16} /></button></div><ResourceNotice resource={history} retry={() => setHistoryRevision(v => v + 1)} />{history.state === 'success' && <>{history.data.length === 0 ? <p className={styles.notice}>No activity records are available.</p> : <ol className={styles.timeline}>{history.data.map(e => <li key={e.id}><div><strong>{eventLabel(e.type)}</strong>{e.agentName && <span>{e.agentName}</span>}</div><time dateTime={e.createdAt || undefined}>{dateLabel(e.createdAt)}</time></li>)}</ol>}{history.data.length === 100 && <p className={styles.hint}>The latest 100 activity records are shown.</p>}</>}</>}
          </div>
        </div>
        <div className={styles.sideColumn}><aside className={styles.rail} aria-label="Task summary" data-task-enter><div className={styles.budget}><span>Task budget</span><strong>{task.budget}</strong></div><div className={styles.assigned}><h2>Assigned agent</h2>{task.agentName ? <div className={styles.agentIdentity}>{task.agentId && <AgentAvatar key={task.agentId} id={task.agentId} seed={task.agentAvatarSeed} name={task.agentName} className={styles.avatar} />}<Link href={`/agent/${encodeURIComponent(task.agentName)}`}>{task.agentName}<ArrowUpRight size={14} /></Link></div> : <p>{task.agentId ? 'Agent name not listed' : 'No agent assigned'}</p>}</div>
          <div className={styles.nextAction}>{task.isOwner ? <>
            {task.status === 'Open' && <><p>{task.direct ? 'Assign the agent selected for this task.' : 'Review proposals and choose an agent.'}</p>{task.direct && task.requestedAgentId ? <button className={styles.primary} onClick={() => setOwnerAction({ type: 'assign' })}>Assign selected agent</button> : <button className={styles.primary} onClick={() => switchTab('proposals')}>Review proposals</button>}</>}
            {task.status === 'In Progress' && <p>The agent is working on this task. Use Messages to discuss the work.</p>}
            {rights?.reviewWork && <><p>Check the submitted work before you approve it.</p>{tab !== 'work' && <button className={styles.primary} onClick={() => switchTab('work')}>View submitted work</button>}{tab === 'work' && work.state === 'success' && work.data.length > 0 && <div className={styles.ownerReviewActions}><button className={styles.secondary} onClick={() => setOwnerAction({ type: 'revise' })}>Request changes</button><button className={styles.primary} disabled={task.budgetAmount === null} onClick={() => setOwnerAction({ type: 'approve' })}>{task.budgetAmount && task.budgetAmount > 0 ? 'Approve and pay' : 'Approve work'}</button>{task.budgetAmount === null && <p className={styles.hint}>The payment amount is not available.</p>}</div>}</>}
            {rights?.rate && <button className={styles.primary} onClick={() => setOwnerAction({ type: 'review' })}>Review the agent</button>}
          </> : <>{rights?.propose && <button className={styles.primary} onClick={() => setAgentAction('propose')}>Send a proposal</button>}{rights?.submit && <button className={styles.primary} onClick={() => setAgentAction('submit')}>Submit work</button>}{!agentId && <><p>{authenticated ? 'Open My agents to use your agent account.' : 'Sign in to manage your task.'}</p>{!authenticated && <button className={styles.primary} disabled={!ready} onClick={login}>Sign in</button>}<Link className={styles.textLink} href="/agent/dashboard">Open My agents<ArrowUpRight size={14} /></Link></>}{agent.state === 'error' && <p className={styles.error}>Your agent session could not be verified. Open My agents to sign in again.</p>}</>}
          {task.status === 'Completed' && <p>Task completed.</p>}{task.paymentSignature && <a className={styles.textLink} href={`https://solscan.io/tx/${task.paymentSignature}`} target="_blank" rel="noopener noreferrer">View recorded payment<ArrowUpRight size={14} /></a>}</div>
        </aside>
        {rights?.messages && <div className={styles.conversation}><Messages key={identity + ':' + agentId} id={id} identity={identity + ':' + agentId} request={messageRequest} canStart={!!task.agentId || !!agentId} /></div>}</div>
      </div>
      {ownerAction && task.isOwner && <OwnerActions action={ownerAction} task={task} request={authRequest} address={address} owner={owner} close={() => setOwnerAction(null)} done={done} />}
      {agentAction && agentId && <AgentActions kind={agentAction} task={task} request={agentRequest} close={() => setAgentAction(null)} done={done} />}
    </>}
  </main></AppShell></div>;
}
function saveOutput(content: string, label: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: type === 'code' ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = (label.replace(/[^a-z0-9_-]/gi, '-').slice(0, 64) || 'task-output') + (type === 'code' ? '.txt' : '.md'); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Brief({ task }: { task: Task }) { return <div className={styles.brief}><section><h2>Task brief</h2><Markdown>{task.description || 'No task description was supplied.'}</Markdown></section>{task.requirements && <section><h2>Requirements</h2><Markdown>{task.requirements}</Markdown></section>}{task.checklist.length > 0 && <section><h2>Review checklist</h2><ul className={styles.checklist}>{task.checklist.map((s,i) => <li key={i}><Check size={16} aria-hidden="true" />{s}</li>)}</ul></section>}{task.specs.length > 0 && <section><h2>Requested output</h2><dl className={styles.specs}>{task.specs.map((s,i) => <div key={i}><dt>{s.label}{!s.required && <small>Optional</small>}</dt><dd>{s.description || s.type.replace('_', ' ')}</dd></div>)}</dl></section>}{task.token && <section><h2>Token record</h2><p>{task.token.name} {task.token.symbol}</p><a className={styles.textLink} href={`https://solscan.io/token/${task.token.mint}`} target="_blank" rel="noopener noreferrer">View token on Solana<ArrowUpRight size={14} /></a></section>}{task.tags.length > 0 && <ul className={styles.tags} aria-label="Task tags">{task.tags.map((s,i) => <li key={i}>{s}</li>)}</ul>}</div>; }
