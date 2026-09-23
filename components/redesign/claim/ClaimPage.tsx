'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { compactHive as tokens, exactHive } from '@/lib/hive-claim-format';
import { migrationReview, parseOldHiveInput } from '@/lib/hive-claim-review';
import { isReimbursementLookup, type ReimbursementLookup } from '@/lib/hive-reimbursement';
import styles from './claim.module.css';
import LiveMigration from './LiveMigration';
import { claimCountdown, type ClaimSchedule } from '@/lib/hive-claim-schedule';

const reasons: Record<string, string> = {
  'snapshot-required': 'This wallet is not eligible.',
  'snapshot-below-minimum': 'Not eligible: less than 1M old HIVE at the snapshot.',
  'custody-review': 'This wallet needs an eligibility review.',
  'balance-unavailable': 'Balance unavailable. Try again.',
  'no-holdings': 'At least 1M old HIVE is required in this wallet.',
  'below-minimum': 'At least 1M old HIVE is required in this wallet.',
};
export default function ClaimPage({ schedule = null }: { schedule?: ClaimSchedule }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  const windowOpen = !!schedule && now !== null && now >= schedule.opensAt && now < schedule.closesAt;
  const [address, setAddress] = useState(''), [result, setResult] = useState<ReimbursementLookup | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [migrationEnabled, setMigrationEnabled] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/token/claim/migration', { cache: 'no-store', signal: abort.signal }).then(r => r.ok ? r.json() : { enabled: false }).then(v => setMigrationEnabled(v.enabled === true)).catch(() => {});
    const timer = setInterval(() => { fetch('/api/token/claim/migration', { cache: 'no-store', signal: abort.signal }).then(r => r.ok ? r.json() : { enabled: false }).then(v => setMigrationEnabled(v.enabled === true)).catch(() => setMigrationEnabled(false)); }, 30000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (reviewOpen) reviewHeading.current?.focus(); }, [reviewOpen]);
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
      if (controller.current === request) { setResult(data); setReviewOpen(openReview); }
    } catch (reason) {
      if (controller.current === request) setError(request.signal.aborted ? 'The lookup timed out. Please try again.' : reason instanceof Error ? reason.message : 'The lookup is unavailable. Please try again.');
    } finally { clearTimeout(timeout); if (controller.current === request) setLoading(false); }
  }
  function edit(value: string) { controller.current?.abort(); controller.current = null; setAddress(value); setReviewOpen(false); setResult(null); setError(''); setLoading(false); }
  const preview = result ? migrationReview(result) : null;
  return <section className={styles.main} aria-label="HIVE migration">
    {reviewOpen && result ? <>
      <button className={styles.back} onClick={() => setReviewOpen(false)}><ArrowLeft size={16} aria-hidden="true" />Back</button>
      <header className={styles.heading}><span className={styles.label}>2 / 2</span><h1 ref={reviewHeading} tabIndex={-1}>Deposit &amp; claim</h1></header>
      <Migration result={result} enabled={migrationEnabled} canStart={windowOpen} />
    </> : <>
      <header className={styles.heading}><span className={styles.label}>SOLANA → ROBINHOOD</span><h1>Claim HIVE</h1><p>HIVE has migrated from Solana to Robinhood Chain. Check your old HIVE wallet below for your new HIVE allocation.</p></header>
      <section className={styles.checker} aria-label="Wallet checker">
        <form onSubmit={event => lookup(event)} noValidate aria-busy={loading}>
          <label htmlFor="claim-owner">Solana wallet address</label>
          <div className={styles.formRow}><input ref={input} id="claim-owner" type="text" value={address} onChange={event => edit(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} aria-invalid={!!error} aria-describedby={error ? 'claim-error' : undefined} placeholder="Your old HIVE wallet" /><button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Check'}</button></div>
          {error && <p id="claim-error" role="alert" className={styles.error}>{error}</p>}
        </form>
        <div aria-live="polite">
          {result && preview && <div className={styles.result}>
            {preview.receiveRaw !== null ? <><span className={styles.label}>Holding requirement met</span><dl className={styles.amounts}><div><dt>New HIVE · estimated</dt><dd>{tokens(preview.receiveRaw, 18)} HIVE</dd></div></dl><form onSubmit={event => lookup(event, true)}><button className={styles.primary} disabled={loading}>Next<ArrowRight size={16} aria-hidden="true" /></button></form></> : <><p>{reasons[preview.status]}</p>{result.status === 'allocation-pending' && <button className={styles.secondary} onClick={() => setReviewOpen(true)}>View existing claim</button>}</>}
          </div>}
        </div>
      </section>
    </>}
    {schedule && now !== null ? <div className={styles.countdown}>
      <span>{now < schedule.opensAt ? (new Date(now + 86400000).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' }) === new Date(schedule.opensAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' }) ? 'Claims start tomorrow' : 'Claims start soon') : now >= schedule.closesAt ? 'Claims closed' : migrationEnabled ? 'Claims close in' : 'Claims opening soon'}</span>
      {(now < schedule.opensAt || (windowOpen && migrationEnabled)) && <time role="timer" aria-label={now < schedule.opensAt ? 'Time until claims open' : 'Time until claims close'}>{claimCountdown(schedule, now)}</time>}
    </div> : <p className={styles.hint}>Claims start soon</p>}
  </section>;
}

function Migration({ result, enabled, canStart }: { result: ReimbursementLookup; enabled: boolean; canStart: boolean }) {
  const maximum = migrationReview(result);
  const [amount, setAmount] = useState(() => maximum.depositRaw ? exactHive(maximum.depositRaw, 9) : '');
  const parsed = parseOldHiveInput(amount);
  const review = migrationReview(result, parsed ?? '0');
  return <section className={styles.checker} aria-label="Deposit and claim">
    {maximum.depositRaw === null ? <p>{reasons[maximum.status]}</p> : <>
      <div className={styles.depositInput}><label htmlFor="deposit-amount">Deposit old HIVE</label><div className={styles.formRow}><input id="deposit-amount" type="text" inputMode="decimal" value={amount} maxLength={30} onChange={event => setAmount(event.target.value)} aria-invalid={review.status === 'invalid-amount'} aria-describedby="deposit-hint" /><button type="button" onClick={() => setAmount(exactHive(maximum.depositRaw!, 9))}>Max</button></div><p id="deposit-hint" className={styles.hint}>Available: {tokens(maximum.depositRaw, 9)} HIVE</p>{review.status === 'invalid-amount' && <p role="alert" className={styles.error}>Enter a valid amount within your available balance.</p>}</div>
      {review.receiveRaw !== null && <dl className={styles.amounts}><div><dt>Receive new HIVE · estimated</dt><dd>{tokens(review.receiveRaw, 18)} HIVE</dd></div></dl>}
    </>}
    <LiveMigration key={result.owner + ':' + review.depositRaw} owner={result.owner} amount={review.depositRaw} enabled={enabled} canStart={canStart} />
  </section>;
}
