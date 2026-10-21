"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useModalStatus, usePrivy, useWallets } from '@privy-io/react-auth';
import type { LaunchRole } from '@/lib/agent-tokenization/types';
import type { Request } from '../task/useResource';
import { LaunchReview } from './LaunchReview';
import { useLaunchFlow } from './useLaunchFlow';
import { LaunchTransaction, LaunchRecovery } from './LaunchTransaction';
import styles from './tokenization.module.css';

interface Props { agentId: string; role: LaunchRole; request: Request; close: () => void; session?: { id: string; mode: 'managed' | 'connected'; signer: string; symbol: string; purchase: string }; onComplete?: () => void }

export function PonsLaunchDialog(props:Props) { return <LaunchDialogContent key={`${props.agentId}:${props.role}`} {...props}/>; }
function LaunchDialogContent({ agentId, role, request, close, session, onComplete }: Props) {
  const [editorBusy,setEditorBusy]=useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const walletTrigger = useRef<HTMLElement | null>(null);
  const id = useId();
  const { wallets } = useWallets();
  const { connectWallet } = usePrivy();
  const { isOpen: walletPickerOpen } = useModalStatus();
  const flow = useLaunchFlow(agentId,role,request,wallets,session);
  const { preview,loading,error } = flow;
  const completed = useRef(false);
  const reviewedSession = useRef(false);
  useEffect(() => { if (session && flow.progress.stage === 'success' && !completed.current) { completed.current = true; onComplete?.(); } }, [session, flow.progress.stage, onComplete]);
  useEffect(() => {
    // The parent opens this step only after an explicit review action. Obtain the
    // first quote here, avoiding another identical Review button. Never send it.
    if (!session || reviewedSession.current || loading || !preview || flow.blocked) return;
    reviewedSession.current = true;
    if (!flow.saved && !flow.quote && !preview.existingToken) void flow.prepare();
  }, [session, loading, preview, flow]);
  const connect = () => connectWallet({ walletChainType:'ethereum-only' });

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, []);

  // A native dialog's top layer would otherwise cover Privy's wallet picker.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (walletPickerOpen) {
      walletTrigger.current = element.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
      element.close();
    } else {
      if (!element.open) element.showModal();
      walletTrigger.current?.focus();
      walletTrigger.current = null;
    }
  }, [walletPickerOpen]);

  const connected = (address:string) => wallets.some(w=>w.address.toLowerCase()===address.toLowerCase());
  const selectedWallet = wallets.find(w => w.address.toLowerCase() === flow.wallet.toLowerCase())?.address || '';

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={e => { e.preventDefault(); if(!editorBusy)close(); }}
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'))
        .filter(el => el.getClientRects().length > 0);
      const target = e.shiftKey ? controls.at(-1) : controls[0];
      const boundary = e.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === boundary) { e.preventDefault(); target?.focus(); }
    }}>
    <header className={styles.header}><h2 id={id}>{preview?.existingToken ? 'Agent token' : 'Tokenize agent'}</h2><button type="button" aria-label="Close token launch" disabled={editorBusy} onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <div className={styles.body} aria-busy={loading || flow.busy}>
      {loading ? <div className={styles.pending} role="status"><Loader2 size={24} className={styles.spinner} aria-hidden="true" /><p>Loading token details…</p></div>
        : !preview || flow.blocked ? <div className={styles.notice} role="alert"><p>{error || 'Launch status is unavailable.'}</p><button type="button" className={styles.secondary} onClick={() => void flow.load()}>Try again</button></div>
        : <>
          {flow.busy || preview.existingToken || flow.progress.stage==='success' ? <LaunchReview preview={preview} wallets={[]} wallet={selectedWallet} symbol={flow.symbol} purchase={flow.purchase}
            progress={flow.progress} error="" connecting={walletPickerOpen} onWallet={flow.setWallet} onSymbol={flow.setSymbol} onPurchase={flow.setPurchase} onConnect={connect} onRefresh={flow.check}/>
          : flow.quote ? <LaunchTransaction quote={flow.quote} connected={flow.quote.mode==='managed'||connected(flow.quote.transaction.from)} confirm={flow.send} back={flow.dismissQuote} refresh={()=>flow.review(flow.quote!.action)} connect={connect}/>
          : flow.saved ? <LaunchRecovery readOnly={role!=='admin'&&flow.saved.mode==='managed'} launch={flow.saved} enabled={preview.signingEnabled} connected={flow.saved.mode==='managed'||connected(flow.saved.signer)} review={flow.review} cancelDraft={flow.cancelDraft} restart={flow.restart} retry={flow.retrySubmission} check={flow.check} connect={connect}/>
          : session ? <div className={styles.review}><h3 className={styles.stepTitle}>Launch on Pons</h3><p className={styles.hint}>${session.symbol} · Robinhood</p><button type="button" className={styles.primary} onClick={flow.prepare}>Review launch</button></div>
          : <LaunchReview preview={preview} mode={flow.mode} onMode={flow.setMode} wallets={wallets.map(w=>({address:w.address,label:w.walletClientType||'Wallet'}))} wallet={selectedWallet}
            symbol={flow.symbol} purchase={flow.purchase} progress={flow.progress} error="" connecting={walletPickerOpen}
            onWallet={flow.setWallet} onSymbol={flow.setSymbol} onPurchase={flow.setPurchase} onConnect={connect} onRefresh={flow.check} onLaunch={flow.prepare} onSaveProfile={role==='admin'?flow.saveProfile:undefined} onEditorBusy={setEditorBusy}/>}
          {error&&<div className={styles.notice} role="alert"><p>{error}</p>{!flow.busy&&<button type="button" className={styles.secondary} onClick={flow.check}>Check status</button>}</div>}
        </>}
    </div>
  </dialog>;
}
