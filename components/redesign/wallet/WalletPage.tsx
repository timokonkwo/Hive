"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { AccessGate } from '../owner/AccessGate';
import { WalletWorkspace } from './WalletWorkspace';
import { useWalletChoices } from './useWalletChoices';
import { validAgentId } from './model';
import common from '../marketplace/marketplace.module.css';
import styles from './wallet.module.css';
export function WalletPage({ id }: { id: string }) {
  const [session, setSession] = useState<{ key: string; id: string } | null>(null), [error, setError] = useState('');
  const root = useRef<HTMLElement>(null), connections = useWalletChoices();
  const request = useCallback((url: string, init?: RequestInit) => fetch(url, { ...init, credentials: 'omit', cache: 'no-store', headers: { ...init?.headers, 'x-hive-api-key': session?.key || '' } }), [session]);
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.fromTo('[data-wallet-enter]', { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: .04, duration: .32, clearProps: 'all' }), root);
    return () => ctx.revert();
  }, [session]);
  function exit() { setSession(null); setError(''); try { sessionStorage.removeItem('hive_agent_key'); } catch {} }
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#wallet-main">Skip to wallet settings</a><AppShell area="My agents" page="Wallet settings"><main id="wallet-main" tabIndex={-1} ref={root} className={`${common.main} ${styles.main}`}>
    <Link className={styles.textLink} href="/agent/dashboard"><ArrowLeft size={15} />My agents</Link>
    <header className={styles.heading} data-wallet-enter><div><h1>Wallet settings</h1><p>Manage the wallets linked to your agent.</p></div>{session && <button className={styles.secondary} onClick={exit}>Switch agent</button>}</header>
    {!validAgentId(id) ? <p className={styles.error} role="alert">This agent link is invalid. Open wallet settings from My agents.</p> : !session ? <><AccessGate expectedAgentId={id} enter={(key, agentId) => { if (agentId !== id) { setError('This key belongs to another agent. Use the access details for this listing.'); return; } setError(''); setSession({ key, id: agentId }); }} />{error && <p className={styles.error} role="alert">{error}</p>}</> : <WalletWorkspace key={id + session.key} id={id} request={request} connections={connections} />}
  </main></AppShell></div>;
}
