'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectWallet, useModalStatus, useWallets as useEvmWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignMessage, useSignTransaction } from '@privy-io/react-auth/solana';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, ExternalLink, LoaderCircle, Wallet, X, CircleAlert } from 'lucide-react';
import { VersionedTransaction } from '@solana/web3.js';
import { getBase58Decoder } from '@solana/kit';
import { getAddress } from 'viem';
import { supplementalClaim, reimbursementCampaign, type ReimbursementLookup } from '@/lib/hive-reimbursement';
import { migrationReview, parseOldHiveInput } from '@/lib/hive-claim-review';
import { proportionalQuote } from '@/tools/hive-migration/proportional-model.mjs';
import { compactHive, exactHive } from '@/lib/hive-claim-format';
import { robinhoodChain } from '@/lib/robinhood-chain';
import { claimProgress } from './claim-progress.mjs';
import styles from './claim.module.css';

type RequestTerms = { owner: string; recipient: string; amount: string; depositDeadline: string; nonce: string; solanaSignature?: string; evmSignature?: string };
type Quote = { request: RequestTerms; message: string; oldAmountRaw: string; newGrantRaw: string; expiresAt: string; reserved: false };
type Packet = { transactionBase64: string; packetId: string; lastValidBlockHeight: number };
type Status = { state: string; signature: string | null; submission?: string; deposit: Packet | null; payout?: { hash: string; status: string } | null };
type Problem = { title: string; detail: string; action: string; retry: () => void };
const short = (value: string) => value.slice(0, 5) + '…' + value.slice(-4);
async function call(action: string, input: unknown, signal?: AbortSignal) {
  const r = await fetch('/api/token/claim/migration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input }), cache: 'no-store', signal: signal ?? AbortSignal.timeout(35000) });
  const value = await r.json();
  if (!r.ok) throw Object.assign(Error(value.error || 'Connection interrupted. Try again.'), { code: value.code, recovery: value.recovery });
  return value;
}
function validateQuote(q: Quote, owner: string, recipient: string, amount: string) {
  if (!q || q.reserved !== false || !/^Hive redemption authorization v6\n/.test(q.message)) throw Error('Invalid quote.');
  const t = JSON.parse(q.message.slice(q.message.indexOf('\n') + 1));
  const extra = owner === supplementalClaim.owner;
  const expectedGrant = proportionalQuote(BigInt(amount), BigInt(extra ? supplementalClaim.allowanceRaw : reimbursementCampaign.eligibleOldRaw), BigInt(extra ? supplementalClaim.grantRaw : reimbursementCampaign.budgetRaw)).toString();
  if (q.newGrantRaw !== expectedGrant || t.totalEligibleOldRaw !== reimbursementCampaign.eligibleOldRaw || t.fundingBudgetRaw !== reimbursementCampaign.budgetRaw || t.exceptionOwner !== supplementalClaim.owner || t.exceptionAllowanceRaw !== supplementalClaim.allowanceRaw || t.exceptionGrantRaw !== supplementalClaim.grantRaw || t.eligibilityBasis !== (extra ? 'explicit_supplemental_exception' : 'frozen_snapshot')) throw Error('Quote allocation terms do not match this campaign.');
  if (q.request.owner !== owner || q.request.recipient !== recipient || q.request.amount !== amount || q.oldAmountRaw !== amount || q.request.depositDeadline !== q.expiresAt || t.owner !== owner || t.recipient !== recipient || t.oldAmountRaw !== amount || t.newGrantRaw !== q.newGrantRaw || t.nonce !== q.request.nonce || t.depositDeadline !== q.expiresAt || t.minimumSnapshotHoldingRaw !== (extra ? '0' : '1000000000000000') || t.minimumCurrentHoldingRaw !== '1000000000000000' || t.destinationChain !== '4663' || t.sourceMint !== '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS' || t.destinationToken.toLowerCase() !== '0xc65e9630d8af1ea278cbe359f78931684b4ff9f8' || !/^[1-9][0-9]{0,38}$/.test(q.newGrantRaw) || BigInt(q.newGrantRaw) > BigInt(amount) * 700000000n || BigInt(q.expiresAt) <= BigInt(Math.floor(Date.now() / 1000))) throw Error('Quote does not match your selected wallets and amount.');
}

export default function LiveMigration({ result, canStart, onBack }: { result: ReimbursementLookup; canStart: boolean; onBack: () => void }) {
  const owner = result.owner, maximum = migrationReview(result);
  const { wallets: solWallets } = useSolanaWallets();
  const { wallets: evmWallets } = useEvmWallets();
  const { signMessage } = useSignMessage(), { signTransaction } = useSignTransaction();
  const { isOpen: walletModalOpen } = useModalStatus();
  const [connecting, setConnecting] = useState<'solana' | 'ethereum' | null>(null);
  const connectionModalSeen = useRef(false);
  const [solAddress, setSolAddress] = useState(''), [evmAddress, setEvmAddress] = useState('');
  const [step, setStep] = useState<'wallets' | 'review'>('wallets');
  const [amount, setAmount] = useState(maximum.depositRaw ?? '0'), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const [request, setRequest] = useState<RequestTerms | null>(null), [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(''), [problem, setProblem] = useState<Problem | null>(null), [restored, setRestored] = useState(false);
  const [copied, setCopied] = useState(''), [slow, setSlow] = useState(false);
  const flowRef = useRef<HTMLElement>(null);
  const locked = useRef(false), alive = useRef(true), requestRef = useRef<RequestTerms | null>(null), choosing = useRef<'solana' | 'ethereum'>('solana');
  const storageKey = 'hive-migration-v5:' + owner;
  const sol = solWallets.find(w => w.address === solAddress);
  const evm = evmWallets.find(w => w.address.toLowerCase() === evmAddress.toLowerCase());
  const selected = useRef({ sol, evm }); selected.current = { sol, evm };
  const review = migrationReview(result, amount);
  const progress = claimProgress(status);
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      setConnecting(null);
      if (choosing.current === 'solana') {
        setSolAddress(wallet.address);
        if (wallet.address !== owner) setProblem({ title: 'Different Solana wallet', detail: 'Connect ' + short(owner) + ', the wallet you checked.', action: 'Change wallet', retry: () => choose('solana') });
      } else setEvmAddress(wallet.address);
    },
    onError: () => { setConnecting(null); setProblem({ title: 'Wallet not connected', detail: 'Unlock your wallet and try again.', action: 'Try again', retry: () => choose(choosing.current) }); },
  });
  useEffect(() => {
    const heading = flowRef.current?.querySelector<HTMLElement>('h1,h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [step, progress.phase, problem?.title, busy]);
  useEffect(() => {
    if (!connecting) return;
    if (walletModalOpen) connectionModalSeen.current = true;
    else if (connectionModalSeen.current) { setConnecting(null); connectionModalSeen.current = false; }
  }, [connecting, walletModalOpen]);
  function choose(chain: 'solana' | 'ethereum') {
    choosing.current = chain; setProblem(null); connectionModalSeen.current = false; setConnecting(chain);
    connectWallet({ walletChainType: chain === 'solana' ? 'solana-only' : 'ethereum-only', description: chain === 'solana' ? 'Connect your HIVE wallet on Solana' : 'Choose where to receive HIVE on Robinhood' });
  }
  useEffect(() => {
    alive.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.owner === owner && saved.solanaSignature && saved.evmSignature && /^[1-9][0-9]{0,19}$/.test(saved.amount) && BigInt(saved.amount) < 2n ** 64n && /^0x[0-9a-f]{40}$/i.test(saved.recipient)) { requestRef.current = saved; setRequest(saved); setAmount(saved.amount); }
    } catch { /* Invalid or unavailable storage cannot initiate a deposit. */ }
    setRestored(true);
    return () => { alive.current = false; };
  }, [storageKey, owner]);
  const refresh = useCallback(async (r: RequestTerms, signal?: AbortSignal) => {
    let next;
    try { next = await call('status', { request: r }, signal); }
    catch (error) {
      if ((error as { code?: string }).code !== 'REGISTRATION_NOT_FOUND') throw error;
      await call('register', r, signal);
      next = await call('status', { request: r }, signal);
    }
    if (alive.current && !signal?.aborted) setStatus(next);
  }, []);
  useEffect(() => {
    if (!request || (status?.state === 'complete' && status.payout?.status === 'finalized') || ['refunded', 'cancelled_without_observed_deposit'].includes(status?.state ?? '')) return;
    let disposed = false, timer: ReturnType<typeof setTimeout>, failures = 0;
    const abort = new AbortController();
    const poll = async () => {
      try { await refresh(request, AbortSignal.any([abort.signal, AbortSignal.timeout(35000)])); failures = 0; }
      catch {
        if (!disposed && ++failures >= 2) setProblem({ title: 'Connection interrupted', detail: 'Your claim is saved. Check its status to continue.', action: 'Check status', retry: () => checkStatus(request) });
      }
      if (!disposed) timer = setTimeout(poll, document.hidden ? 15000 : Math.min(30000, 5000 * (failures + 1)));
    };
    void poll();
    return () => { disposed = true; abort.abort(); clearTimeout(timer); };
  }, [request, refresh, status?.state, status?.payout?.status]);
  useEffect(() => {
    if (!request) return;
    const onVisible = () => { if (!document.hidden && !locked.current) void refresh(request).catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [request, refresh]);
  useEffect(() => { setSlow(false); const timer = setTimeout(() => setSlow(true), 90000); return () => clearTimeout(timer); }, [progress.phase]);
  function ensureWallets(recipient?: string) {
    if (!alive.current) throw Error('Wallet changed. Reconnect to continue.');
    const current = selected.current;
    if (!current.sol || current.sol.address !== owner) throw Error('Reconnect the Solana wallet you checked.');
    if (!current.evm || (recipient && current.evm.address.toLowerCase() !== recipient.toLowerCase())) throw Error('Reconnect your selected Robinhood wallet.');
    return { sol: current.sol, evm: current.evm };
  }
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setProblem(null);
    try { await action(); }
    catch (error) {
      if (!alive.current) return;
      const message = error instanceof Error ? error.message : 'Please try again.';
      const rejected = /reject|denied|cancel/i.test(message), reconnect = /reconnect|wallet changed/i.test(message);
      setProblem({ title: rejected ? 'Approval cancelled' : reconnect ? 'Reconnect your wallet' : 'Could not continue',
        detail: rejected ? 'Nothing else will be submitted until you continue.' : message,
        action: requestRef.current ? 'Continue claim' : reconnect ? 'Connect wallets' : 'Try again',
        retry: () => { setProblem(null); if (!requestRef.current) setStep(reconnect ? 'wallets' : 'review'); else checkStatus(requestRef.current); } });
    } finally { locked.current = false; if (alive.current) setBusy(''); }
  }
  function checkStatus(r: RequestTerms) { void run(async () => { setBusy('Checking your claim'); await refresh(r); }); }
  async function authorize() {
    if (!canStart || !review.depositRaw) throw Error('Claims are not open.');
    setBusy('Preparing your claim');
    const w = ensureWallets(), recipient = getAddress(w.evm.address);
    const provider = await w.evm.getEthereumProvider();
    if (await provider.request({ method: 'eth_chainId' }) !== '0x1237') {
      setBusy('Switch to Robinhood in your wallet');
      try { await w.evm.switchChain(4663); }
      catch { throw Error('Switch your wallet to Robinhood Chain, then try again.'); }
    }
    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    if (!accounts.some(a => a.toLowerCase() === recipient.toLowerCase())) throw Error('Reconnect your selected Robinhood wallet.');
    const q: Quote = await call('quote', { owner, recipient, amount });
    validateQuote(q, owner, recipient, amount);
    setBusy('Approve in your Solana wallet');
    const signed = await signMessage({ wallet: ensureWallets(recipient).sol, message: new TextEncoder().encode(q.message) });
    ensureWallets(recipient);
    setBusy('Approve in your Robinhood wallet');
    const hex = '0x' + Array.from(new TextEncoder().encode(q.message), b => b.toString(16).padStart(2, '0')).join('');
    const evmSignature = await provider.request({ method: 'personal_sign', params: [hex, recipient] });
    ensureWallets(recipient); validateQuote(q, owner, recipient, amount);
    if (typeof evmSignature !== 'string') throw Error('Wallet signature unavailable.');
    const r = { ...q.request, solanaSignature: getBase58Decoder().decode(signed.signature), evmSignature };
    localStorage.setItem(storageKey, JSON.stringify(r));
    requestRef.current = r; setRequest(r);
    setBusy('Preparing your deposit');
    await call('register', r); await refresh(r);
  }
  async function deposit() {
    if (!canStart || !request || !status?.deposit || status.signature) return;
    const packet = status.deposit, current = ensureWallets(request.recipient);
    const bytes = Uint8Array.from(atob(packet.transactionBase64), c => c.charCodeAt(0));
    const original = VersionedTransaction.deserialize(bytes);
    if (original.message.staticAccountKeys[0].toBase58() !== owner) throw Error('Deposit wallet does not match.');
    setBusy('Approve deposit in your Solana wallet');
    const { signedTransaction } = await signTransaction({ wallet: current.sol, transaction: bytes, chain: 'solana:mainnet' });
    ensureWallets(request.recipient);
    const signed = VersionedTransaction.deserialize(signedTransaction);
    if (Array.from(signed.message.serialize()).join(',') !== Array.from(original.message.serialize()).join(',')) throw Error('Wallet changed the deposit.');
    setBusy('Submitting your deposit');
    setStatus(s => s ? { ...s, deposit: null } : s);
    const sent = await call('deposit', { request, packetId: packet.packetId, transactionBase64: btoa(String.fromCharCode(...signedTransaction)) });
    setStatus(s => s ? { ...s, signature: sent.signature, submission: sent.submission, deposit: null } : s);
    await refresh(request);
  }
  const grant = request ? proportionalQuote(BigInt(request.amount), BigInt(owner === supplementalClaim.owner ? supplementalClaim.allowanceRaw : reimbursementCampaign.eligibleOldRaw), BigInt(owner === supplementalClaim.owner ? supplementalClaim.grantRaw : reimbursementCampaign.budgetRaw)).toString() : review.receiveRaw;
  const receivingAddress = request?.recipient || evm?.address;
  const links = <div className={styles.explorerLinks}>
    {status?.signature && <a href={'https://solscan.io/tx/' + status.signature} target="_blank" rel="noopener noreferrer">Solana transaction<ExternalLink size={14} /></a>}
    {status?.payout?.hash && <a href={robinhoodChain.blockExplorers.default.url + '/tx/' + status.payout.hash} target="_blank" rel="noopener noreferrer">Robinhood transaction<ExternalLink size={14} /></a>}
  </div>;
  function walletRow(chain: 'solana' | 'ethereum') {
    const wallet = chain === 'solana' ? sol : evm;
    const label = chain === 'solana' ? 'Solana wallet' : 'Robinhood wallet';
    return <div className={styles.walletRow} aria-busy={connecting === chain}><Wallet size={20} aria-hidden="true" /><div><span>{label}</span>{wallet ? <strong>{chain === 'solana' ? sol?.standardWallet.name : evm?.meta.name || evm?.walletClientType} · {short(wallet.address)}</strong> : <strong>Not connected</strong>}</div>
      {wallet && <button className={styles.iconButton} aria-label={'Copy ' + label + ' address'} onClick={() => void navigator.clipboard.writeText(wallet.address).then(() => { setCopied(chain); setTimeout(() => setCopied(''), 1500); }).catch(() => {})}>{copied === chain ? <Check size={16} /> : <Copy size={16} />}</button>}
      <button className={styles.textButton} disabled={connecting !== null} onClick={() => choose(chain)}>{connecting === chain ? <><LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />Connecting…</> : wallet ? 'Change' : 'Connect'}</button></div>;
  }
  if (!restored) return <div className={styles.flowState} role="status" aria-busy="true"><LoaderCircle className={styles.spinner} /><h2>Loading your claim</h2></div>;
  return <section ref={flowRef} className={styles.flow} aria-label="Claim HIVE">
    {!request && !busy && <button className={styles.flowBack} onClick={() => step === 'review' ? setStep('wallets') : onBack()}><ArrowLeft size={16} />Back</button>}
    {problem ? <div className={styles.flowState} role="alert"><CircleAlert className={styles.stateIcon} /><h2>{problem.title}</h2><p>{problem.detail}</p><button className={styles.primary} onClick={problem.retry}>{problem.action}</button>{links}</div>
    : busy ? <div className={styles.flowState} role="status" aria-busy="true"><LoaderCircle className={styles.stateIcon + ' ' + styles.spinner} /><h2>{busy}</h2><p>{busy.startsWith('Approve') ? 'Confirm the request in your wallet.' : 'Please wait…'}</p></div>
    : request ? <>
      {progress.phase === 'success' || progress.phase === 'refunded' ? <div className={styles.flowState} role="status"><CheckCircle2 className={styles.successIcon} /><h2>{progress.title}</h2><strong className={styles.receivedAmount}>{compactHive(progress.phase === 'refunded' ? request.amount : grant!, progress.phase === 'refunded' ? 9 : 18)} HIVE</strong><p>{progress.phase === 'refunded' ? 'On Solana' : 'On Robinhood · ' + short(request.recipient)}</p>{links}<button className={styles.secondary} onClick={onBack}>Done</button></div>
      : progress.phase === 'error' ? <div className={styles.flowState} role={progress.pending ? "status" : "alert"} aria-busy={progress.pending || undefined}>{progress.pending ? <LoaderCircle className={styles.stateIcon + ' ' + styles.spinner} aria-hidden="true" /> : <CircleAlert className={styles.stateIcon} />}<h2>{progress.title}</h2><p>{progress.detail}</p><button className={styles.primary} onClick={() => run(async () => { setBusy('Checking your claim'); await refresh(request); })}>Check status</button>{links}</div>
      : progress.phase === 'deposit' && status?.deposit ? <><header className={styles.flowHeading}><h1>Deposit HIVE</h1><p>Approve the deposit in your Solana wallet.</p></header>{walletRow('solana')}{walletRow('ethereum')}<div className={styles.transfer}><span>Solana → Robinhood</span><strong>{compactHive(request.amount, 9)} HIVE <ArrowRight size={20} /> {compactHive(grant!, 18)} HIVE</strong></div><button className={styles.primary} disabled={!canStart || !sol || !evm} onClick={() => run(deposit)}>Deposit HIVE<ArrowRight size={16} /></button></>
      : <div className={styles.flowState} role="status" aria-busy="true"><LoaderCircle className={styles.stateIcon + ' ' + styles.spinner} /><h2>{progress.title}</h2><ol className={styles.progressSteps}>{['Deposit HIVE', 'Receive HIVE'].map((label, i) => <li key={label} data-active={i === (progress.phase === 'receiving' ? 1 : 0)}>{i === 0 && progress.phase === 'receiving' ? <Check size={16} /> : i === (progress.phase === 'receiving' ? 1 : 0) ? <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" /> : <span className={styles.progressDot} />}{label}</li>)}</ol><p>{slow ? 'Taking longer than usual. Your claim is still being checked.' : progress.phase === 'receiving' ? 'HIVE will arrive in your Robinhood wallet automatically.' : 'Waiting for confirmation.'}</p>{links}</div>}
    </> : step === 'wallets' ? <><header className={styles.flowHeading}><h1>Connect your wallets</h1><p>Deposit from Solana. Receive on Robinhood.</p></header>{walletRow('solana')}{walletRow('ethereum')}<button className={styles.primary} disabled={!sol || sol.address !== owner || !evm} onClick={() => setStep('review')}>Continue<ArrowRight size={16} /></button></>
    : <><header className={styles.flowHeading}><h1>Review your claim</h1></header><div className={styles.transfer}><div><span>Deposit on Solana</span><strong>{compactHive(amount, 9)} HIVE</strong><button className={styles.textButton} onClick={() => { setDraft(exactHive(amount, 9)); setEditing(true); }}>Change amount</button></div><ArrowRight size={22} /><div><span>Receive on Robinhood</span><strong>{grant ? compactHive(grant, 18) : '—'} HIVE</strong></div></div><div className={styles.walletSummary}><span>From {short(owner)}</span><span>To {receivingAddress && short(receivingAddress)}</span></div><p className={styles.oneDeposit}>One deposit per wallet. Any unused allocation is forfeited.</p><button className={styles.primary} disabled={!canStart || !review.receiveRaw} onClick={() => run(authorize)}>Continue<ArrowRight size={16} /></button></>}
    {editing && <AmountDialog draft={draft} setDraft={setDraft} max={maximum.depositRaw!} close={() => setEditing(false)} save={() => { const raw = parseOldHiveInput(draft); if (raw && migrationReview(result, raw).receiveRaw) { setAmount(raw); setEditing(false); } }} valid={!!parseOldHiveInput(draft) && !!migrationReview(result, parseOldHiveInput(draft) ?? '0').receiveRaw} />}
  </section>;
}
function AmountDialog({ draft, setDraft, max, close, save, valid }: { draft: string; setDraft: (v: string) => void; max: string; close: () => void; save: () => void; valid: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={styles.amountDialog} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="amount-title"><form onSubmit={e => { e.preventDefault(); if (valid) save(); }}><div className={styles.dialogHeading}><h2 id="amount-title">Deposit amount</h2><button type="button" className={styles.iconButton} onClick={close} aria-label="Close"><X size={20} /></button></div><label htmlFor="claim-amount">HIVE on Solana</label><div className={styles.formRow}><input autoFocus id="claim-amount" inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)} maxLength={30} aria-invalid={!valid} /><button type="button" onClick={() => setDraft(exactHive(max, 9))}>Max</button></div><p className={styles.hint}>Available: {compactHive(max, 9)} HIVE</p>{!valid && <p role="alert">Enter an amount within your available balance.</p>}<button className={styles.primary} disabled={!valid}>Save amount</button></form></dialog>;
}
