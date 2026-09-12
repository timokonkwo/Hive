"use client";
import { Select } from '@/components/redesign/Select';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Transaction } from '@solana/web3.js';
import { Star } from 'lucide-react';
import { TaskDialog } from './TaskDialog';
import { base58, finishPayment, jsonAction, paymentKey, readPayment, type Payment } from './payment';
import { signature, type Bid, type Task } from './model';
import type { Request } from './useResource';
import styles from './task.module.css';
export type OwnerAction = { type: 'accept' | 'decline'; bid: Bid } | { type: 'approve' | 'review' | 'revise' | 'assign' };
type Wallet = { publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; signTransaction(t: Transaction): Promise<Transaction> };
function wallet() { const w = window as unknown as { solana?: Wallet; phantom?: { solana?: Wallet }; solflare?: Wallet; backpack?: { solana?: Wallet } }; return w.phantom?.solana || w.solana || w.solflare || w.backpack?.solana; }
const reasons = [['incomplete','Missing work'],['incorrect','Incorrect result'],['off_topic','Does not match the brief'],['poor_quality','Quality needs improvement'],['formatting','Wrong format'],['other','Other']] as const;
export function OwnerActions({ action, task, request, address, owner, close, done }: { action: OwnerAction; task: Task; request: Request; address: string; owner: string; close: () => void; done: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [rating, setRating] = useState(0), [comment, setComment] = useState(''), [reason, setReason] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null), [reference, setReference] = useState(''), [phase, setPhase] = useState('');
  const guard = useRef(false);
  const key = paymentKey(task.id, owner);
  useEffect(() => { if (action.type === 'approve') { try { const saved = sessionStorage.getItem(key); if (signature(saved)) setReference(saved); } catch {} } }, [key, action.type]);
  const pay = action.type === 'approve' && task.budgetAmount !== null && task.budgetAmount > 0;
  async function run() {
    if (guard.current) return;
    if (action.type === 'revise' && (!reason || comment.trim().length < 10)) { setError('Choose a reason and describe the changes in at least 10 characters.'); document.getElementById(!reason ? 'revision-reason' : 'action-comment')?.focus(); return; }
    if (action.type === 'review' && !rating) { setError('Choose a star rating.'); document.querySelector<HTMLInputElement>('input[name=rating]')?.focus(); return; }
    guard.current = true; setBusy(true); setError('');
    try {
      if (action.type === 'accept' || action.type === 'decline') {
        const result = await jsonAction(request, `/api/tasks/${task.id}/bids/${action.bid.id}`, { status: action.type === 'accept' ? 'accepted' : 'rejected', clientAddress: address }, 'PATCH');
        if (result.success !== true) throw Error('The proposal change could not be confirmed.'); done();
      } else if (action.type === 'assign') {
        const result = await jsonAction(request, `/api/tasks/${task.id}/assign`, { agentId: task.requestedAgentId, clientAddress: address });
        if (result.success !== true || result.agent_id !== task.requestedAgentId) throw Error('The assignment could not be confirmed.'); done();
      } else if (action.type === 'approve' && pay) {
        if (reference) { setPhase('Verifying the existing payment…'); await finishPayment(request, task.id, address, reference, rating, comment); try { sessionStorage.removeItem(key); } catch {} done(); }
        else if (!payment) {
          setPhase('Preparing payment details…');
          const response = await request(`/api/clients/profile?address=${encodeURIComponent(owner || address)}`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
          if (!response.ok) throw Error('Your payment wallet could not be loaded.');
          const sender = (await response.json()).profile?.solanaAddress;
          if (typeof sender !== 'string' || !sender) throw Error('Link your Solana wallet in My tasks before paying.');
          const data = await jsonAction(request, `/api/tasks/${task.id}/payment/build`, { clientAddress: address, clientSolanaAddress: sender });
          setPayment(readPayment(data, task.budgetAmount!, sender)); setPhase('');
        } else {
          const provider = wallet(); if (!provider) throw Error('Open Hive in your Solana wallet browser or connect a wallet that can sign this payment.');
          setPhase('Confirm the payment in your wallet…');
          const connected = await provider.connect();
          if (connected.publicKey.toString() !== payment.from) throw Error('The connected wallet differs from your linked payment wallet. Switch accounts in your wallet.');
          const { Transaction } = await import('@solana/web3.js');
          const tx = Transaction.from(Uint8Array.from(atob(payment.transaction), c => c.charCodeAt(0)));
          const signed = await provider.signTransaction(tx);
          if (!signed.signature) throw Error('The wallet did not sign the transaction.');
          const txSignature = base58(signed.signature);
          if (!signature(txSignature)) throw Error('The wallet returned an invalid signature.');
          // Persist before broadcast; if storage fails no transfer is sent.
          sessionStorage.setItem(key, txSignature); setReference(txSignature);
          setPhase('Sending and verifying payment…');
          const encoded = btoa(String.fromCharCode(...signed.serialize()));
          const sent = await jsonAction(request, `/api/tasks/${task.id}/payment/send`, { signedTransaction: encoded, clientAddress: address });
          if (sent.txSignature !== txSignature) throw Error('Payment confirmation did not match. Verify the existing payment.');
          await finishPayment(request, task.id, address, txSignature, rating, comment);
          try { sessionStorage.removeItem(key); } catch {} done();
        }
      } else {
        if (action.type === 'approve' && task.budgetAmount === null) throw Error('The payment amount is not available. Refresh this task before approval.');
        const result = await jsonAction(request, `/api/tasks/${task.id}/${action.type === 'revise' ? 'reject' : action.type === 'review' ? 'review' : 'complete'}`, { clientAddress: address, ...(action.type === 'revise' ? { reason: comment.trim(), rejectionCategory: reason } : { ...(rating ? { satisfaction: rating } : {}), comment: comment.trim() }) });
        if (result.success !== true) throw Error('The action could not be confirmed. Refresh this task.'); done();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be confirmed.'); }
    finally { guard.current = false; setBusy(false); setPhase(''); }
  }
  const heading = action.type === 'accept' ? 'Accept this proposal?' : action.type === 'decline' ? 'Decline this proposal?' : action.type === 'revise' ? 'Request changes' : action.type === 'review' ? 'Review the agent' : action.type === 'assign' ? 'Assign the selected agent?' : reference ? 'Verify your payment' : payment ? 'Confirm payment' : 'Approve submitted work';
  const label = action.type === 'accept' ? 'Accept and assign' : action.type === 'decline' ? 'Decline proposal' : action.type === 'revise' ? 'Send change request' : action.type === 'review' ? 'Submit review' : action.type === 'assign' ? 'Assign agent' : reference ? 'Verify existing payment' : pay ? payment ? 'Sign and pay' : 'Review payment details' : 'Approve work';
  return <TaskDialog title={heading} busy={busy} close={close}><form noValidate onSubmit={e => { e.preventDefault(); void run(); }}>
    <fieldset disabled={busy}><legend className={styles.srOnly}>{heading}</legend>
      {'bid' in action && <><p className={styles.dialogLead}>{action.bid.name}</p><dl className={styles.confirmFacts}><div><dt>Proposed price</dt><dd>{action.bid.amount}</dd></div><div><dt>Task budget</dt><dd>{task.budget}</dd></div></dl><p>{action.type === 'accept' ? 'This assigns the agent to your task. It does not transfer funds.' : 'This removes the proposal from consideration.'}</p></>}
      {action.type === 'approve' && !payment && !reference && <dl className={styles.confirmFacts}><div><dt>Task budget</dt><dd>{task.budget}</dd></div></dl>}
      {action.type === 'assign' && <p>The agent selected when this task was created will be assigned. No funds are transferred.</p>}
      {action.type === 'revise' && <div className={styles.field}><label htmlFor="revision-reason">Reason</label><Select id="revision-reason" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{reasons.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></div>}
      {(action.type === 'review' || action.type === 'approve') && !reference && <fieldset className={styles.rating}><legend>Agent rating {action.type === 'approve' ? '(optional)' : ''}</legend><div>{[1,2,3,4,5].map(n => <label key={n}><input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} /><Star size={25} fill={n <= rating ? 'currentColor' : 'none'} aria-hidden="true" /></label>)}</div></fieldset>}
      {['review','approve','revise'].includes(action.type) && !reference && <div className={styles.field}><label htmlFor="action-comment">{action.type === 'revise' ? 'Changes needed' : 'Review comment (optional)'}</label><textarea id="action-comment" rows={4} value={comment} maxLength={action.type === 'revise' ? 1000 : 500} onChange={e => setComment(e.target.value)} /></div>}
      {payment && !reference && <dl className={styles.confirmFacts}><div><dt>Payment</dt><dd>{payment.amount.toFixed(2)} USDC · Solana</dd></div><div><dt>To {payment.name}</dt><dd className={styles.address}>{payment.to}</dd></div><div><dt>From your wallet</dt><dd className={styles.address}>{payment.from}</dd></div></dl>}
      {pay && !reference && <p className={styles.hint}>Your wallet will show network fees in SOL before you sign. Payment uses the task budget shown above.</p>}
      {reference && <div className={styles.paymentRecovery}><p>A signed payment already exists for this task. Verify this payment before taking another action.</p><a href={`https://solscan.io/tx/${reference}`} target="_blank" rel="noopener noreferrer">View transaction</a><p className={styles.address}>{reference}</p></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}{phase && <p role="status">{phase}</p>}
      <div className={styles.actions}><button type="submit" className={styles.primary}>{busy ? 'Please wait…' : label}</button><button type="button" className={styles.secondary} onClick={close}>Cancel</button></div>
      {pay && <Link className={styles.textLink} href="/dashboard">Open My tasks</Link>}
    </fieldset>
  </form></TaskDialog>;
}
