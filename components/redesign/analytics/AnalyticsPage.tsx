"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { ActivityChart } from './ActivityChart';
import { Fees } from './Fees';
import { csv, dayLabel, labels, number, readDays, readReport, stamp, type Report } from './model';
import { useResource } from './useResource';
import common from '../marketplace/marketplace.module.css';
import styles from './analytics.module.css';
function ReportBody({ report }: { report: Report }) {
  const [notice, setNotice] = useState('');
  function download() { try { const url = URL.createObjectURL(new Blob([csv(report)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `hive-activity-${report.start.slice(0, 10)}-${report.end.slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Activity CSV prepared.'); } catch { setNotice('The CSV could not be prepared. Use the data table below.'); } }
  return <>
    <p className={styles.asOf}>Report as of {stamp(report.asOf)}</p>
    <ActivityChart report={report} />
    <details className={styles.tableDetails} data-analytics-enter><summary>View daily data</summary><div className={styles.tableActions}><p>Dates are UTC. Today is partial.</p><button className={styles.secondary} onClick={download}><Download size={16} aria-hidden="true" />Export CSV</button></div><p role="status" className={styles.hint}>{notice}</p><table><caption className={common.srOnly}>Daily task counts for the selected period</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Posted</th><th scope="col">Completed</th></tr></thead><tbody>{report.daily.map(d => <tr key={d.date}><th scope="row"><time dateTime={d.date}>{dayLabel(d.date)}</time></th><td>{number(d.posted)}</td><td>{number(d.completed)}</td></tr>)}</tbody></table></details>
    {(report.undated.posted > 0 || report.undated.completed > 0) && <p className={styles.hint}>Excluded from the chart: {([[report.undated.posted, 'task'], [report.undated.completed, 'completion']] as const).filter(([n]) => n > 0).map(([n, label]) => `${number(n)} ${label} ${n === 1 ? 'record' : 'records'}`).join(' and ')} without valid dates.</p>}
    <section className={styles.overview} aria-labelledby="overview-title" data-analytics-enter><h2 id="overview-title">All-time records</h2><dl className={styles.totals}><div><dt>Tasks</dt><dd>{number(report.totals.tasks)}</dd></div><div><dt>Listed agents</dt><dd>{number(report.totals.agents)}</dd></div><div><dt>Proposals</dt><dd>{number(report.totals.proposals)}</dd></div></dl></section>
    <div className={styles.lower}>
      <section data-analytics-enter><h2>Current task status</h2><p className={styles.hint}>Share of all {number(report.totals.tasks)} task records.</p><dl className={styles.statuses}>{Object.entries(labels).map(([key, label]) => { const n = report.statuses[key as keyof typeof labels]; return <div key={key}><dt>{label}</dt><dd>{number(n)}<span>{report.totals.tasks ? (n / report.totals.tasks * 100).toFixed(1) + '%' : '—'}</span></dd></div>; })}</dl></section>
      <section data-analytics-enter aria-labelledby="report-notes-title"><h2 id="report-notes-title">About this report</h2><details className={styles.definitions}><summary>How figures are counted</summary><p>Posted tasks use their creation date. Completed tasks use their completion date and must still be marked completed. Changing the chart period does not change the all-time counts.</p><p>Listed agents exclude pending and suspended registrations. Proposals include all recorded proposals. Other task statuses are included in the total.</p></details></section>
    </div>
  </>;
}
export default function AnalyticsPage() {
  const params = useSearchParams(), router = useRouter(), days = readDays(params.get('days'));
  const [revision, setRevision] = useState(0), root = useRef<HTMLElement>(null);
  const parse = useCallback((v: unknown) => readReport(v, days), [days]);
  const r = useResource('/api/analytics?days=' + days, revision, parse);
  useEffect(() => { if (!r.data || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const ctx = gsap.context(() => gsap.fromTo('[data-analytics-enter]', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: .05, clearProps: 'all' }), root); return () => ctx.revert(); }, [r.data]);
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#analytics-main">Skip to Analytics</a><AppShell area="Analytics" page="Overview"><main ref={root} id="analytics-main" tabIndex={-1} className={`${common.main} ${styles.main}`}>
    <header className={styles.heading}><div><h1>Analytics</h1><p>Task activity and token fees.</p></div><button className={styles.secondary} aria-label="Refresh activity" disabled={r.state === 'loading'} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} aria-hidden="true" />Refresh</button></header>
    <nav className={styles.ranges} aria-label="Activity period">{[7, 30, 90].map(n => <button key={n} aria-pressed={days === n} onClick={() => router.push('/analytics' + (n === 30 ? '' : '?days=' + n), { scroll: false })}>{n} days</button>)}</nav>
    {r.state === 'loading' && <div className={styles.loading} role="status">Loading activity…<div aria-hidden="true" /></div>}
    {r.state === 'error' && <div role="alert" className={styles.error}><p>{r.error}{r.data ? ' Showing the last loaded report below.' : ''}</p><button className={styles.secondary} onClick={() => setRevision(v => v + 1)}>Try again</button></div>}
    {r.data && <ReportBody key={r.data.asOf + days} report={r.data} />}
    <Fees />
  </main></AppShell></div>;
}
