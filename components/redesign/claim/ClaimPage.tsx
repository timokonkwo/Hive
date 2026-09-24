'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, LoaderCircle, Wallet } from 'lucide-react';
import { compactHive as tokens } from '@/lib/hive-claim-format';
import { migrationReview } from '@/lib/hive-claim-review';
import { isReimbursementLookup, supplementalClaim, type ReimbursementLookup } from '@/lib/hive-reimbursement';
import styles from './claim.module.css';
import LiveMigration from './LiveMigration';
import { type ClaimSchedule } from '@/lib/hive-claim-schedule';

const reasons: Record<string, string> = {
  'snapshot-required': 'This wallet is not eligible.',
  'snapshot-below-minimum': 'Not eligible: less than 1M HIVE on Solana at the snapshot.',
  'custody-review': 'This wallet needs an eligibility review.',
  'balance-unavailable': 'Balance unavailable. Try again.',
  'no-holdings': 'At least 1M HIVE on Solana is required in this wallet.',
  'below-minimum': 'At least 1M HIVE on Solana is required in this wallet.',
};
export default function ClaimPage({ schedule = null }: { schedule?: ClaimSchedule }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const windowOpen = !!schedule && now !== null && now >= schedule.opensAt && now < schedule.closesAt;
  const [address, setAddress] = useState(''), [result, setResult] = useState<ReimbursementLookup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedClaim, setSavedClaim] = useState(false);
  useEffect(() => {
    try { const r = result && JSON.parse(localStorage.getItem('hive-migration-v5:' + result.owner) || 'null'); setSavedClaim(!!r?.solanaSignature && !!r?.evmSignature); } catch { setSavedClaim(false); }
  }, [result]);
  const [migrationEnabled, setMigrationEnabled] = useState(false);
  const [localTestOwner, setLocalTestOwner] = useState<string | null>(null);
  function availability(v: { enabled?: boolean; localTestOwner?: string }) { setMigrationEnabled(v.enabled === true); setLocalTestOwner(v.enabled === true && v.localTestOwner === supplementalClaim.owner ? v.localTestOwner : null); }
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/token/claim/migration', { cache: 'no-store', signal: abort.signal }).then(r => r.ok ? r.json() : { enabled: false }).then(availability).catch(() => {});
    const timer = setInterval(() => { fetch('/api/token/claim/migration', { cache: 'no-store', signal: abort.signal }).then(r => r.ok ? r.json() : { enabled: false }).then(availability).catch(() => setMigrationEnabled(false)); }, 30000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  const input = useRef<HTMLInputElement>(null), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function lookup(event: FormEvent, openReview = false) {
    event.preventDefault(); controller.current?.abort(); setResult(null); setReviewOpen(false); setError('');
    const owner = address.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) { setError('Enter a valid public Solana wallet address.'); input.current?.focus(); return; }
    const request = new AbortController(); controller.current = request; setLoading(true);
    const timeout = setTimeout(() => request.abort(), 15000);
    try {
      const response = await fetch('/api/token/claim?owner=' + encodeURIComponent(owner), { signal: request.signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'The lookup is unavailable. Please try again.');
      if (!isReimbursementLookup(data, owner)) throw Error('Could not verify the lookup result. Please try again.');
      if (controller.current === request) { setResult(data); setReviewOpen(openReview); try { localStorage.setItem('hive-claim-last-owner', owner); } catch {} }
    } catch (reason) {
      if (controller.current === request) setError(request.signal.aborted ? 'The lookup timed out. Please try again.' : reason instanceof Error ? reason.message : 'The lookup is unavailable. Please try again.');
    } finally { clearTimeout(timeout); if (controller.current === request) setLoading(false); }
  }
  function edit(value: string) { controller.current?.abort(); controller.current = null; setAddress(value); setReviewOpen(false); setResult(null); setError(''); setLoading(false); }
  useEffect(() => {
    const abort = new AbortController();
    try {
      const last = localStorage.getItem('hive-claim-last-owner');
      const saved = last && JSON.parse(localStorage.getItem('hive-migration-v5:' + last) || 'null');
      if (last && saved?.owner === last && saved.solanaSignature && saved.evmSignature) {
        setAddress(last); setRestoring(true);
        fetch('/api/token/claim?owner=' + encodeURIComponent(last), { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), cache: 'no-store' }).then(r => r.json()).then(data => {
          if (!abort.signal.aborted && isReimbursementLookup(data, last)) { setResult(data); setReviewOpen(true); }
        }).catch(() => {}).finally(() => { if (!abort.signal.aborted) setRestoring(false); });
      }
    } catch {}
    return () => abort.abort();
  }, []);
  const preview = result ? migrationReview(result) : null;
  const localTest = !!result && result.owner === localTestOwner;
  const claimReady = (windowOpen || localTest) && migrationEnabled;
  return <section className={styles.main} aria-label="HIVE migration">
    {restoring ? <div className={styles.flowState} role="status" aria-busy="true"><LoaderCircle className={styles.stateIcon + ' ' + styles.spinner} aria-hidden="true" /><h2>Loading your claim</h2></div> : reviewOpen && result ? <>
      <LiveMigration key={result.owner} result={result} canStart={claimReady} onBack={() => setReviewOpen(false)} />
    </> : <>
      <div className={styles.intro}><header className={styles.heading}><span className={styles.label}>SOLANA → ROBINHOOD</span><h1>Claim HIVE</h1><p>HIVE has migrated to Robinhood Chain. Check your Solana wallet to see your allocation.</p></header>{localTestOwner ? <aside className={styles.countdown}><span>Local claim test</span></aside> : <ClaimCountdown schedule={schedule} now={now} enabled={migrationEnabled} />}</div>
      <section className={styles.checker} aria-label="Wallet checker">
        <div className={styles.checkerTitle}><Wallet size={20} aria-hidden="true" /><h2>Check your allocation</h2></div>
        <form onSubmit={event => lookup(event)} noValidate aria-busy={loading}>
          <label htmlFor="claim-owner">Solana wallet address</label>
          <div className={styles.formRow}><input ref={input} id="claim-owner" type="text" value={address} onChange={event => edit(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} aria-invalid={!!error} aria-describedby={error ? 'claim-error' : undefined} placeholder="Enter your Solana wallet address" /><button type="submit" disabled={loading}>{loading ? <><LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />Checking…</> : <>Check wallet<ArrowRight size={16} aria-hidden="true" /></>}</button></div>
          {error && <p id="claim-error" role="alert" className={styles.error}>{error}</p>}
        </form>
        <div aria-live="polite">
          {loading && <div className={styles.checking} role="status"><LoaderCircle className={styles.spinner} size={16} aria-hidden="true" /><span className={styles.scan} aria-hidden="true" />Checking snapshot and current holdings…</div>}
          {result && preview && <div className={styles.result}>
            {savedClaim && <button className={styles.primary} onClick={() => setReviewOpen(true)}>View your claim<ArrowRight size={16} /></button>}
            {!savedClaim && (preview.receiveRaw !== null ? <><span className={styles.eligible}><Check size={16} aria-hidden="true" />Holding requirement met</span><dl className={styles.amounts}><div><dt>HIVE on Robinhood · estimated</dt><dd>{tokens(preview.receiveRaw, 18)} HIVE</dd></div></dl>{claimReady && !savedClaim && <form onSubmit={event => lookup(event, true)}><button className={styles.primary} disabled={loading}>Continue to claim<ArrowRight size={16} aria-hidden="true" /></button></form>}</> : <><p>{reasons[preview.status]}</p>{!savedClaim && claimReady && ['allocation-pending','approved-exception'].includes(result.status) && <button className={styles.secondary} onClick={() => setReviewOpen(true)}>View existing claim</button>}</>)}
          </div>}
        </div>
      </section>
    </>}
    {!reviewOpen && <section className={styles.faq} aria-labelledby="claim-faq-title"><h2 id="claim-faq-title">How it works</h2>
      {[
        ['How do I claim?', 'When claims open, connect your Solana and Robinhood wallets, deposit your eligible HIVE on Solana, and receive your allocation of HIVE on Robinhood. Each wallet can claim once.'],
        ['Who is eligible?', 'Your wallet needed at least 1M HIVE on Solana at the snapshot and must still hold at least 1M when you deposit.'],
        ['How much will I receive?', 'Your allocation is proportional to the HIVE you deposit. You can deposit all or part of your eligible balance, up to your snapshot holding; a smaller deposit receives proportionally less. Your estimate appears above before you connect a wallet.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{answer}</p></details>)}
    </section>}
  </section>;
}

function ClaimCountdown({ schedule, now, enabled }: { schedule: ClaimSchedule; now: number | null; enabled: boolean }) {
  if (!schedule) return <aside className={styles.countdown}><span>Claims start soon</span></aside>;
  const started = now !== null && now >= schedule.opensAt;
  const closed = now !== null && now >= schedule.closesAt;
  const remaining = now === null ? null : Math.max(0, Math.floor(((started ? schedule.closesAt : schedule.opensAt) - now) / 1000));
  const values = remaining === null ? ['--', '--', '--', '--'] : [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60].map(n => String(n).padStart(2, '0'));
  return <aside className={styles.countdown} aria-label="Claim schedule" data-opens-at={new Date(schedule.opensAt).toISOString()}><span>{closed ? 'Claims closed' : started ? enabled ? 'Claims close in' : 'Claims opening soon' : 'Claims start in'}</span>{!closed && (!started || enabled) && <div className={styles.clock} role="timer" aria-label={started ? 'Time until claims close' : 'Time until claims open'}>{['Days', 'Hours', 'Minutes', 'Seconds'].map((label, i) => <div key={label}><strong>{values[i]}</strong><span>{label}</span></div>)}</div>}</aside>;
}
