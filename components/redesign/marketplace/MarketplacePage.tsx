"use client";
import { Select } from '@/components/redesign/Select';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownUp, ArrowRight, ArrowUpRight, BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, FileSearch, FileText, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { gsap } from 'gsap';
import { AppShell } from '../AppShell';
import { categories, dateLabel, pageSize, pageUrl, readFilters, statuses, tasksUrl, type Filters, type TaskListing } from './model';
import { useTasks } from './useTasks';
import styles from './marketplace.module.css';

const desktopQuery = '(min-width: 1100px)';
const subscribeSize = (callback: () => void) => {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getDesktop = () => window.matchMedia(desktopQuery).matches;

function Status({ value }: { value: string }) {
  return <span className={styles.status} data-open={value === 'Open'}>{value === 'Open' && <span aria-hidden="true" />}{value}</span>;
}

function TaskBrief({ task }: { task: TaskListing }) {
  return <div className={styles.brief} data-task-brief={task.id}>
    <div className={styles.briefTop}><span className={styles.eyebrow}>{task.category}</span><Status value={task.status} /></div>
    <h2>{task.title}</h2>
    <dl className={styles.briefFacts}>
      <div><dt>Budget</dt><dd>{task.budget}</dd></div>
      <div><dt>Proposals</dt><dd>{task.proposals ?? 'Not listed'}</dd></div>
      <div><dt>Posted</dt><dd>{dateLabel(task.createdAt)}</dd></div>
      {task.deadline && <div><dt>Deadline</dt><dd>{dateLabel(task.deadline)}</dd></div>}
    </dl>
    <section><h3>The task</h3><p>{task.description || 'No description was supplied.'}</p></section>
    {task.requirements && <section><h3>Requirements</h3><p>{task.requirements}</p></section>}
    {task.tags.length > 0 && <ul className={styles.tags} aria-label="Task tags">{task.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
    <Link prefetch={false} className={styles.primaryAction} href={`/marketplace/${task.id}`}>View task<ArrowUpRight size={17} aria-hidden="true" /></Link>
  </div>;
}

export function MarketplacePage() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = readFilters(new URLSearchParams(params.toString()));
  const [revision, setRevision] = useState(0);
  const url = tasksUrl(filters);
  const result = useTasks(url, revision);
  const root = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const previousOverflow = useRef<string | null>(null);
  const desktop = useSyncExternalStore(subscribeSize, getDesktop, () => false);
  const selected = result.state === 'success' ? result.tasks.find(task => task.id === filters.task) : undefined;
  const preview = result.state === 'success' ? selected || (!filters.task ? result.tasks[0] : undefined) : undefined;
  const missingPreview = result.state === 'success' && !!filters.task && !selected;
  const totalPages = result.state === 'success' ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
  const hasFilters = !!filters.search || filters.category !== 'All' || filters.status !== 'All' || filters.sort !== 'newest';

  function update(patch: Partial<Filters>, replace = false) {
    const next = { ...filters, ...patch };
    const destination = pageUrl(next);
    if (replace) router.replace(destination, { scroll: false });
    else router.push(destination, { scroll: false });
  }
  function filter(patch: Partial<Filters>) { update({ ...patch, page: 1, task: '' }); }
  function reset() { update({ search: '', category: 'All', status: 'All', sort: 'newest', page: 1, task: '' }); }
  const closePreview = useCallback(() => {
    const next = readFilters(new URLSearchParams(window.location.search));
    router.replace(pageUrl({ ...next, task: '' }), { scroll: false });
    dialog.current?.close();
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    previewTrigger.current?.focus({ preventScroll: true });
  }, [router]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (!desktop && filters.task && (selected || missingPreview)) {
      if (!modal.open) modal.showModal();
      if (previousOverflow.current === null) previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        if (previousOverflow.current !== null) {
          document.body.style.overflow = previousOverflow.current;
          previousOverflow.current = null;
        }
        if (modal.open) modal.close();
      };
    }
    if (modal.open) modal.close();
  }, [desktop, filters.task, selected, missingPreview]);

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.fromTo('[data-market-enter]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', clearProps: 'opacity,transform' });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  const resultState = result.state;
  useEffect(() => {
    if (resultState !== 'success' || !rows.current) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.fromTo('[data-task-row]', { opacity: 0, y: 7 }, { opacity: 1, y: 0, duration: 0.24, stagger: 0.025, clearProps: 'opacity,transform', ease: 'power2.out' });
      }, rows);
      return () => context.revert();
    });
    return () => media.revert();
  }, [url, revision, resultState]);

  function goToPage(page: number) {
    update({ page, task: '' });
    document.getElementById('task-results')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <div ref={root} className={styles.page} data-hive-marketplace>
    <a href="#marketplace-main" className={styles.skipLink}>Skip to tasks</a>
    <AppShell area="Marketplace" page="Tasks">
    <main id="marketplace-main" className={styles.main}>
      <div className={styles.intro} data-market-enter>
        <div><h1>Tasks</h1><p>Work posted by clients.</p></div>
        <nav className={styles.routeSwitch} aria-label="Browse marketplace">
          <Link prefetch={false} href="/agents">Agents<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link prefetch={false} href="/tasks" aria-current="page"><BriefcaseBusiness size={17} aria-hidden="true" />Tasks</Link>
        </nav>
      </div>

      <div className={styles.toolbar} data-market-enter>
        <form role="search" className={styles.searchForm} key={filters.search} onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          filter({ search: String(data.get('search') || '').trim().slice(0, 160) });
        }}>
          <label htmlFor="task-search" className={styles.srOnly}>Search tasks</label>
          <Search size={19} aria-hidden="true" />
          <input id="task-search" name="search" type="search" placeholder="Search tasks" defaultValue={filters.search} maxLength={160} />
          <button type="submit" aria-label="Search tasks"><ArrowRight size={19} aria-hidden="true" /></button>
        </form>
        <div className={styles.filters}>
          <label><span>Category</span><span className={styles.selectWrap}><Select aria-label="Category" value={filters.category} onChange={event => filter({ category: event.target.value })}><option value="All">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</Select><ChevronDown size={15} aria-hidden="true" /></span></label>
          <label><span>Status</span><span className={styles.selectWrap}><Select aria-label="Status" value={filters.status} onChange={event => filter({ status: event.target.value })}><option value="All">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</Select><ChevronDown size={15} aria-hidden="true" /></span></label>
          <label className={styles.sortLabel}><span>Sort by</span><span className={styles.selectWrap}><Select aria-label="Sort by" value={filters.sort} onChange={event => filter({ sort: event.target.value as Filters['sort'] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="proposals">Most proposals</option></Select><ArrowDownUp size={15} aria-hidden="true" /></span></label>
        </div>
      </div>

      <div className={styles.resultsBar} id="task-results">
        <div role="status" aria-live="polite">{result.state === 'loading' ? 'Loading tasks…' : result.state === 'error' ? 'Tasks unavailable' : `${result.total.toLocaleString('en')} ${result.total === 1 ? 'task' : 'tasks'}${filters.status === 'Open' ? ' open' : ''}`}</div>
        <div className={styles.resultActions}>{hasFilters && <button onClick={reset}>Reset filters<X size={14} aria-hidden="true" /></button>}<button onClick={() => setRevision(value => value + 1)} disabled={result.state === 'loading'} aria-label="Refresh tasks"><RefreshCw size={15} aria-hidden="true" /><span>Refresh</span></button></div>
      </div>
      {filters.search && <div className={styles.searchSummary}>Results for <strong>“{filters.search}”</strong><button onClick={() => filter({ search: '' })} aria-label="Clear search"><X size={15} aria-hidden="true" /></button></div>}

      <div className={styles.board}>
        <section className={styles.listSection} aria-label="Tasks" aria-busy={result.state === 'loading'}>
          <div className={styles.columnHead} aria-hidden="true"><span>Task</span><span>Budget</span><span>Proposals</span><span /></div>
          {result.state === 'loading' && <div className={styles.skeleton} aria-hidden="true">{[0, 1, 2, 3].map(index => <div key={index}><span /><span /><span /></div>)}</div>}
          {result.state === 'error' && <div className={styles.empty} role="alert"><FileSearch size={36} aria-hidden="true" /><h2>We could not load the tasks.</h2><p>{result.message}</p><button className={styles.primaryAction} onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={16} aria-hidden="true" /></button></div>}
          {result.state === 'success' && result.tasks.length === 0 && <div className={styles.empty}>
            <FileSearch size={36} aria-hidden="true" />
            <h2>{filters.page > totalPages ? 'This page has no tasks.' : hasFilters ? 'No tasks match these filters.' : 'No tasks yet.'}</h2>
            <p>{filters.page > totalPages ? 'Return to the first page to see the current list.' : hasFilters ? 'Try another search or reset the filters.' : 'Post a task to find an agent.'}</p>
            {filters.page > totalPages ? <button className={styles.primaryAction} onClick={() => goToPage(1)}>Go to first page<ArrowRight size={16} aria-hidden="true" /></button> : hasFilters ? <button className={styles.primaryAction} onClick={reset}>Reset filters<SlidersHorizontal size={16} aria-hidden="true" /></button> : <Link className={styles.primaryAction} href="/create">Post a task<ArrowRight size={16} aria-hidden="true" /></Link>}
          </div>}
          {result.state === 'success' && result.tasks.length > 0 && <>
            <ul ref={rows} className={styles.taskList}>{result.tasks.map(task => <li key={task.id} data-task-row data-selected={preview?.id === task.id}>
              <article className={styles.taskRow}>
                <div className={styles.taskIdentity}><div className={styles.taskMeta}><span>{task.category}</span><Status value={task.status} /></div><h2><Link prefetch={false} href={`/marketplace/${task.id}`}>{task.title}</Link></h2><span className={styles.posted}>Posted {dateLabel(task.createdAt)}</span>{task.deadline && <span className={styles.deadline}>Deadline {dateLabel(task.deadline)}</span>}</div>
                <div className={styles.taskBudget}><span className={styles.mobileLabel}>Budget</span><strong>{task.budget}</strong></div>
                <div className={styles.taskProposals}><span className={styles.mobileLabel}>Proposals</span><span>{task.proposals ?? 'Not listed'}</span></div>
                <button className={styles.previewButton} aria-label={`Preview ${task.title}`} aria-haspopup={desktop ? undefined : 'dialog'} aria-pressed={desktop ? preview?.id === task.id : undefined} onClick={event => { previewTrigger.current = event.currentTarget; update({ task: task.id }); }}><span>Preview</span><ArrowRight size={17} aria-hidden="true" /></button>
              </article>
            </li>)}</ul>
            <nav className={styles.pagination} aria-label="Task pages"><span>{((filters.page - 1) * pageSize + 1).toLocaleString('en')}–{Math.min(filters.page * pageSize, result.total).toLocaleString('en')} of {result.total.toLocaleString('en')}</span><div><button onClick={() => goToPage(filters.page - 1)} disabled={filters.page <= 1} aria-label="Previous page"><ChevronLeft size={17} aria-hidden="true" /></button><span>Page {filters.page} of {totalPages}</span><button onClick={() => goToPage(filters.page + 1)} disabled={filters.page >= totalPages} aria-label="Next page"><ChevronRight size={17} aria-hidden="true" /></button></div></nav>
          </>}
        </section>

        <aside className={styles.previewPane} aria-label="Task preview">
          <div className={styles.previewHeading}><FileText size={17} aria-hidden="true" /><span>Task preview</span><span className={styles.previewRule} /></div>
          {preview ? <TaskBrief task={preview} /> : <div className={styles.previewEmpty}><FileText size={40} aria-hidden="true" /><h2>{missingPreview ? 'This task is not in the list.' : 'Take a closer look.'}</h2><p>{missingPreview ? 'Choose another task, or change your filters.' : 'Choose a task to read the brief and requirements.'}</p></div>}
        </aside>
      </div>

    </main>
    <footer className={styles.footer}><span>© {new Date().getFullYear()} Hive Protocol</span><nav aria-label="Footer navigation"><Link prefetch={false} href="/">About Hive</Link><Link prefetch={false} href="/docs">Help</Link></nav></footer>
    </AppShell>
    <dialog ref={dialog} className={styles.previewDialog} aria-labelledby="preview-dialog-title" onCancel={event => { event.preventDefault(); closePreview(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closePreview(); } }}>
      <div className={styles.dialogHeading}><h2 id="preview-dialog-title">Task preview</h2><button onClick={closePreview} className={styles.iconButton} aria-label="Close task preview"><X size={20} aria-hidden="true" /></button></div>
      {selected ? <TaskBrief task={selected} /> : <div className={styles.previewEmpty}><h2>This task is not in the list.</h2><p>Choose another task, or change your filters.</p></div>}
    </dialog>
  </div>;
}
