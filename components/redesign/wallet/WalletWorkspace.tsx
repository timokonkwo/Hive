"use client";
import { Select } from '@/components/redesign/Select';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Copy, RefreshCw, Wallet } from 'lucide-react';
import gsap from 'gsap';
import { AgentAvatar } from '../AgentAvatar';
import { TaskDialog } from '../task/TaskDialog';
import { ResourceState } from '../dashboard/ResourceState';
import { useResource, type Request } from '../task/useResource';
import { write } from '../tools/model';
import { useGuard } from '../tools/useGuard';
import { agentWalletMessage, type WalletNetwork } from '@/lib/agent-wallet-message';
import { readWallets, readPending, confirmed, type PendingWallet } from './model';
import type { WalletChoice } from './useWalletChoices';
import styles from './wallet.module.css';
const networks: WalletNetwork[] = ['robinhood', 'solana'];
const label = (network: WalletNetwork) => network === 'robinhood' ? 'Robinhood Chain' : 'Solana';
type Connections = { ready: boolean; choices: Record<WalletNetwork, WalletChoice[]>; connect(network: WalletNetwork): void };
type Review = PendingWallet & { previous: string | null };
export function WalletWorkspace({ id, request, connections }: { id: string; request: Request; connections: Connections }) {
  const [version, setVersion] = useState(0), [selection, setSelection] = useState<Record<WalletNetwork, string>>({ robinhood: '', solana: '' });
  const [review, setReview] = useState<Review | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingWallet | null>(null), [receiptError, setReceiptError] = useState(false), [copied, setCopied] = useState('');
  const root = useRef<HTMLDivElement>(null), alive = useRef(true), lock = useRef(false), key = 'hive_agent_wallet:' + id;
  const parse = useCallback((v: unknown) => readWallets(v, id), [id]);
  const resource = useResource('/api/agents/me/wallets?agentId=' + id, parse, request, version, id), saved = resource.state === 'success' ? resource.data : null;
  useEffect(() => { alive.current = true; try { const p = readPending(sessionStorage.getItem(key)); queueMicrotask(() => setPending(p)); } catch { queueMicrotask(() => setReceiptError(true)); } return () => { alive.current = false; }; }, [key]);
  useEffect(() => {
    if (!saved || !pending || !confirmed(saved, pending)) return;
    try { sessionStorage.removeItem(key); queueMicrotask(() => { setPending(null); setError(''); setNotice(pending.address ? 'Wallet saved and verified.' : 'Solana wallet removed.'); }); } catch { /* Keep recovery visible if storage is unavailable. */ }
  }, [saved, pending, key]);
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.fromTo('[data-wallet-item]', { y: 8, opacity: 0 }, { y: 0, opacity: 1, stagger: .05, duration: .3, clearProps: 'all' }), root);
    return () => ctx.revert();
  }, [resource.state]);
  useGuard(busy, () => setError('Wait for the wallet request to finish.'));
  const blocked = busy || !!pending || receiptError;
  function refresh() { setError(''); setVersion(v => v + 1); }
  function acknowledge() { try { sessionStorage.removeItem(key); setReceiptError(false); setPending(null); setError(''); } catch { setError('Enable session storage before changing wallets.'); } }
  function preview(network: WalletNetwork, remove = false) {
    if (!saved || blocked) return;
    const choice = connections.choices[network].find(w => w.address === selection[network]);
    if (!remove && !choice) { setError('Select a connected wallet.'); return; }
    if (network === 'robinhood' && saved.robinhood.address && choice?.address.toLowerCase() !== saved.robinhood.address.toLowerCase()) { setError('Select the saved primary wallet to verify it.'); return; }
    setError(''); setNotice(''); setReview({ network, address: remove ? null : choice!.address, previous: saved[network].address, revision: saved.revision });
  }
  async function save() {
    if (!review || !saved || lock.current || blocked) return;
    lock.current = true; setBusy(true); setError(''); let sent = false;
    try {
      const change = { ...review, agentId: id };
      let proof: { message: string; signature: string } | undefined;
      if (review.address) {
        const choice = connections.choices[review.network].find(w => w.address === review.address);
        if (!choice) throw Error('The wallet disconnected. Connect and select it again.');
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(v => v.toString(16).padStart(2, '0')).join('');
        const message = agentWalletMessage({ ...change, address: review.address }, nonce, Date.now());
        proof = { message, signature: await choice.sign(message) };
      }
      if (!alive.current) return;
      const receipt = { network: review.network, address: review.address, revision: review.revision };
      sessionStorage.setItem(key, JSON.stringify(receipt)); setPending(receipt); sent = true;
      const response = await write(request, '/api/agents/me/wallets', { ...change, proof }, 'PATCH');
      if (!alive.current) return;
      const result = readWallets(response, id);
      if (response.success !== true || !confirmed(result, receipt)) throw Error('The returned wallet did not match. Refresh the saved wallets.');
      setReview(null); setVersion(v => v + 1); // A fresh read resolves the receipt, including a lost response.
    } catch (e) {
      if (!alive.current) return;
      setError(sent ? 'The wallet change was not confirmed. Refresh the saved wallets before trying again.' : e instanceof Error ? e.message : 'Wallet signing was cancelled. Try again when ready.');
      if (sent) { setReview(null); setVersion(v => v + 1); }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function copy(address: string) { try { await navigator.clipboard.writeText(address); setCopied(address); } catch { setCopied(''); setError('Copy was blocked. Select and copy the address below.'); } }
  return <div ref={root} aria-busy={busy}>
    <ResourceState value={resource} retry={refresh} />
    {notice && <p role="status" className={styles.notice}><Check size={17} />{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {(pending || receiptError) && <div className={styles.recovery} role="status"><h2>Check the saved wallet</h2><p>A wallet change was not confirmed. Refresh and compare the saved address before making another change.</p>{pending?.address && <p className={styles.address}>{pending.address}</p>}<div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={refresh}>Refresh wallets</button>{saved && <button className={styles.textButton} disabled={busy} onClick={acknowledge}>I checked the saved wallet</button>}</div></div>}
    {saved && <><div className={styles.identity} data-wallet-item><AgentAvatar id={saved.agentId} seed={saved.avatarSeed} name={saved.name} className={styles.avatar} size={42} /><span className={styles.identityName}>{saved.name}</span><Link className={styles.textLink} href={'/agent/' + encodeURIComponent(saved.name)}>View profile<ArrowUpRight size={15} /></Link></div>
      <div className={styles.sectionHeading} data-wallet-item><h2>Linked wallets</h2><button className={styles.iconButton} disabled={busy} onClick={refresh} aria-label="Refresh wallets"><RefreshCw size={17} /></button></div>
      {networks.map(network => { const current = saved[network], choices = connections.choices[network]; return <section className={styles.wallet} key={network} aria-label={label(network)} data-wallet-item>
        <div className={styles.walletTitle}><Wallet size={21} /><div><h3>{label(network)}</h3><p>{network === 'robinhood' ? 'Primary wallet' : 'Payment wallet'}</p></div><span className={styles.status}>{current.address ? current.verifiedAt ? 'Verified' : 'Not verified' : 'Not linked'}</span></div>
        {current.address && <div className={styles.savedAddress}><p className={styles.address}>{current.address}</p><button className={styles.iconButton} disabled={busy} aria-label={'Copy ' + label(network) + ' address'} onClick={() => void copy(current.address!)}>{copied === current.address ? <Check size={17} /> : <Copy size={17} />}</button></div>}
        {network === 'robinhood' && current.address && current.verifiedAt ? <p className={styles.hint}>This primary wallet is linked to your agent.</p> : <div className={styles.controls}>
          {choices.length > 0 && <div className={styles.field}><label htmlFor={'wallet-' + network}>{current.address ? 'Wallet to verify' : 'Connected wallet'}</label><Select id={'wallet-' + network} value={selection[network]} disabled={blocked} onChange={e => setSelection(v => ({ ...v, [network]: e.target.value }))}><option value="">Select a wallet</option>{choices.map((w, i) => <option key={w.address + i} value={w.address}>{w.address}</option>)}</Select></div>}
          <div className={styles.actions}><button className={network === 'robinhood' ? styles.primary : styles.secondary} disabled={blocked || !connections.ready} onClick={() => { setError(''); connections.connect(network); }}>Connect{choices.length ? ' another' : ''} wallet</button>{choices.length > 0 && <button className={styles.secondary} disabled={blocked || !selection[network]} onClick={() => preview(network)}>Review wallet</button>}{network === 'solana' && current.address && <button className={styles.textButton} disabled={blocked} onClick={() => preview(network, true)}>Remove wallet</button>}</div>
          <p className={styles.hint}>{network === 'robinhood' && current.address ? 'Connect this address to verify it. Changing the primary wallet requires account recovery.' : 'Sign an ownership message to save a wallet.'}</p>
          {network === 'robinhood' && current.address && <Link className={styles.textLink} href="/agent/recover">Recover access<ArrowUpRight size={14} /></Link>}
        </div>}
      </section>; })}</>}
    {review && saved && <TaskDialog title={review.address ? 'Review wallet' : 'Remove Solana wallet'} close={() => { if (!busy) setReview(null); }} busy={busy}>
      <dl className={styles.details}><div><dt>Agent</dt><dd>{saved.name}</dd></div><div><dt>Network</dt><dd>{label(review.network)}</dd></div><div><dt>Current wallet</dt><dd>{review.previous || 'Not linked'}</dd></div>{review.address && <div><dt>New wallet</dt><dd>{review.address}</dd></div>}</dl>
      <p>{review.address ? 'Sign a message to prove you control this wallet. No funds will move.' : 'This removes the saved Solana payment address from your agent.'}</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Waiting for confirmation…' : review.address ? 'Sign and save wallet' : 'Remove wallet'}</button><button className={styles.secondary} disabled={busy} onClick={() => setReview(null)}>Cancel</button></div>
    </TaskDialog>}
  </div>;
}
