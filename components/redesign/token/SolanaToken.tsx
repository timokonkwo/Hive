"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { useWalletChoices } from '../wallet/useWalletChoices';
import { TaskDialog } from '../task/TaskDialog';
import { useRead, type Request } from '../disputes/useRead';
import { write, WriteError } from '../tools/model';
import { newRequestId } from '../disputes/model';
import { solanaHive } from '@/lib/hive-launch';
import { obj, readStake, readReceipt, validateAmount, format, stamp, amount, rawText, claimable, sig, type Position, type Receipt, type Exit } from './model';
import { broadcastStake, checkTransfer, prepareStake, signedReference, connection, type Prepared } from './transfer';
import styles from './token.module.css';
function LoadingError({ loading, error, retry }: { loading?: boolean; error?: string; retry: () => void }) { return loading ? <p className={styles.state} role="status">Loading staking details…</p> : error ? <div className={styles.state} role="alert"><p>{error}</p><button className={styles.secondary} onClick={retry}>Try again</button></div> : null; }
function TokenAddress() { const [notice, setNotice] = useState(''); return <div className={styles.contract}><span>Solana token</span><code>{solanaHive.mint}</code><button className={styles.icon} aria-label="Copy Solana token address" onClick={async () => { try { await navigator.clipboard.writeText(solanaHive.mint); setNotice('Token address copied.'); } catch { setNotice('Copy was blocked. Select and copy the address.'); } }}><Copy size={16} /></button>{notice && <p role="status">{notice}</p>}</div>; }
export function SolanaToken({ view }: { view: 'trade' | 'stake' }) {
  const { ready, user, login } = useAuth(), request = useAuthFetch();
  return <div className={styles.solana} data-token-enter><TokenAddress />{view === 'trade' ? <section className={styles.tradeLink}><div><h2>Trade HIVE on Solana</h2><p>View the market and trade on Bags.</p></div><a className={styles.primary} href={solanaHive.tradeUrl} target="_blank" rel="noopener noreferrer">Open Bags<ArrowUpRight size={16} aria-hidden="true" /></a></section> : <Account key={(user?.id || '') + ':' + (user?.wallet?.address || '')} ready={ready} request={request} login={login} />}</div>;
}
function Account({ ready, request, login }: { ready: boolean; request: Request; login: () => void }) {
  const [revision, setRevision] = useState(0), r = useRead(ready ? '/api/staking' : null, revision, readStake, request);
  if (!ready || r.loading) return <LoadingError loading retry={() => setRevision(v => v + 1)} />;
  if (r.status === 401) return <section className={styles.signIn}><h2>Your Solana stake</h2><p>Sign in to view your stake or request a withdrawal.</p><button className={styles.primary} onClick={login}>Sign in</button></section>;
  return r.data ? <PositionView key={r.data.account} initial={r.data} request={request} /> : <LoadingError error={r.error} retry={() => setRevision(v => v + 1)} />;
}
function History({ account, revision, request }: { account: string; revision: number; request: Request }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const parse = useCallback((v: unknown) => { const d = obj(v); if (d.accountId !== account || !Array.isArray(d.history) || !Number.isSafeInteger(d.total) || d.total < 0) throw Error('Activity could not be read.'); return { total: d.total as number, rows: d.history.map(v => { const e = obj(v); return { id: String(e.id), type: String(e.type), status: String(e.status), amount: amount(e.amount), date: e.createdAt, signature: sig(e.txSignature) ? e.txSignature : '' }; }) }; }, [account]);
  const r = useRead(`/api/staking?history=1&page=${page}`, revision + retry, parse, request);
  return <section className={styles.history}><h2>Activity</h2><LoadingError {...r} retry={() => setRetry(v => v + 1)} />{r.data && <>{r.data.rows.length ? <ul>{r.data.rows.map(e => <li key={e.id}><div><strong>{({ stake: 'Stake transfer', unstake_requested: 'Unstake requested', unstake_claimed: 'Withdrawal claimed' } as Record<string, string>)[e.type] || 'Stake update'}</strong><time>{stamp(e.date)}</time></div><div><span>{format(e.amount)} HIVE</span><span className={styles.hint}>{e.status === 'verified' ? 'Recorded' : e.status === 'cooldown' ? 'In cooldown' : 'Unconfirmed'}</span></div>{e.signature && <a className={styles.secondary} href={`https://solscan.io/tx/${e.signature}`} target="_blank" rel="noopener noreferrer" aria-label="View transaction"><ArrowUpRight size={16} /></a>}</li>)}</ul> : <p className={styles.hint}>No staking activity recorded.</p>}{r.data.total > 20 && <nav className={styles.actions} aria-label="Activity pages"><button className={styles.secondary} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {Math.ceil(r.data.total / 20)}</span><button className={styles.secondary} disabled={page * 20 >= r.data.total} onClick={() => setPage(p => p + 1)}>Next</button></nav>}</>}</section>;
}
function PositionView({ initial, request }: { initial: Position; request: Request }) {
  const [p, setP] = useState(initial), [mode, setMode] = useState<'stake' | 'unstake'>('stake'), [input, setInput] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0), [pending, setPending] = useState<Receipt | null>(null), [review, setReview] = useState<{ kind: 'stake' | 'unstake' | 'claim'; amount: string; prepared?: Prepared; exit?: Exit } | null>(null), [now, setNow] = useState(() => Date.now());
  const wallets = useWallets(), walletChoices = useWalletChoices(), { signTransaction } = useSignTransaction(), lock = useRef(false), active = useRef(true), currentWallets = useRef(wallets.wallets); currentWallets.current = wallets.wallets;
  const storageKey = 'hive-staking-request:' + p.account;
  useEffect(() => { active.current = true; try { setPending(readReceipt(JSON.parse(localStorage.getItem(storageKey) || 'null'))); } catch { /* A new write must save its receipt successfully. */ } const clock = setInterval(() => setNow(Date.now()), 1000); return () => { active.current = false; clearInterval(clock); }; }, [storageKey]);
  useEffect(() => { if (!busy && !input) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', guard); return () => removeEventListener('beforeunload', guard); }, [busy, input]);
  const parseBalance = useCallback((v: unknown) => { const d = obj(v); if (d.wallet !== p.address || amount(d.balance) === null) throw Error('Balance could not be read.'); return { balance: amount(d.balance), cached: d.cached === true }; }, [p.address]);
  const balance = useRead(p.address ? `/api/token/verify-holder?wallet=${encodeURIComponent(p.address)}` : null, revision, parseBalance);
  function remember(r: Receipt) { localStorage.setItem(storageKey, JSON.stringify(r)); setPending(r); }
  function clear() { try { localStorage.removeItem(storageKey); } catch { /* Rechecking the same receipt is safe after reload. */ } setPending(null); }
  async function fresh() { const res = await request('/api/staking', { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!res.ok) throw Error('Your stake could not be refreshed. Try again.'); const d = readStake(await res.json()); if (d.account !== initial.account) throw Error('The account changed. Reload before continuing.'); if (active.current) { setP(d); setRevision(v => v + 1); } return d; }
  async function refresh() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await fresh(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Refresh failed.'); } finally { lock.current = false; if (active.current) setBusy(false); } }
  async function openReview(exit?: Exit) {
    if (lock.current || pending) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const latest = await fresh(); if (!active.current) return;
      if (exit) { const current = latest.exits.find(e => e.id === exit.id); if (!current || !claimable(current, Date.now())) throw Error('This withdrawal is not available to claim.'); setReview({ kind: 'claim', amount: current.amount, exit: current }); return; }
      const quantity = validateAmount(input, mode, latest);
      if (mode === 'stake') { if (!latest.verified || !latest.address) throw Error('Link and verify your Solana wallet in Account settings first.'); if (!currentWallets.current.some(w => w.address === latest.address)) throw Error('Connect the Solana wallet shown in your staking account.'); const prepared = await prepareStake(latest.address, latest.treasury, quantity); if (active.current) setReview({ kind: 'stake', amount: quantity, prepared }); }
      else setReview({ kind: 'unstake', amount: quantity });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'The action could not be reviewed.'); } finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function reconcile(receipt = pending) {
    if (!receipt) return;
    const res = await request('/api/staking?reference=' + encodeURIComponent(receipt.reference), { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!res.ok) throw Error('The recorded result could not be checked.'); const d = obj(await res.json()), event = obj(d.event), exit = obj(d.request);
    const recorded = receipt.kind === 'stake' ? event.type === 'stake' && event.status === 'verified' && event.solanaAddress === receipt.address && amount(event.amount) === receipt.amount && event.txSignature === receipt.reference : receipt.kind === 'unstake' ? exit.id === receipt.reference && amount(exit.amount) === receipt.amount : exit.id === receipt.reference && exit.status === 'claimed' && sig(exit.claimTxSignature) && amount(exit.amount) === receipt.amount;
    if (!active.current) return;
    if (recorded) { clear(); setInput(''); setNotice(receipt.kind === 'stake' ? 'Your stake is recorded.' : receipt.kind === 'unstake' ? 'Your unstake request is recorded.' : 'Your withdrawal is recorded.'); await fresh(); return; }
    if (receipt.kind === 'stake') {
      const chain = await checkTransfer(receipt.reference); if (!active.current) return;
      if (chain === 'failed') { clear(); setNotice('The transaction failed on Solana. No stake was recorded.'); return; }
      if (chain === 'confirmed' && !d.event) {
        await write(request, '/api/staking', { txSignature: receipt.reference, solanaAddress: receipt.address, amountHive: receipt.amount });
        if (active.current) { setNotice('Transfer confirmed. Check once more to confirm the stake record.'); await fresh(); }
        return;
      }
    }
    setNotice('The result is still unconfirmed. Keep this reference and check again. Do not send another transfer.');
  }
  async function checkPending() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await reconcile(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'The result could not be checked.'); } finally { lock.current = false; if (active.current) setBusy(false); } }
  async function submit() {
    if (!review || lock.current || pending) return; lock.current = true; setBusy(true); setError(''); let sent = false, receipt: Receipt | null = null;
    try {
      const latest = await fresh(); if (!active.current) return;
      if (latest.address !== p.address || latest.treasury !== p.treasury) throw Error('The staking wallet or destination changed. Close this review and refresh.');
      if (review.kind === 'stake') {
        validateAmount(review.amount, 'stake', latest); const prepared = review.prepared!, wallet = currentWallets.current.find(w => w.address === latest.address);
        if (!wallet || !latest.verified) throw Error('Connect the verified staking wallet again.');
        if (await connection().getBlockHeight('confirmed') > prepared.blockHeight) throw Error('This transaction expired. Close the review and prepare it again.');
        const result = await signTransaction({ transaction: prepared.bytes, wallet, chain: 'solana:mainnet' }); if (!active.current) return;
        if (!currentWallets.current.some(w => w.address === latest.address)) throw Error('The connected wallet changed. No transaction was sent.');
        const reference = signedReference(result.signedTransaction, prepared);
        receipt = { kind: 'stake', reference, address: latest.address, amount: review.amount, treasury: latest.treasury }; remember(receipt); sent = true;
        await broadcastStake(result.signedTransaction, reference);
        if (active.current) { setReview(null); setNotice('Transfer sent. Check its result below before staking again.'); await reconcile(receipt); }
      } else {
        if (review.kind === 'unstake') validateAmount(review.amount, 'unstake', latest);
        else if (!latest.exits.some(e => e.id === review.exit?.id && e.amount === review.amount && claimable(e, Date.now()))) throw Error('This withdrawal changed. Close the review and refresh.');
        receipt = { kind: review.kind, reference: review.kind === 'claim' ? review.exit!.id : newRequestId(), address: latest.address, amount: review.amount }; remember(receipt); sent = true;
        const d = await write(request, '/api/staking', review.kind === 'unstake' ? { action: 'request_unstake', amountHive: review.amount, requestId: receipt.reference } : { action: 'claim_unstake', requestId: receipt.reference });
        if (!active.current) return;
        if (d.success !== true || (review.kind === 'unstake' ? obj(d.request).id !== receipt.reference : !sig(d.txSignature) || amount(d.claimedAmount) !== review.amount)) throw Error('The result could not be confirmed.');
        setReview(null); await reconcile(receipt);
      }
    } catch (e) { if (!active.current) return; if (sent && (review.kind === 'stake' || !(e instanceof WriteError) || e.status >= 500 || e.status === 409)) { setReview(null); setError('The result is not confirmed. Check the saved reference before another action.'); } else { if (sent) clear(); setError(e instanceof Error ? e.message : 'The action was not completed.'); } } finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <>
    <div className={styles.positionHeading}><h2>Your Solana stake</h2><button className={styles.secondary} disabled={busy} aria-label="Refresh Solana stake" onClick={refresh}><RefreshCw size={16} />Refresh</button></div>
    {pending && <section className={styles.pending} aria-label="Pending staking action"><h3>Check your last {pending.kind === 'claim' ? 'withdrawal' : pending.kind === 'unstake' ? 'unstake request' : 'stake'}</h3><p>{format(pending.amount)} HIVE</p><code>{pending.reference}</code><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={checkPending}>{busy ? 'Checking…' : 'Check saved result'}</button>{pending.kind === 'stake' && <a className={styles.secondary} href={`https://solscan.io/tx/${pending.reference}`} target="_blank" rel="noopener noreferrer">View transaction<ArrowUpRight size={16} /></a>}<Link className={styles.secondary} href="/feedback">Get help</Link></div></section>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    <dl className={styles.positions}><div><dt>Active stake</dt><dd>{format(p.active)}<span>HIVE</span></dd></div><div><dt>In cooldown</dt><dd>{format(p.locked)}<span>HIVE</span></dd></div><div><dt>Wallet balance</dt><dd>{balance.loading ? 'Loading…' : balance.error ? 'Unavailable' : balance.data ? format(balance.data.balance) : 'Not connected'}<span>{balance.data ? 'HIVE' : ''}</span></dd></div></dl>{balance.data?.cached && <p className={styles.hint}>Wallet balance may be up to five minutes old.</p>}
    <div className={styles.stakeLayout}><section className={styles.editor}><nav className={styles.mode} aria-label="Solana staking action"><button aria-pressed={mode === 'stake'} disabled={busy || !!pending} onClick={() => { setMode('stake'); setInput(''); setError(''); }}>Stake</button><button aria-pressed={mode === 'unstake'} disabled={busy || !!pending} onClick={() => { setMode('unstake'); setInput(''); setError(''); }}>Unstake</button></nav><form onSubmit={e => { e.preventDefault(); void openReview(); }}><label className={styles.field}>Amount<div className={styles.amountBox}><input value={input} onChange={e => setInput(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="0" maxLength={30} required disabled={busy || !!pending} /><span>HIVE</span></div></label><p className={styles.hint}>{mode === 'stake' ? `Minimum active stake: ${format(p.minimum)} HIVE.` : `Available to unstake: ${format(p.active)} HIVE.`}</p><button className={styles.primary} disabled={busy || !!pending || (mode === 'stake' && !p.verified)}>{busy ? 'Checking…' : `Review ${mode}`}</button></form>{mode === 'stake' && (!p.verified ? <Link className={styles.settingsLink} href="/dashboard?view=account">Verify wallet in Account settings<ArrowUpRight size={16} /></Link> : <button className={styles.secondary} disabled={busy || !!pending} onClick={() => walletChoices.connect('solana')}>Connect Solana wallet</button>)}{p.address && <p className={styles.walletLabel}>Staking wallet<code>{p.address}</code></p>}</section>
    <aside className={styles.terms}><h3>Staking terms</h3><dl className={styles.summary}><div><dt>Current tier</dt><dd>{p.tier}</dd></div><div><dt>Unstake cooldown</dt><dd>{p.cooldown} days</dd></div></dl><p>Staked tokens are held in the Hive treasury.</p>{p.benefitsStop && <p>Benefits stop for the amount you request to unstake.</p>}{p.atRisk && <p>Tokens in cooldown can still be removed if a dispute is upheld.</p>}<details><summary>Treasury address</summary><code>{p.treasury}</code></details><Link href="/dao">View disputes<ArrowUpRight size={15} /></Link></aside></div>
    {p.exits.length > 0 && <section className={styles.withdrawals}><h2>Withdrawals</h2><ul>{p.exits.map(e => <li key={e.id}><div><strong>{format(e.amount)} HIVE</strong><p>{e.status === 'slashed' ? 'Stake removed' : e.status === 'claiming' ? 'Claim pending confirmation' : 'Available ' + stamp(e.unlocksAt)}</p></div>{e.status === 'cooldown' && <button className={styles.secondary} disabled={busy || !!pending || !claimable(e, now)} onClick={() => openReview(e)}>Claim</button>}{e.signature && <a className={styles.secondary} href={`https://solscan.io/tx/${e.signature}`} target="_blank" rel="noopener noreferrer">View transaction<ArrowUpRight size={16} /></a>}</li>)}</ul></section>}
    <section className={styles.tiers}><h2>Solana staking tiers</h2><div className={styles.tableWrap}><table><thead><tr><th>Tier</th><th>Active HIVE</th><th>Tool discount</th><th>Points</th><th>Vote weight</th></tr></thead><tbody>{p.tiers.map(t => <tr key={t.label}><th scope="row">{t.label}</th><td>{format(t.threshold)}+</td><td>{t.discount}%</td><td>{t.points}×</td><td>{t.votes}×</td></tr>)}</tbody></table></div></section>
    <History account={p.account} revision={revision} request={request} />
    {review && <TaskDialog title={review.kind === 'stake' ? 'Review stake' : review.kind === 'unstake' ? 'Review unstake' : 'Review withdrawal'} busy={busy} close={() => setReview(null)}><div className={styles.review}><dl className={styles.summary}><div><dt>Network</dt><dd>Solana</dd></div><div><dt>Amount</dt><dd>{format(review.amount)} HIVE</dd></div><div><dt>{review.kind === 'claim' ? 'Receive at' : 'Staking wallet'}</dt><dd><code>{p.address}</code></dd></div>{review.kind === 'stake' && <><div><dt>Token</dt><dd><code>{solanaHive.mint}</code></dd></div><div><dt>Hive treasury</dt><dd><code>{p.treasury}</code></dd></div><div><dt>Network fee</dt><dd>{rawText(BigInt(review.prepared!.fee))} SOL</dd></div>{review.prepared!.rent > 0 && <div><dt>Token account cost</dt><dd>{rawText(BigInt(review.prepared!.rent))} SOL</dd></div>}</>}{review.kind === 'unstake' && <div><dt>Cooldown</dt><dd>{p.cooldown} days</dd></div>}</dl>{review.kind === 'unstake' && <p>Benefits stop for this amount. You can claim after the cooldown, unless a dispute blocks withdrawal.</p>}<div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className={styles.primary} disabled={busy} onClick={submit}>{busy ? 'Confirming…' : review.kind === 'stake' ? 'Sign and stake' : review.kind === 'unstake' ? 'Request unstake' : 'Claim HIVE'}</button></div>{error && <p className={styles.error} role="alert">{error}</p>}</div></TaskDialog>}
  </>;
}
