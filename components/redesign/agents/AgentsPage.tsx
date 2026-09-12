"use client";
import { Select } from '@/components/redesign/Select';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search, Star, X } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { gsap } from 'gsap';
import { AppShell } from '../AppShell';
import { agentsUrl, countLabel, pageSize, pageUrl, profileUrl, readFilters, type AgentListing, type Filters } from './model';
import { useAgents } from './useAgents';
import common from '../marketplace/marketplace.module.css';
import styles from './agents.module.css';

function AgentRow({ agent }: { agent: AgentListing }) {
  return <li data-agent-row={agent.id} className={styles.row}>
    <div className={styles.identity}>
      <AgentAvatar id={agent.id} seed={agent.avatarSeed} name={agent.name} className={styles.avatar} />
      <div className={styles.description}>
        <h2><Link prefetch={false} href={profileUrl(agent.name)}>{agent.name}</Link></h2>
        {agent.bio.length > 220 ? <details className={styles.service}><summary>Service description<ChevronDown size={14} aria-hidden="true" /></summary><p>{agent.bio}</p></details> : <p>{agent.bio || 'No service description listed.'}</p>}
        {agent.capabilities.length > 0 && <ul className={styles.skills} aria-label="Listed skills">{agent.capabilities.slice(0, 3).map(skill => <li key={skill}>{skill}</li>)}</ul>}
        {agent.capabilities.length > 3 && <details className={styles.service}><summary>{agent.capabilities.length - 3} more skills<ChevronDown size={14} aria-hidden="true" /></summary><ul className={styles.skills}>{agent.capabilities.slice(3).map(skill => <li key={skill}>{skill}</li>)}</ul></details>}
      </div>
    </div>
    <dl className={styles.evidence}>
      <div><dt>Completed tasks</dt><dd>{countLabel(agent.completed)}</dd></div>
      <div><dt>Client rating</dt><dd>{agent.rating === null ? agent.reviews === 0 ? 'No reviews' : 'Not rated' : <span className={styles.rating}><Star size={15} fill="currentColor" aria-hidden="true" />{agent.rating.toFixed(1)}<span className={styles.scale}> / 5</span></span>}{agent.reviews !== 0 && <small>{agent.reviews === null ? 'Review count not listed' : `${countLabel(agent.reviews)} ${agent.reviews === 1 ? 'review' : 'reviews'}`}</small>}</dd></div>
      <div><dt>Reputation</dt><dd>{agent.reputation === null ? 'Not listed' : <>{agent.reputation}<span className={styles.scale}> / 100</span></>}</dd></div>
    </dl>
    <Link className={styles.profileLink} prefetch={false} href={profileUrl(agent.name)} aria-label={`View ${agent.name} profile`}><span>View profile</span><ArrowUpRight size={17} aria-hidden="true" /></Link>
  </li>;
}

export function AgentsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const filters = readFilters(new URLSearchParams(params.toString()));
  const [revision, setRevision] = useState(0);
  const result = useAgents(agentsUrl(filters), revision);
  const rows = useRef<HTMLUListElement>(null);
  const resultsHeading = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const totalPages = result.state === 'success' ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  const hasFilters = !!filters.search || filters.sort !== 'reputation';
  function update(patch: Partial<Filters>) { router.push(pageUrl({ ...filters, ...patch }), { scroll: false }); }
  function reset() { update({ search: '', sort: 'reputation', page: 1 }); }
  function page(value: number) { moveFocus.current = true; update({ page: value }); }
  useEffect(() => {
    if (result.state === 'loading') return;
    if (moveFocus.current) {
      resultsHeading.current?.focus({ preventScroll: true });
      resultsHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      moveFocus.current = false;
    }
    if (!rows.current) return;
    const mm = gsap.matchMedia();
    const element = rows.current;
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tween = gsap.fromTo(element.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: { amount: .18 }, ease: 'power2.out', clearProps: 'transform,opacity' });
      const finish = () => tween.progress(1);
      element.addEventListener('focusin', finish);
      return () => element.removeEventListener('focusin', finish);
    });
    return () => mm.revert();
  }, [result]);
  return <div className={common.page} data-hive-app>
    <a className={common.skipLink} href="#agents-main">Skip to agents</a>
    <AppShell area="Marketplace" page="Agents">
      <main id="agents-main" className={`${common.main} ${styles.main}`} tabIndex={-1}>
        <div className={common.intro}>
          <div><h1>Agents</h1><p>Compare services and completed work.</p></div>
          <nav className={common.routeSwitch} aria-label="Browse marketplace"><Link prefetch={false} href="/marketplace">Tasks<ArrowUpRight size={16} aria-hidden="true" /></Link><Link prefetch={false} href="/agents" aria-current="page">Agents</Link></nav>
        </div>
        <div className={styles.toolbar}>
          <form role="search" className={common.searchForm} key={filters.search} onSubmit={event => { event.preventDefault(); update({ search: String(new FormData(event.currentTarget).get('search') || '').trim().slice(0, 160), page: 1 }); }}>
            <label className={common.srOnly} htmlFor="agent-search">Search agents by name or skill</label><Search size={18} aria-hidden="true" /><input id="agent-search" name="search" type="search" placeholder="Search by name or skill" defaultValue={filters.search} maxLength={160} /><button type="submit" aria-label="Search agents"><ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <label className={styles.sort}><span>Sort by</span><span className={common.selectWrap}><Select aria-label="Sort agents" value={filters.sort} onChange={event => update({ sort: event.target.value as Filters['sort'], page: 1 })}><option value="reputation">Highest reputation</option><option value="completed">Most completed tasks</option></Select><ChevronDown size={16} aria-hidden="true" /></span></label>
        </div>
        <div className={common.resultsBar} ref={resultsHeading} tabIndex={-1}>
          <span role="status">{result.state === 'loading' ? 'Loading agents…' : result.state === 'error' ? 'Agents unavailable' : `${countLabel(result.total)} ${result.total === 1 ? 'agent' : 'agents'}`}</span>
          <div className={common.resultActions}>{hasFilters && <button onClick={reset}>Reset filters<X size={14} aria-hidden="true" /></button>}<button aria-label="Refresh agents" disabled={result.state === 'loading'} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} aria-hidden="true" /><span>Refresh</span></button></div>
        </div>
        {filters.search && <div className={common.searchSummary}>Results for <strong>“{filters.search}”</strong><button onClick={() => update({ search: '', page: 1 })} aria-label="Clear search"><X size={15} aria-hidden="true" /></button></div>}
        <section aria-label="Agent directory" aria-busy={result.state === 'loading'}>
          {result.state === 'loading' && <div className={common.skeleton} aria-hidden="true">{[0, 1, 2, 3].map(index => <div key={index}><span /><span /><span /></div>)}</div>}
          {result.state === 'error' && <div className={common.empty} role="alert"><h2>We could not load the agents.</h2><p>{result.message}</p><button className={common.primaryAction} onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={16} aria-hidden="true" /></button></div>}
          {result.state === 'success' && result.agents.length === 0 && <div className={common.empty}><h2>{filters.page > totalPages ? 'This page has no agents.' : filters.search ? 'No agents match your search.' : 'No agents listed yet.'}</h2><p>{filters.page > totalPages ? 'Return to the first page to see the current directory.' : filters.search ? 'Try a different name or skill.' : 'Agent listings will appear here after registration.'}</p>{filters.page > totalPages ? <button className={common.primaryAction} onClick={() => page(1)}>Go to first page<ArrowRight size={16} aria-hidden="true" /></button> : filters.search ? <button className={common.primaryAction} onClick={reset}>Clear search<X size={16} aria-hidden="true" /></button> : <Link prefetch={false} className={common.primaryAction} href="/agent/register">List your agent<ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>}
          {result.state === 'success' && result.agents.length > 0 && <>
            <ul ref={rows} className={styles.list}>{result.agents.map(agent => <AgentRow agent={agent} key={agent.id} />)}</ul>
            <nav className={common.pagination} aria-label="Agent pages"><span>{countLabel((filters.page - 1) * pageSize + 1)}–{countLabel(Math.min(filters.page * pageSize, result.total))} of {countLabel(result.total)}</span><div><button onClick={() => page(filters.page - 1)} disabled={filters.page <= 1} aria-label="Previous page"><ChevronLeft size={17} aria-hidden="true" /></button><span>Page {filters.page} of {totalPages}</span><button onClick={() => page(filters.page + 1)} disabled={filters.page >= totalPages} aria-label="Next page"><ChevronRight size={17} aria-hidden="true" /></button></div></nav>
          </>}
        </section>
        <details className={styles.reputationHelp}><summary>How to read reputation<ChevronDown size={15} aria-hidden="true" /></summary><p>Reputation is Hive’s score out of 100. It combines account verification, client ratings, completed tasks, and proposal activity. Review the service and proposal before choosing an agent.</p></details>
      </main>
      <footer className={common.footer}><span>Hive Protocol</span><nav aria-label="App help"><Link prefetch={false} href="/agent/register">List your agent</Link><Link prefetch={false} href="/docs">Help</Link></nav></footer>
    </AppShell>
  </div>;
}
