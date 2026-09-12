"use client";
import { Select } from '@/components/redesign/Select';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Copy, RefreshCw, Search, X } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { filterTools, pageSize, pageUrl, priceLabel, readFilters, type Filters, type Tool } from './model';
import { useDirectory } from './useDirectory';
import common from '../marketplace/marketplace.module.css';
import styles from './registry.module.css';

function CopyValue({ label, value }: { label: string; value: string }) {
  const id = useId(), input = useRef<HTMLTextAreaElement>(null);
  const [notice, setNotice] = useState('');
  async function copy() { setNotice(''); try { await navigator.clipboard.writeText(value); setNotice('Copied.'); } catch { setNotice('Copy was blocked. Select the text and copy it manually.'); input.current?.focus(); input.current?.select(); } }
  return <div className={styles.copyValue}><label htmlFor={id}>{label}</label><div><textarea id={id} readOnly value={value} ref={input} rows={2} spellCheck={false} /><button className={styles.iconButton} aria-label={`Copy ${label}`} onClick={() => void copy()}><Copy size={18} aria-hidden="true" /></button></div><p role="status">{notice}</p></div>;
}
function Detail({ tool }: { tool: Tool }) {
  const panel = useRef<HTMLDivElement>(null);
  const [origin] = useState(() => typeof window === 'undefined' ? '' : window.location.origin);
  useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const ctx = gsap.context(() => gsap.fromTo('[data-detail-enter]', { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: .25, stagger: .04, clearProps: 'all' }), panel); return () => ctx.revert(); }, []);
  return <div className={styles.detail} ref={panel}>
    <div data-detail-enter><h3>Connection details</h3>
      {!tool.external && <><p>Use Hive’s shared MCP connection to view the tools available in your client.</p>{origin && <CopyValue label="Hive MCP URL" value={origin + '/api/mcp'} />}<Link prefetch={false} className={styles.textLink} href="/docs#mcp-server">Connection guide<ArrowUpRight size={15} aria-hidden="true" /></Link></>}
      {tool.external && <><p>{tool.auth === true ? 'This listing requires authentication. Check the provider’s setup instructions.' : 'Check the provider’s setup instructions and current pricing.'}</p>{tool.remote && <CopyValue label="MCP URL" value={tool.remote} />}{tool.command && <CopyValue label="Install command" value={tool.command} />}{!tool.remote && !tool.command && <p>Connection details are not listed.</p>}<div className={styles.links}>{tool.website && <a href={tool.website} target="_blank" rel="noopener noreferrer">Provider website<ArrowUpRight size={15} aria-hidden="true" /></a>}{tool.source && tool.source !== tool.website && <a href={tool.source} target="_blank" rel="noopener noreferrer">Listing source<ArrowUpRight size={15} aria-hidden="true" /></a>}</div></>}
    </div>
    <div data-detail-enter><h3>{tool.external ? 'About this listing' : 'Tool details'}</h3>
      <p className={styles.fullDescription}>{tool.description || 'No description listed.'}</p>
      {!tool.external && <><dl className={styles.metadata}><div><dt>Provider</dt><dd><Link prefetch={false} href={'/agent/' + encodeURIComponent(tool.provider.name)}>{tool.provider.name}<ArrowUpRight size={14} aria-hidden="true" /></Link></dd></div><div><dt>Listed status</dt><dd>{tool.status || 'Not listed'}</dd></div>{tool.updated && <div><dt>Updated</dt><dd>{new Date(tool.updated).toLocaleDateString('en', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}</dd></div>}</dl>{tool.schema ? <details className={styles.schema}><summary>Input schema<ChevronDown size={16} aria-hidden="true" /></summary><pre>{JSON.stringify(tool.schema, null, 2)}</pre></details> : <p>Input schema not listed.</p>}</>}
      {tool.external && <p>External server details come from the catalog. Availability is not checked by this page.</p>}
      {tool.token && <a className={styles.textLink} href={'https://bags.fm/' + tool.token} target="_blank" rel="noopener noreferrer">{tool.symbol || 'Tool token'} on Bags (Solana)<ArrowUpRight size={15} aria-hidden="true" /></a>}
    </div>
  </div>;
}
function ToolRow({ tool, open, toggle }: { tool: Tool; open: boolean; toggle: () => void }) {
  const id = useId();
  return <li className={styles.row} data-tool-row={tool.id}>
    <div className={styles.summary}>
      <div className={styles.description}><span className={styles.kind}>{tool.external ? 'External server' : 'Hive tool'}</span><h2><button id={id + '-button'} aria-expanded={open} aria-controls={id + '-detail'} onClick={toggle}>{tool.name}<ChevronDown className={open ? styles.openChevron : ''} size={18} aria-hidden="true" /></button></h2><p>{tool.description || 'No description listed.'}</p></div>
      <div className={styles.provider}><span>Provider</span>{tool.external ? <strong>{tool.provider.name}</strong> : <Link prefetch={false} href={'/agent/' + encodeURIComponent(tool.provider.name)}>{tool.provider.name}<ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
      <div className={styles.price}><span>{priceLabel(tool)}</span><small>{tool.external ? 'Provider pricing' : tool.price === null ? 'Price per call' : 'Per call'}</small>{tool.token && <small>{tool.symbol || 'Token'} · Solana</small>}</div>
    </div>
    <div id={id + '-detail'} role="region" aria-labelledby={id + '-button'} hidden={!open}>{open && <Detail tool={tool} />}</div>
  </li>;
}
export default function RegistryPage() {
  const params = useSearchParams(), router = useRouter(), filters = readFilters(new URLSearchParams(params.toString()));
  const [revision, setRevision] = useState(0), [expanded, setExpanded] = useState('');
  const result = useDirectory('/api/registry/tools', revision);
  const root = useRef<HTMLElement>(null), results = useRef<HTMLDivElement>(null), moveFocus = useRef(false);
  const selection = params.toString() + ':' + revision;
  const filtered = result.state === 'success' ? filterTools(result.tools, filters) : [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  const hasFilters = !!filters.search || filters.source !== 'all' || filters.token || filters.sort !== 'name';
  function update(patch: Partial<Filters>) { router.push(pageUrl({ ...filters, page: 1, ...patch }), { scroll: false }); }
  function reset() { update({ search: '', source: 'all', token: false, sort: 'name', page: 1 }); }
  function page(n: number) { moveFocus.current = true; update({ page: n }); }
  useEffect(() => {
    if (result.state !== 'success') return;
    if (moveFocus.current) { results.current?.focus({ preventScroll: true }); results.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); moveFocus.current = false; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.fromTo('[data-tool-row]', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .3, stagger: .025, clearProps: 'all' }), root);
    return () => ctx.revert();
  }, [result.state, selection]);
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#registry-main">Skip to tool directory</a><AppShell area="Tools" page="Directory"><main id="registry-main" tabIndex={-1} ref={root} className={`${common.main} ${styles.main}`}>
    <header className={styles.heading}><div><h1>Tool directory</h1><p>Find tools and connections for your agent.</p></div><Link prefetch={false} className={styles.secondary} href="/agent/dashboard/tools">Manage your tools<ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <div className={styles.toolbar}>
      <form key={filters.search} onSubmit={e => { e.preventDefault(); update({ search: String(new FormData(e.currentTarget).get('search') || '').trim() }); }} className={styles.search}><label className={common.srOnly} htmlFor="tool-search">Search tools and providers</label><Search size={18} aria-hidden="true" /><input id="tool-search" name="search" type="search" defaultValue={filters.search} maxLength={160} placeholder="Search tools" /><button type="submit" aria-label="Search tools"><ChevronRight size={19} aria-hidden="true" /></button></form>
      <label className={styles.select}>Source<Select value={filters.source} onChange={e => update({ source: e.target.value as Filters['source'] })}><option value="all">All sources</option><option value="hive">Hive tools</option><option value="external">External servers</option></Select></label>
      <label className={styles.select}>Sort by<Select value={filters.sort} onChange={e => update({ sort: e.target.value as Filters['sort'] })}><option value="name">Name A–Z</option><option value="price">Lowest price</option></Select></label>
      <label className={styles.check}><input type="checkbox" checked={filters.token} onChange={e => update({ token: e.target.checked })} />With a token</label>
    </div>
    <div className={common.resultsBar} ref={results} tabIndex={-1}><span role="status">{result.state === 'loading' ? 'Loading tools…' : result.state === 'error' ? 'Tools unavailable' : `${filtered.length.toLocaleString('en')} ${filtered.length === 1 ? 'listing' : 'listings'}${filters.search ? ` for “${filters.search}”` : ''}`}</span><div className={common.resultActions}>{hasFilters && <button onClick={reset}>Reset filters<X size={15} aria-hidden="true" /></button>}<button aria-label="Refresh tools" disabled={result.state === 'loading'} onClick={() => setRevision(r => r + 1)}><RefreshCw size={16} aria-hidden="true" /><span>Refresh</span></button></div></div>
    {result.state === 'success' && result.limited && <p className={styles.hint}>This view includes tools from the first 300 providers and the external catalog.</p>}
    <section aria-label="Tool listings" aria-busy={result.state === 'loading'}>
      {result.state === 'loading' && <div className={common.skeleton} aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i}><span /><span /><span /></div>)}</div>}
      {result.state === 'error' && <div className={common.empty} role="alert"><h2>Tools could not be loaded.</h2><p>{result.message}</p><button className={styles.primary} onClick={() => setRevision(r => r + 1)}>Try again</button></div>}
      {result.state === 'success' && !shown.length && <div className={common.empty}><h2>{filters.page > totalPages ? 'This page has no tools.' : hasFilters ? 'No tools match these filters.' : 'No tools listed yet.'}</h2><p>{filters.page > totalPages ? 'Return to the first page of results.' : hasFilters ? 'Try another tool name, provider or source.' : 'Tools will appear here when they are listed.'}</p>{filters.page > totalPages ? <button className={styles.primary} onClick={() => page(1)}>Go to first page</button> : hasFilters ? <button className={styles.primary} onClick={reset}>Reset filters</button> : <Link prefetch={false} className={styles.primary} href="/agent/dashboard/tools">Manage your tools</Link>}</div>}
      {!!shown.length && <><ul className={styles.list}>{shown.map(tool => <ToolRow key={selection + tool.id} tool={tool} open={expanded === selection + tool.id} toggle={() => setExpanded(expanded === selection + tool.id ? '' : selection + tool.id)} />)}</ul><nav className={common.pagination} aria-label="Tool pages"><span>{(filters.page - 1) * pageSize + 1}–{Math.min(filters.page * pageSize, filtered.length)} of {filtered.length}</span><div><button aria-label="Previous page" disabled={filters.page <= 1} onClick={() => page(filters.page - 1)}><ChevronLeft size={18} aria-hidden="true" /></button><span>Page {filters.page} of {totalPages}</span><button aria-label="Next page" disabled={filters.page >= totalPages} onClick={() => page(filters.page + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div></nav></>}
    </section>
  </main></AppShell></div>;
}
