"use client";
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { explorerTransactionUrl, shortAddress } from '@/lib/agent-tokenization/policy';
import type { LaunchQuote, SavedLaunch } from './model';
import styles from './tokenization.module.css';

export function LaunchTransaction({ quote,connected,confirm,back,refresh,connect }: {quote:LaunchQuote;connected:boolean;confirm:()=>void;back:()=>void;refresh:()=>void;connect:()=>void}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const expired=now>=quote.expiresAt;
  return <div className={styles.review}>
    <div><span className={styles.eyebrow}>Robinhood Chain</span><h3 className={styles.stepTitle}>{quote.action==='cancel'?'Cancel pending launch':'Review transaction'}</h3></div>
    {quote.action==='cancel'&&<p className={styles.hint}>Replaces the pending transaction. Network fees apply.</p>}
    <dl className={styles.details}>
      <div><dt>Wallet</dt><dd title={quote.transaction.from}>{shortAddress(quote.transaction.from)}</dd></div>
      {quote.mode==='managed' ? <>
        <div><dt>Launch fee</dt><dd>{formatEther(BigInt(quote.launchFee!))} ETH</dd></div>
        <div><dt>Initial purchase</dt><dd>{formatEther(BigInt(quote.purchase!))} ETH</dd></div>
        {BigInt(quote.purchase!)>0n&&<div><dt>Tokens go to</dt><dd title={quote.transaction.from}>{shortAddress(quote.transaction.from)}</dd></div>}
      </> : <div><dt>Transaction value</dt><dd>{formatEther(BigInt(quote.transaction.value))} ETH</dd></div>}
      <div><dt>Network fee, maximum</dt><dd>{formatEther(BigInt(quote.maximumNetworkFee))} ETH</dd></div>
      <div><dt>Total, maximum</dt><dd>{formatEther(BigInt(quote.maximumTotal))} ETH</dd></div>
    </dl>
    {expired&&<p role="status" className={styles.hint}>Fee estimate expired. Refresh to continue.</p>}
    {!connected&&<button type="button" className={styles.secondary} onClick={connect}>Connect launch wallet</button>}
    <button type="button" className={styles.primary} onClick={expired?refresh:confirm} disabled={!expired&&!connected}>{expired?'Refresh estimate':quote.action==='cancel'?'Confirm cancellation':quote.mode==='managed'?'Confirm launch':'Approve launch'}</button>
    <button type="button" className={styles.secondary} onClick={back}>Back</button>
  </div>;
}
export function LaunchRecovery({ launch,enabled,connected,review,cancelDraft,restart,check,connect,retry,readOnly=false }: {
  launch:SavedLaunch;enabled:boolean;connected:boolean;review:(action:'resume'|'cancel')=>void;cancelDraft:()=>void;restart:()=>void;retry?:()=>void;readOnly?:boolean;check:()=>void;connect:()=>void;
}) {
  const terminal=launch.phase==='cancelled'||launch.phase==='reverted';
  const draft=launch.phase==='draft';
  const hash=launch.cancellationHash||launch.transactionHash;
  const managed=launch.mode==='managed';
  const unsigned=managed&&!hash;
  return <div className={styles.review}>
    <div className={styles.pending} role="status">
      {!terminal&&!draft&&<Loader2 size={26} className={styles.spinner} aria-hidden="true"/>}
      <h3>{terminal?(launch.phase==='cancelled'?'Launch cancelled':'Launch transaction reverted'):draft?'Unfinished launch':launch.cancellationHash?'Confirming cancellation…':hash?'Confirming your launch…':'Your pending launch'}</h3>
      <p className={styles.hint}>Wallet · {shortAddress(launch.signer)}</p>
      {hash&&<a href={explorerTransactionUrl(hash)} target="_blank" rel="noopener noreferrer">View transaction<ArrowUpRight size={15} aria-hidden="true"/></a>}
    </div>
    {readOnly ? <button type="button" className={styles.primary} onClick={check}>Check status</button> : terminal?<button type="button" className={styles.primary} disabled={!enabled} onClick={restart}>Start a new launch</button>
      :draft?<button type="button" className={styles.primary} onClick={cancelDraft}>Discard draft</button>
      :<>
        {!connected&&<button type="button" className={styles.secondary} onClick={connect}>Connect launch wallet</button>}
        <button type="button" className={styles.primary} onClick={check}>Check status</button>
        <div className={styles.recoveryActions}>
          {managed ? <>
            {unsigned ? <>
              <button type="button" className={styles.secondary} disabled={!enabled} onClick={()=>review('resume')}>Review launch</button>
              <button type="button" className={styles.secondary} onClick={cancelDraft}>Discard review</button>
            </> : <button type="button" className={styles.secondary} onClick={retry}>Retry submission</button>}
          </> : <>
          {!launch.cancellationHash&&<button type="button" className={styles.secondary} disabled={!enabled} onClick={()=>review('resume')}>Review launch</button>}
          <button type="button" className={styles.secondary} onClick={()=>review('cancel')}>{launch.cancellationHash?'Review cancellation':'Cancel launch'}</button>
          </>}
        </div>
      </>}
  </div>;
}
