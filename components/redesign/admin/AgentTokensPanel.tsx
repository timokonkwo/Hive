'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import type { Request } from '../task/useResource';
import styles from './agent-tokens.module.css';

type Stats = { stats: { totalLaunched: number; totalQueued: number; totalFailed: number; byChain: { solana: number; robinhood: number }; launchesThisMonth: number; launchesToday: number; walletBalance: number | null; walletAddress: string | null }; revenue: { error: string | null; feesTruncated?: boolean; totalClaimable: number | null; perTokenFees: Array<{ mintAddress: string; name: string; symbol: string; lifetimeFees: number | null; bagsUrl: string }> }; recentLaunches: Array<{ id: string; agentName: string; tokenSymbol: string; chain: string; status: string; createdAt: string | null; tradeUrl: string | null; bagsUrl?: string | null }> };
type Claim = { pending: boolean; confirmed: number; failed: number; error?: string | null; message: string; transactions: Array<{ signature: string; confirmed: boolean; failed?: boolean }> };
const amount = (value: number | null | undefined) => value == null ? 'Unavailable' : value > 0 && value < .000001 ? '<0.000001 SOL' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)} SOL`;
const date = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'Date unavailable';

export function AgentTokensPanel({ request }: { request: Request }) {
  const [data, setData] = useState<Stats | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [claim, setClaim] = useState<Claim | null>(null), [claimError, setClaimError] = useState(''), [claiming, setClaiming] = useState(false), [checking, setChecking] = useState(false), [statusReady, setStatusReady] = useState(false);
  const busy = useRef(false), statusBusy = useRef(false), alive = useRef(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request('/api/admin/token-stats', { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw Error('Token data could not be refreshed.');
      const next = await response.json();
      if (!next.stats || !next.revenue || !Array.isArray(next.recentLaunches)) throw Error('Token data could not be read.');
      if (alive.current) { setData(next); setError(''); }
    } catch { if (alive.current) setError('Token data is unavailable. Refresh to try again.'); }
    finally { if (alive.current) setLoading(false); }
  }, [request]);
  const check = useCallback(async () => {
    if (statusBusy.current) return;
    statusBusy.current = true; setChecking(true);
    try {
      const response = await request('/api/admin/token-stats?claimStatus=1', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('Status unavailable');
      const next = await response.json();
      if (!('claim' in next) || (next.claim && (typeof next.claim.pending !== 'boolean' || !Array.isArray(next.claim.transactions)))) throw Error('Invalid status');
      if (alive.current) { setClaim(next.claim); setStatusReady(true); setClaimError(''); }
      return next.claim as Claim | null;
    } catch { if (alive.current) { setStatusReady(false); setClaimError('Claim status is unavailable. Check status before trying again.'); } }
    finally { statusBusy.current = false; if (alive.current) setChecking(false); }
  }, [request]);
  useEffect(() => { alive.current = true; void load(); void check(); return () => { alive.current = false; }; }, [load, check]);
  useEffect(() => {
    if (!claim?.pending) return;
    const timer = setInterval(() => { void check().then(next => { if (next && !next.pending) void load(); }); }, 4000);
    return () => clearInterval(timer);
  }, [claim?.pending, check, load]);
  async function claimFees() {
    if (busy.current || !statusReady || claim?.pending) return;
    busy.current = true; setClaiming(true); setClaimError('');
    try {
      const response = await request('/api/admin/token-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim-fees', requestId: crypto.randomUUID() }), signal: AbortSignal.timeout(55000) });
      if (!response.ok) throw Error('Claim response unavailable');
      const next = await response.json();
      if (!next.claim || typeof next.claim.pending !== 'boolean') throw Error('Invalid claim response');
      if (alive.current) setClaim(next.claim);
      await load();
    } catch { await check(); if (alive.current) setClaimError('The request was interrupted. Check the saved claim status before retrying.'); }
    finally { busy.current = false; if (alive.current) setClaiming(false); }
  }
  if (!data) return <section className={styles.state} aria-busy={loading}>{loading ? <p role="status"><Loader2 className={styles.spinner} size={20}/>Loading agent tokens…</p> : <><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void load()}>Try again</button></>}</section>;
  const pending = claiming || !!claim?.pending;
  const checkingInitialStatus = checking && !statusReady;
  return <div className={styles.panel}>
    <header className={styles.heading}><div><h2>Agent tokens <span>{data.stats.totalLaunched}</span></h2><p>{data.stats.byChain.solana} on Solana · {data.stats.byChain.robinhood} on Robinhood</p></div><button className={styles.secondary} disabled={loading} onClick={() => void load()}>{loading ? <Loader2 className={styles.spinner} size={16}/> : <RefreshCw size={16}/>}Refresh</button></header>
    {error && <p className={styles.error} role="alert">{error} Displayed values are from the last successful refresh.</p>}
    <dl className={styles.summary}><div><dt>Today</dt><dd>{data.stats.launchesToday}</dd></div><div><dt>This month</dt><dd>{data.stats.launchesThisMonth}</dd></div><div><dt>Pending</dt><dd>{data.stats.totalQueued}</dd></div><div><dt>Failed</dt><dd>{data.stats.totalFailed}</dd></div></dl>
    <section aria-labelledby="agent-launches-heading"><h3 id="agent-launches-heading">Recent launches</h3>{!data.recentLaunches.length ? <p className={styles.muted}>No agent tokens launched yet.</p> : <ul className={styles.launches}>{data.recentLaunches.map(row => <li key={row.id}><div className={styles.identity}><strong>{row.agentName}</strong><span>{row.tokenSymbol ? `$${row.tokenSymbol} · ` : ''}{row.chain || 'Solana'}{row.status !== 'launched' ? ` · ${row.status}` : ''}</span></div><time>{date(row.createdAt)}</time>{(row.tradeUrl || row.bagsUrl) && <a className={styles.trade} href={row.tradeUrl || row.bagsUrl!} target="_blank" rel="noopener noreferrer" aria-label={`Trade ${row.tokenSymbol || row.agentName} on ${row.chain === 'Robinhood' ? 'Pons' : 'Bags'}`}>Trade<ArrowUpRight size={16} aria-hidden="true"/></a>}</li>)}</ul>}</section>
    <section className={styles.fees} aria-labelledby="agent-fees-heading">
      <header className={styles.feeHeading}><div><h3 id="agent-fees-heading">Solana creator fees</h3><p className={styles.claimable}>{amount(data.revenue.totalClaimable)}<span>claimable</span></p></div><button className={styles.primary} disabled={pending || !statusReady || !!error || !!data.revenue.error || data.revenue.totalClaimable === null || data.revenue.totalClaimable <= 0} onClick={() => void claimFees()}>{(pending || checkingInitialStatus) && <Loader2 className={styles.spinner} size={17}/>} {pending ? 'Claiming fees…' : checkingInitialStatus ? 'Checking status…' : 'Claim fees'}</button></header>
      <p className={styles.wallet}>Fee wallet {data.stats.walletAddress ? `${data.stats.walletAddress.slice(0, 6)}…${data.stats.walletAddress.slice(-4)}` : 'unavailable'} · {amount(data.stats.walletBalance)}</p>
      {data.revenue.error && <p role="alert" className={styles.error}>{data.revenue.error}</p>}
      {claimError && <p role="alert" className={styles.error}>{claimError}</p>}
      {(claimError || claim?.pending) && <button className={styles.secondary} disabled={checking} onClick={() => void check().then(next => { if (next && !next.pending) void load(); })}>{checking && <Loader2 className={styles.spinner} size={16}/>}Check status</button>}
      {claim && <div className={styles.result} role={claim.error || claim.failed ? "alert" : "status"}><p>{claim.pending && <Loader2 className={styles.spinner} size={16}/>} {claim.message}</p>{claim.transactions.map((tx, index) => <a key={tx.signature} href={`https://solscan.io/tx/${encodeURIComponent(tx.signature)}`} target="_blank" rel="noopener noreferrer">{tx.confirmed ? 'Confirmed' : tx.failed ? 'Failed or expired' : 'Pending'} transaction {index + 1}<ArrowUpRight size={15} aria-hidden="true"/></a>)}</div>}
      {!!data.revenue.perTokenFees.length && <section className={styles.breakdown} aria-labelledby="token-fees-heading"><h4 id="token-fees-heading">Trading fees by token</h4>{data.revenue.feesTruncated && <p className={styles.muted}>Showing 20 recent tokens.</p>}<ul>{data.revenue.perTokenFees.map(token => <li key={token.mintAddress}><a href={token.bagsUrl} target="_blank" rel="noopener noreferrer" aria-label={`${token.name} on Bags`}>{token.name}<ArrowUpRight size={14} aria-hidden="true"/></a><span>{amount(token.lifetimeFees)}</span></li>)}</ul></section>}
    </section>
  </div>;
}
