"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useModalStatus, usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { formatUnits } from 'viem';
import type { LaunchRole } from '@/lib/agent-tokenization/types';
import type { PlatformId } from '@/lib/agent-tokenization/platforms';
import { platforms } from '@/lib/agent-tokenization/platforms';
import type { Request } from '../task/useResource';
import { PlatformSelection } from './PlatformSelection';
import { SessionReview, initialSessionDraft, type SessionChoice, type SessionDraft } from './SessionReview';
import { SolanaLaunchReview } from './SolanaLaunchReview';
import { LaunchApproval } from './LaunchApproval';
import { LaunchBatchProgress } from './LaunchBatchProgress';
import { PonsLaunchDialog } from './PonsLaunchDialog';
import { AgentDetailsEditor, type AgentProfileEdit } from './AgentDetailsEditor';
import { useLaunchSession } from './useLaunchSession';
import styles from './tokenization.module.css';

interface Props { agentId: string; role: LaunchRole; request: Request; close: () => void }
export function LaunchDialog(props: Props) { return <LaunchDialogContent key={`${props.agentId}:${props.role}`} {...props} />; }
function LaunchDialogContent({ agentId, role, request, close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), id = useId(), createId = useRef<string | null>(null);
  const flow = useLaunchSession(agentId, role, request), { details } = flow;
  const [selected, setSelected] = useState<PlatformId[]>([]), [view, setView] = useState<'select' | 'review' | 'edit' | 'progress' | 'overview' | 'approval'>('select');
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [pons, setPons] = useState(false), [legacy, setLegacy] = useState(false), [signing, setSigning] = useState(false), [editorBusy, setEditorBusy] = useState(false);
  const signingLock = useRef(false), alive = useRef(true), returnFocus = useRef<HTMLElement | null>(null);
  const { wallets: evm } = useWallets(), { wallets: solana } = useSolanaWallets();
  const walletRef = useRef(solana); walletRef.current = solana;
  const { signTransaction } = useSignTransaction(), { connectWallet } = usePrivy(), { isOpen: walletOpen } = useModalStatus();
  const busy = flow.busy || signing || editorBusy;
  useEffect(() => {
    alive.current = true;
    const prior = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { alive.current = false; document.body.style.overflow = overflow; prior?.focus(); };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (walletOpen || pons || legacy) { returnFocus.current = element?.contains(document.activeElement) ? document.activeElement as HTMLElement : null; element?.close(); }
    else { if (element && !element.open) element.showModal(); returnFocus.current?.focus(); returnFocus.current = null; }
  }, [walletOpen, pons, legacy]);
  useEffect(() => {
    if (view === 'edit') return; // The editor focuses its name field.
    const element = dialog.current;
    if (element) element.scrollTop = 0;
    const heading = element?.querySelector<HTMLElement>('h3');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [view]);
  const session = details?.session;
  useEffect(() => { if (session?.id) setView('overview'); }, [session?.id]);
  const current = session?.targets.find(t => !['confirmed', 'skipped'].includes(t.phase));
  const complete = !!session && !current;
  const ponsTarget = session?.targets.find(t => t.terms.platform === 'pons');
  async function estimate() {
    const result = await flow.action({ action: 'estimate' });
    if (result) setView('approval');
  }
  async function editRemaining() {
    const result = await flow.action({ action: 'pause' });
    if (!result || !details) return;
    setDraft(initialSessionDraft({ ...details, ...result }, role));
    setSelected(result.session.targets.filter(t => !['confirmed', 'skipped'].includes(t.phase) && result.editablePlatforms?.includes(t.terms.platform)).map(t => t.terms.platform));
    setView('select');
    await flow.load();
  }
  async function start(symbol: string, choices: SessionChoice[]) {
    createId.current ||= crypto.randomUUID();
    const revising = !!session?.editing;
    const result = await flow.action({ action: revising ? 'revise' : 'create', id: revising ? session!.id : createId.current,
      sessionRevision: session?.revision, revision: details!.profileRevision, symbol, choices });
    if (result) {
      createId.current = null;
      if (result.session.targets.every(t => ['confirmed', 'skipped'].includes(t.phase))) { setView('overview'); return; }
      await estimate();
    }
  }
  async function launch() {
    const result = await flow.action({ action: 'approve', confirmation: session?.estimate?.digest });
    if (result) { setView('progress'); await flow.action({ action: 'advance' }); }
  }
  async function prepare() { const result = await flow.action({ action: 'prepare' }); if (result?.session.targets.find(t => !['confirmed', 'skipped'].includes(t.phase))?.terms.platform === 'pons') setPons(true); }
  async function confirm() {
    const review = details?.review;
    if (!review || signingLock.current || busy) return;
    signingLock.current = true; setSigning(true); flow.setError('');
    try {
      if (Date.parse(review.expiresAt) <= Date.now()) { await flow.action({ action: 'prepare' }); return; }
      let signed: string | undefined;
      if (review.mode === 'connected') {
        const wallet = walletRef.current.find(w => w.address === review.signer);
        if (!wallet) throw Error('Connect the Solana wallet used for this launch.');
        const transaction = Uint8Array.from(atob(review.transaction), c => c.charCodeAt(0));
        const result = await signTransaction({ transaction, wallet, chain: 'solana:mainnet' });
        signed = btoa(String.fromCharCode(...result.signedTransaction));
      }
      await flow.action({ action: 'confirm', stepId: review.id, confirmation: review.digest, ...(signed ? { signed } : {}) });
    } catch (e) { if (alive.current) flow.setError(e instanceof Error ? e.message : 'The wallet request was not completed.'); }
    finally { signingLock.current = false; if (alive.current) setSigning(false); }
  }
  async function saveProfile(input: AgentProfileEdit) {
    const response = await request(`/api/agents/${agentId}/tokenization/profile?role=${role}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || 'Changes could not be saved.');
    await flow.load(); createId.current = null;
  }
  if (legacy || pons) return <PonsLaunchDialog agentId={agentId} role={role} request={request}
    {...(pons && session && ponsTarget ? { session: { id: session.id, mode: ponsTarget.terms.mode, signer: ponsTarget.terms.signer, symbol: session.metadata.symbol, purchase: formatUnits(BigInt(ponsTarget.terms.purchase), 18) },
      onComplete: () => { setPons(false); void flow.action({ action: 'check' }); } } : {})}
    close={() => { setPons(false); setLegacy(false); void flow.load(); }} />;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!editorBusy) close(); }}
    onKeyDown={e => { if (e.key !== 'Tab') return; const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')).filter(el => el.getClientRects().length); const first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }}>
    <header className={styles.header}><h2 id={id}>Agent tokens</h2><button type="button" disabled={editorBusy} aria-label="Close token launch" onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <div className={styles.body} aria-busy={busy || flow.loading}>
      {flow.loading ? <div className={styles.pending} role="status"><Loader2 size={24} className={styles.spinner} aria-hidden="true" /><p>Loading token details…</p></div>
        : !details ? <button className={styles.secondary} onClick={() => void flow.load()}>Try again</button>
        : session && view === 'approval' ? <LaunchApproval session={session} busy={busy} launch={() => void launch()} back={() => void editRemaining()} />
        : session && (view === 'overview' || view === 'progress') ? <>
          <LaunchBatchProgress session={session} busy={busy} readOnly onCheck={() => void flow.action({ action: 'check' })}
            onContinue={() => void estimate()} onRetry={() => void estimate()} onSkip={() => void editRemaining()} />
          {!details.readOnly && !complete && <>
            {session.paused && current?.error && <p className={styles.notice} role="alert">{current.error}</p>}
            {view === 'progress' && session.approval && !session.paused && current?.terms.mode === 'connected' && details.review
              ? <SolanaLaunchReview review={details.review} purchase={current.terms.purchase} busy={busy} signing={signing}
                  connected={solana.some(w => w.address === details.review!.signer)} confirm={() => void confirm()} refresh={() => void prepare()}
                  connect={() => connectWallet({ walletChainType: 'solana-only' })} />
              : view === 'progress' && session.approval && !session.paused && current?.terms.mode === 'connected' && current.terms.platform === 'pons'
                ? <button type="button" className={styles.primary} disabled={busy} onClick={() => setPons(true)}>Sign with wallet</button>
                : null}
            <div className={`${styles.reviewActions} ${styles.overviewActions}`}>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => void editRemaining()}>{busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}Edit remaining launches</button>
              {(!session.approval || session.paused) && <button type="button" className={styles.primary} disabled={busy} onClick={() => void estimate()}>{busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}Continue</button>}
              {session.approval && !session.paused && view === 'overview' && <button type="button" className={styles.primary} onClick={() => setView('progress')}>View progress</button>}
            </div>
          </>}
          {complete && <button type="button" className={styles.secondary} onClick={() => { setDraft(null); setSelected([]); setView('select'); void flow.load(); }}>Manage tokens</button>}
        </> : flow.needsCheck ? null
          : view === 'edit' && details.preview.adminProfile ? <AgentDetailsEditor preview={details.preview} save={saveProfile} cancel={() => setView('review')} busyChanged={setEditorBusy} />
          : view === 'review' ? <SessionReview details={details} selected={selected} role={role} busy={busy} draft={draft || initialSessionDraft(details, role)} change={value => { createId.current = null; setDraft(value); }}
            wallets={{ evm: evm.map(w => ({ address: w.address, label: w.walletClientType || 'Wallet' })), solana: solana.map(w => ({ address: w.address, label: 'Solana wallet' })) }}
            connect={network => connectWallet({ walletChainType: network === 'evm' ? 'ethereum-only' : 'solana-only' })} submit={(symbol, choices) => void start(symbol, choices)} back={() => setView('select')} edit={() => setView('edit')} />
          : <><PlatformSelection options={details.options.map(option => session?.editing && session.targets.some(t => t.terms.platform === option.platform && !['confirmed', 'skipped'].includes(t.phase)) && !details.editablePlatforms?.includes(option.platform) ? { ...option, available: false, pending: false, reason: 'Submitted transaction is settling' } : option)} selected={selected} onChange={value => { createId.current = null; setSelected(value); }} busy={busy} onContinue={() => setView('review')} onResume={() => setLegacy(true)} />{session?.editing && <div className={`${styles.reviewActions} ${styles.overviewActions}`}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setView('overview')}>Back</button>{selected.length === 0 && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void start(draft?.symbol || session.metadata.symbol, [])}>Remove remaining launches</button>}</div>}</>}
      {(flow.error || flow.needsCheck) && <div className={styles.notice} role="alert"><p>{flow.error || 'Check the saved launch before continuing.'}</p>{flow.needsCheck && <button type="button" className={styles.secondary} disabled={busy || flow.loading} onClick={() => session && !details?.readOnly ? void flow.action({ action: 'check' }) : void flow.load()}>{(busy || flow.loading) && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}{busy || flow.loading ? 'Checking status…' : 'Check status'}</button>}</div>}
    </div>
  </dialog>;
}
