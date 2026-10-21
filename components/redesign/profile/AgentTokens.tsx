"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Loader2, X } from 'lucide-react';
import { platforms, tokenKey, tradeUrl, type AgentToken } from '@/lib/agent-tokenization/platforms';
import styles from './profile.module.css';

function TradeOption({ token }: { token: AgentToken }) {
  const [copy, setCopy] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle');
  async function copyAddress() {
    setCopy('pending');
    try { await navigator.clipboard.writeText(token.address); setCopy('copied'); }
    catch { setCopy('error'); }
  }
  const platform = platforms[token.platform];
  return <li className={styles.tradeOption}>
    <a href={tradeUrl(token)} target="_blank" rel="noopener noreferrer" aria-label={`Trade on ${platform.name}`}>
      <span><strong>{platform.name}</strong><span>${token.symbol} · {platform.chainName}</span></span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
    <button type="button" onClick={() => void copyAddress()} disabled={copy === 'pending'}
      aria-label={`Copy ${platform.name} token address`} title={token.address}>
      {copy === 'pending' ? <Loader2 size={16} className={styles.tokenSpinner} aria-hidden="true" />
        : copy === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
    <span className={styles.copyStatus} role="status">{copy === 'copied' ? 'Address copied' : copy === 'error' ? 'Could not copy address' : ''}</span>
  </li>;
}

function TradeDialog({ tokens, close }: { tokens: AgentToken[]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  return <dialog ref={dialog} className={styles.tradeDialog} aria-labelledby={heading}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header><h2 id={heading}>Trade agent token</h2><button type="button" aria-label="Close trade dialog" onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <ul>{tokens.map(token => <TradeOption key={tokenKey(token)} token={token} />)}</ul>
  </dialog>;
}

/** Agent community tokens only; task/tool-created tokens have a separate history. */
export function AgentTokens({ tokens }: { tokens: AgentToken[] }) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  if (!tokens.length) return null;
  const symbols = [...new Set(tokens.map(token => token.symbol))];
  const networks = [...new Set(tokens.map(token => platforms[token.platform].chainName))];
  return <section className={styles.agentTokens} aria-labelledby={heading}>
    <div><h2 id={heading}>{tokens.length === 1 ? 'Agent token' : 'Agent tokens'}</h2>
      <p><strong>{symbols.length === 1 ? `$${symbols[0]}` : `${tokens.length} tokens`}</strong><span>{networks.join(' · ')}</span></p>
    </div>
    <button type="button" className={styles.tradeTrigger} aria-haspopup="dialog" onClick={() => setOpen(true)}>Trade<ArrowUpRight size={16} aria-hidden="true" /></button>
    {open && <TradeDialog tokens={tokens} close={() => setOpen(false)} />}
  </section>;
}
