"use client";
import { useEffect, useRef, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import { ChevronDown, LogOut, Settings2, UserRound, Wallet } from 'lucide-react';
import styles from './app-shell.module.css';
export function AccountControl() {
 const {ready,authenticated,user,login,logout,connectWallet}=usePrivy();
 const {wallets:evmWallets}=useWallets(),{wallets:solanaWallets}=useSolanaWallets();
 const wallets=[...evmWallets,...solanaWallets].filter((w,i,all)=>all.findIndex(other=>other.address===w.address)===i);
 const menu=useRef<HTMLDetailsElement>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};const outside=(e:PointerEvent)=>{if(menu.current&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);};},[]);
 function close(){if(menu.current)menu.current.open=false;}
 async function signOut(){setBusy(true);setError('');try{await logout();close();}catch{setError('Sign-out failed. Try again.');}finally{setBusy(false);}}
 if(!ready||!authenticated)return <button data-account-state={ready?'signed-out':'loading'} className={styles.signIn} disabled={!ready} onClick={()=>login()}>{ready?'Sign in':'Loading…'}</button>;
 const address=user?.wallet?.address,identity=user?.email?.address||user?.google?.email||(address?address.slice(0,6)+'…'+address.slice(-4):'Signed in');
 return <details ref={menu} className={styles.accountMenu} data-account-state="signed-in"><summary aria-label="Account menu"><UserRound size={17} aria-hidden="true"/><span>Account</span><ChevronDown size={13} aria-hidden="true"/></summary><div className={styles.accountPanel}><p>{identity}</p><Link prefetch={false} href="/dashboard?view=account" onClick={close}><Settings2 size={16}/>Account settings</Link><div className={styles.connectedWallets}>{wallets.map(w=><p key={w.address} title={w.address}><Wallet size={14} aria-hidden="true"/><span>{w.address.slice(0,6)}…{w.address.slice(-4)}</span><small>Connected</small></p>)}</div><button onClick={()=>{close();connectWallet();}}><Wallet size={16}/>{wallets.length?'Change wallet':'Connect wallet'}</button><button disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/>{busy?'Signing out…':'Sign out'}</button>{error&&<p role="alert">{error}</p>}</div></details>;
}
