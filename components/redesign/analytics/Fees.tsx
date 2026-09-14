"use client";
import { useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { readFees, sol, stamp } from './model';
import { useResource } from './useResource';
import styles from './analytics.module.css';
function SolanaFees() {
  const [revision, setRevision] = useState(0), r = useResource('/api/admin/analytics/fees', revision, readFees), d = r.data;
  const fee = d?.fees, usd = d?.usd;
  const estimate = fee && usd && !usd.stale ? Number(fee.data) / 1e9 * usd.data : null;
  return <>
    <div className={styles.sectionHeading}><div><p>Lifetime · Bags</p></div><button className={styles.secondary} aria-label="Refresh token fees" disabled={r.state === 'loading'} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} aria-hidden="true" />Refresh</button></div>
    {r.state === 'loading' && <p role="status">Loading token fees…</p>}
    {r.state === 'error' && <p role="alert" className={styles.error}>{r.error}{d ? ' Showing the last loaded data.' : ''}</p>}
    {d && <><div className={styles.feeAmount}>{fee ? <><strong>{sol(fee.data)} SOL</strong><span>{fee.stale || r.state === 'error' ? 'Last available value · ' : ''}{stamp(fee.asOf)}</span>{estimate !== null && Number.isFinite(estimate) && <span>About {estimate.toLocaleString('en', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}</span>}</> : <p>Token fee data is not available.</p>}</div>
      <a className={styles.textLink} href={'https://bags.fm/' + d.token} target="_blank" rel="noopener noreferrer">View token on Bags<ArrowUpRight size={15} aria-hidden="true" /></a>
      <details className={styles.definitions}><summary>About token fees</summary><p>Trading fees, separate from task payments. Updated every five minutes.</p></details>
      {/* Fee-recipient and creator details are not part of the public view.
      <div className={styles.people}>{(['recipients', 'creators'] as const).map(k => { const part = d[k]; return <details key={k}><summary>{k === 'recipients' ? 'Fee recipients' : 'Token creators'}</summary>{part ? <><p className={styles.hint}>{part.stale ? 'Last available data · ' : ''}{stamp(part.asOf)}</p>{part.data.length ? <ul>{part.data.map((p, i) => <li key={p.wallet + i}><div><strong>{p.name || 'Wallet'}</strong><a href={'https://solscan.io/account/' + p.wallet} target="_blank" rel="noopener noreferrer">{p.wallet}<ArrowUpRight size={13} aria-hidden="true" /></a></div>{k === 'creators' && p.shareBps !== null && <span>{(p.shareBps / 100).toLocaleString('en', { maximumFractionDigits: 2 })}% fee share</span>}</li>)}</ul> : <p>No records returned.</p>}</> : <p>This data is not available.</p>}</details>; })}</div>
      */}
    </>}
  </>;
}

const networks = ['robinhood', 'solana'] as const;
type Network = typeof networks[number];
export function Fees() {
  const [network, setNetwork] = useState<Network>('solana');
  function select(next: Network, focus = false) {
    setNetwork(next);
    if (focus) document.getElementById(`fees-tab-${next}`)?.focus();
  }
  return <section className={styles.fees} aria-labelledby="fees-title">
    <h2 id="fees-title">HIVE token fees</h2>
    <div className={styles.networkTabs} role="tablist" aria-label="Token fee network">
      {networks.map((value, i) => <button key={value} id={`fees-tab-${value}`} type="button" role="tab" aria-selected={network === value} aria-controls={`fees-panel-${value}`} tabIndex={network === value ? 0 : -1} onClick={() => select(value)} onKeyDown={e => {
        const next = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? networks[(i + 1) % networks.length] : e.key === 'Home' ? networks[0] : e.key === 'End' ? networks[networks.length - 1] : null;
        if (next) { e.preventDefault(); select(next, true); }
      }}>{value === 'robinhood' ? 'Robinhood' : 'Solana'}{value === 'robinhood' && <span>Coming soon</span>}</button>)}
    </div>
    <div id="fees-panel-robinhood" role="tabpanel" aria-labelledby="fees-tab-robinhood" tabIndex={0} hidden={network !== 'robinhood'}>
      <div className={styles.comingSoon}><span className={styles.networkLabel}>HIVE on Robinhood</span><h3>Coming soon</h3></div>
    </div>
    <div id="fees-panel-solana" role="tabpanel" aria-labelledby="fees-tab-solana" tabIndex={0} hidden={network !== 'solana'}>{network === 'solana' && <SolanaFees />}</div>
  </section>;
}
