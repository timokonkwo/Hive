"use client";
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUpRight, LockKeyhole } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { BrandMark } from '../BrandMark';
import { hiveLaunch, launchReady } from '@/lib/hive-launch';
import dynamic from 'next/dynamic';
const SolanaToken = dynamic(() => import('./SolanaToken').then(m => m.SolanaToken));
import common from '../marketplace/marketplace.module.css';
import styles from './token.module.css';
function LaunchWorkspace({ view }: { view: 'trade' | 'stake' }) {
  const available = launchReady(hiveLaunch, view), launching = hiveLaunch.status === 'coming-soon';
  return <section className={styles.launchWorkspace} aria-label={`HIVE ${view}`} data-token-enter>
    <div className={styles.workbench} inert={!available} aria-hidden={!available ? true : undefined} data-launch-controls>
      <section className={styles.market}><p className={styles.eyebrow}>HIVE / Robinhood</p><div className={styles.price}>— <span>USD</span></div><div className={styles.marketStats}><div><span>24h change</span><strong>—</strong></div><div><span>Volume</span><strong>—</strong></div><div><span>Market cap</span><strong>—</strong></div></div><div className={styles.chartEmpty}><span>No market data</span></div><div className={styles.marketFoot}><span>Recent activity</span><span>—</span></div></section>
      <section className={styles.order}><div className={styles.orderTabs}><span>{view === 'trade' ? 'Buy' : 'Stake'}</span><span>{view === 'trade' ? 'Sell' : 'Unstake'}</span></div><fieldset disabled={!available}><label className={styles.field}>{view === 'trade' ? 'You pay' : 'Amount'}<div className={styles.amountBox}><input aria-label="HIVE amount" placeholder="0" inputMode="decimal" /><span>{view === 'trade' ? 'ETH' : 'HIVE'}</span></div></label>{view === 'trade' && <><ArrowDown size={18} aria-hidden="true" /><label className={styles.field}>You receive<div className={styles.amountBox}><span className={styles.amountPlaceholder}>—</span><span>HIVE</span></div></label></>}<dl className={styles.summary}><div><dt>{view === 'trade' ? 'Price' : 'Your stake'}</dt><dd>—</dd></div><div><dt>{view === 'trade' ? 'Network fee' : 'Unlock date'}</dt><dd>—</dd></div></dl>{available ? <a className={styles.primary} href={(view === 'trade' ? hiveLaunch.tradeUrl : hiveLaunch.stakeUrl)!} target="_blank" rel="noopener noreferrer">{view === 'trade' ? 'Trade HIVE' : 'Stake HIVE'}<ArrowUpRight size={16} /></a> : <button className={styles.primary} disabled>{view === 'trade' ? 'Review trade' : 'Review stake'}</button>}</fieldset></section>
    </div>
    {!available && <div className={styles.launchCover} data-launch-cover><div className={styles.launchMessage} role="status"><span className={styles.lock}><LockKeyhole size={18} aria-hidden="true" /></span><h2>{launching ? hiveLaunch.message : 'HIVE is not available here yet'}</h2><Link prefetch={false} href="/agents">Browse agents<ArrowUpRight size={17} aria-hidden="true" /></Link></div></div>}
  </section>;
}
export default function TokenPage() {
  const params = useSearchParams(), router = useRouter(), network = params.get('network') === 'solana' ? 'solana' : 'robinhood', view = params.get('view') === 'trade' ? 'trade' : 'stake', root = useRef<HTMLElement>(null);
  function change(next: Record<string, string | null>) { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); } router.push('/stake' + (p.size ? '?' + p : ''), { scroll: false }); }
  useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const ctx = gsap.context(() => gsap.fromTo('[data-token-enter]', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .35, stagger: .06, clearProps: 'all' }), root); return () => ctx.revert(); }, [network, view]);
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#token-main">Skip to HIVE</a><AppShell area="HIVE" page={view === 'trade' ? 'Trade' : 'Stake'}><main ref={root} id="token-main" tabIndex={-1} className={`${common.main} ${styles.main}`}>
    <header className={styles.heading} data-token-enter><div className={styles.title}><span className={styles.tokenMark}><BrandMark /></span><div><h1>$HIVE</h1><p>{network === 'robinhood' ? 'Robinhood' : 'Solana'}</p></div></div><nav className={styles.networks} aria-label="Token network"><button aria-pressed={network === 'robinhood'} onClick={() => change({ network: null })}>Robinhood</button><button aria-pressed={network === 'solana'} onClick={() => change({ network: 'solana' })}>Solana</button></nav></header>
    <nav className={styles.tabs} aria-label="HIVE views"><button aria-pressed={view === 'trade'} onClick={() => change({ view: 'trade' })}>Trade</button><button aria-pressed={view === 'stake'} onClick={() => change({ view: null })}>Stake</button></nav>
    {network === 'robinhood' ? <LaunchWorkspace key={view} view={view} /> : <SolanaToken key="solana" view={view} />}
  </main></AppShell></div>;
}
