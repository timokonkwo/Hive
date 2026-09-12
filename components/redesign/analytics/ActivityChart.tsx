"use client";
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { dayLabel, number, type Report } from './model';
import styles from './analytics.module.css';
export function ActivityChart({ report }: { report: Report }) {
  const [metric, setMetric] = useState<'posted' | 'completed'>('posted'), [index, setIndex] = useState(report.daily.length - 1);
  const svg = useRef<SVGSVGElement>(null), [width, setWidth] = useState(900);
  useEffect(() => { if (!svg.current) return; const observer = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width))); observer.observe(svg.current); return () => observer.disconnect(); }, []);
  const inspect = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); setIndex(Math.max(0, Math.min(values.length - 1, Math.floor(((e.clientX - r.left) / r.width * width - 50) / step)))); };
  const selected = report.daily[index], values = report.daily.map(d => d[metric]);
  const max = Math.max(2, Math.ceil(Math.max(0, ...values) / 2) * 2), step = (width - 60) / values.length;
  return <section className={styles.activity} aria-labelledby="activity-heading" data-analytics-enter>
    <div className={styles.sectionHeading}><div><h2 id="activity-heading">Task activity</h2><p>{dayLabel(report.start)}–{dayLabel(report.end)} · UTC</p></div><div className={styles.switch} aria-label="Chart measure">{(['posted', 'completed'] as const).map(m => <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === 'posted' ? 'Posted' : 'Completed'}</button>)}</div></div>
    <div className={styles.chartSummary}><strong>{number(values.reduce((a, b) => a + b, 0))}<span>tasks {metric}</span></strong><output id="day-values" aria-live="polite">{dayLabel(selected.date)}<b>{number(selected.posted)} posted · {number(selected.completed)} completed</b></output></div>
    <svg ref={svg} className={styles.chart} viewBox={`0 0 ${width} 260`} role="img" aria-label={`Daily tasks ${metric}, ${dayLabel(report.start)} to ${dayLabel(report.end)}, UTC. Use the day control or data table for exact values.`} onPointerMove={inspect} onPointerDown={inspect}>
      {[0, 1, 2].map(i => <g key={i}><line x1="50" x2={width - 10} y1={220 - i * 95} y2={220 - i * 95} className={styles.gridLine} /><text x="42" y={225 - i * 95} textAnchor="end">{(max * i / 2).toLocaleString('en', { notation: 'compact', maximumFractionDigits: 1 })}</text></g>)}
      {values.map((v, i) => <g key={report.daily[i].date}><rect x={50 + i * step + step * .12} y={220 - v / max * 190} width={Math.max(1, step * .76)} height={v / max * 190} className={i === index ? styles.selectedBar : styles.bar} /><title>{report.daily[i].date}: {v} tasks {metric}</title></g>)}
      <text x="50" y="252">{dayLabel(report.start)}</text><text x={width - 10} y="252" textAnchor="end">{dayLabel(report.end)}</text>
    </svg>
    {values.every(v => v === 0) && <p className={styles.zero}>No tasks {metric}.</p>}
    <label className={styles.dayControl} htmlFor="chart-day"><span>Inspect a day</span><input id="chart-day" type="range" min={0} max={values.length - 1} step={1} value={index} onChange={e => setIndex(Number(e.target.value))} aria-describedby="day-values" aria-valuetext={`${selected.date}, ${selected.posted} posted, ${selected.completed} completed`} /><span>{dayLabel(selected.date)}</span></label>
  </section>;
}
