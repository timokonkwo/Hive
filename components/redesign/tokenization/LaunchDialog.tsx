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
  const [selected, setSelected] = useState<PlatformId[]>([]), [view, setView] = useState<'select' | 'review' | 'edit' | 'progress'>('select');
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
  useEffect(() => { if (session?.id) setView('progress'); }, [session?.id]);
  const current = session?.targets.find(t => !['confirmed', 'skipped'].includes(t.phase));
  const complete = !!session && !current;
  const ponsTarget = session?.targets.find(t => t.terms.platform === 'pons');
  async function start(symbol: string, choices: SessionChoice[]) {
    createId.current ||= crypto.randomUUID();
    const result = await flow.action({ action: 'create', id: createId.current, revision: details!.profileRevision, symbol, choices });
    if (result) {
      createId.current = null;
      const prepared = await flow.action({ action: 'prepare', id: result.session.id });
      if (prepared?.session.targets.find(t => !['confirmed', 'skipped'].includes(t.phase))?.terms.platform === 'pons') setPons(true);
    }
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
        : session && (!complete || view === 'progress') ? <>
          <LaunchBatchProgress session={session} busy={busy} readOnly={details.readOnly || flow.needsCheck} onCheck={() => void flow.action({ action: 'check' })}
            onContinue={() => void flow.action({ action: 'continue' })} onRetry={platform => void flow.action({ action: 'retry', platform })} onSkip={platform => void flow.action({ action: 'skip', platform })} />
          {details.readOnly ? <p className={styles.hint}>Resume this launch from the account that started it.</p>
            : flow.needsCheck ? null
            : details.review && current && ['awaiting-signature', 'preparing'].includes(current.phase)
              ? <SolanaLaunchReview review={details.review} purchase={current.terms.purchase} busy={busy} signing={signing}
                connected={solana.some(w => w.address === details.review!.signer)} confirm={() => void confirm()} refresh={() => void prepare()}
                connect={() => connectWallet({ walletChainType: 'solana-only' })} />
              : current && (!session.paused || ['preparing', 'awaiting-signature'].includes(current.phase)) && ['queued', 'preparing', 'awaiting-signature'].includes(current.phase)
                && <button type="button" className={styles.primary} disabled={busy} onClick={() => void prepare()}>{busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}{busy ? 'Preparing review…' : current.terms.platform === 'pons' ? 'Review Pons launch' : `Continue with ${platforms[current.terms.platform].name}`}</button>}
          {current && ['submitted', 'confirming'].includes(current.phase) && !details.readOnly && !flow.needsCheck && <button type="button" className={styles.secondary} disabled={busy} onClick={() => current.terms.platform === 'pons' ? setPons(true) : void flow.action({ action: 'rebroadcast' })}>{busy && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}Retry submission</button>}
          {complete && <button type="button" className={styles.secondary} onClick={() => { setDraft(null); setSelected([]); setView('select'); void flow.load(); }}>Manage tokens</button>}
        </> : flow.needsCheck ? null
          : view === 'edit' && details.preview.adminProfile ? <AgentDetailsEditor preview={details.preview} save={saveProfile} cancel={() => setView('review')} busyChanged={setEditorBusy} />
          : view === 'review' ? <SessionReview details={details} selected={selected} role={role} busy={busy} draft={draft || initialSessionDraft(details, role)} change={value => { createId.current = null; setDraft(value); }}
            wallets={{ evm: evm.map(w => ({ address: w.address, label: w.walletClientType || 'Wallet' })), solana: solana.map(w => ({ address: w.address, label: 'Solana wallet' })) }}
            connect={network => connectWallet({ walletChainType: network === 'evm' ? 'ethereum-only' : 'solana-only' })} submit={(symbol, choices) => void start(symbol, choices)} back={() => setView('select')} edit={() => setView('edit')} />
          : <PlatformSelection options={details.options} selected={selected} onChange={value => { createId.current = null; setSelected(value); }} busy={busy} onContinue={() => setView('review')} onResume={() => setLegacy(true)} />}
      {(flow.error || flow.needsCheck) && <div className={styles.notice} role="alert"><p>{flow.error || 'Check the saved launch before continuing.'}</p>{flow.needsCheck && <button type="button" className={styles.secondary} disabled={busy || flow.loading} onClick={() => session && !details?.readOnly ? void flow.action({ action: 'check' }) : void flow.load()}>{(busy || flow.loading) && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}{busy || flow.loading ? 'Checking status…' : 'Check status'}</button>}</div>}
    </div>
  </dialog>;
}
