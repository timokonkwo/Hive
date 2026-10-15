"use client";

import { useId, useState } from 'react';
import { ArrowUpRight, Check, Copy, Loader2 } from 'lucide-react';
import { AgentAvatar } from '../AgentAvatar';
import { AgentDetailsEditor, type AgentProfileEdit } from './AgentDetailsEditor';
import type { LaunchPreview, LaunchProgress, LaunchMode } from '@/lib/agent-tokenization/types';
import {
  explorerTransactionUrl, normalizeSymbol, ponsTokenUrl, purchaseWei, sameAddress, shortAddress,
} from '@/lib/agent-tokenization/policy';
import styles from './tokenization.module.css';

export interface LaunchWallet { address: string; label: string }
export interface LaunchReviewProps {
  preview: LaunchPreview;
  mode?: LaunchMode;
  onMode?: (mode: LaunchMode) => void;
  wallets: LaunchWallet[];
  wallet: string;
  symbol: string;
  purchase: string;
  progress: LaunchProgress;
  error: string;
  connecting: boolean;
  onWallet: (address: string) => void;
  onSymbol: (symbol: string) => void;
  onPurchase: (purchase: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  onLaunch?: () => void;
  onSaveProfile?: (input: AgentProfileEdit) => Promise<void>;
  onEditorBusy?: (busy: boolean) => void;
}

const pendingLabels = {
  submitting: 'Submitting your launch…',
  preparing: 'Preparing your launch…',
  authorizing: 'Approve wallet verification…',
  'awaiting-signature': 'Approve the launch in your wallet…',
  confirming: 'Confirming your launch…',
  checking: 'Checking your launch…',
};

/** Presentation only: signing and transaction lifecycle never belong in this component. */
export function LaunchReview(props: LaunchReviewProps) {
  const { preview, progress } = props;
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const token = preview.existingToken || (progress.stage === 'success' ? progress.token : null);
  const pending = progress.stage !== 'review' && progress.stage !== 'success';
  const managed = preview.role === 'admin' && props.mode === 'managed';
  const signerMatches = !preview.requiredSigner || sameAddress(preview.requiredSigner, props.wallet);
  let symbolError = '', amountError = '';
  try { normalizeSymbol(props.symbol); } catch (error) { symbolError = (error as Error).message; }
  try { purchaseWei(props.purchase); } catch (error) { amountError = (error as Error).message; }

  if (token) return <div className={styles.success}>
    <span className={styles.successIcon}><Check size={24} aria-hidden="true" /></span>
    <h3>{token.symbol || preview.metadata.name} is live</h3>
    <p>Robinhood Chain</p>
    <div className={styles.contract}>
      <input aria-label="Token contract address" value={token.address} readOnly onFocus={e => e.target.select()} />
      <button type="button" aria-label="Copy token contract address" onClick={async () => {
        try { await navigator.clipboard.writeText(token.address); setCopied(true); }
        catch { setCopied(false); document.getElementById(`${id}-copy`)?.focus(); }
      }}><Copy size={16} aria-hidden="true" /></button>
    </div>
    <span id={`${id}-copy`} className={styles.hint} tabIndex={-1} role="status">{copied ? 'Address copied.' : 'Select the address to copy it.'}</span>
    <a className={styles.primary} href={ponsTokenUrl(token.address)} target="_blank" rel="noopener noreferrer">Trade on Pons<ArrowUpRight size={17} aria-hidden="true" /></a>
    <a className={styles.secondaryLink} href="https://ponsfamily.com/profile" target="_blank" rel="noopener noreferrer">Creator fees on Pons<ArrowUpRight size={15} aria-hidden="true" /></a>
    <a className={styles.secondaryLink} href={explorerTransactionUrl(token.transactionHash)} target="_blank" rel="noopener noreferrer">View transaction<ArrowUpRight size={15} aria-hidden="true" /></a>
  </div>;

  if (editing && preview.adminProfile && props.onSaveProfile) return <AgentDetailsEditor preview={preview} save={props.onSaveProfile} busyChanged={props.onEditorBusy || (() => {})}
    cancel={() => { setEditing(false); requestAnimationFrame(() => document.getElementById(`${id}-edit`)?.focus()); }} />;

  return <div className={styles.review}>
    <div className={styles.identity}>
      <AgentAvatar id={preview.agentId} name={preview.metadata.name} seed={preview.metadata.avatarSeed} imageUrl={preview.metadata.imageUrl} size={56} className={styles.avatar} />
      <div><span className={styles.eyebrow}>Robinhood Chain</span><h3>{preview.metadata.name}</h3></div>
    </div>
    {!pending && preview.role === 'admin' && preview.adminProfile && props.onSaveProfile && <button id={`${id}-edit`} type="button" className={styles.editDetails} onClick={() => setEditing(true)}>Edit agent details</button>}
    <p className={styles.bio}>{preview.metadata.description || 'Add a bio to the agent profile.'}</p>
    <a className={styles.secondaryLink} href={preview.metadata.socials.website} target="_blank" rel="noopener noreferrer">View agent profile<ArrowUpRight size={14} aria-hidden="true" /></a>
    {pending ? <div className={styles.pending} role="status" aria-live="polite">
      <Loader2 size={26} className={styles.spinner} aria-hidden="true" />
      <h3>{pendingLabels[progress.stage as keyof typeof pendingLabels]}</h3>
      {progress.transactionHash && <a href={explorerTransactionUrl(progress.transactionHash)} target="_blank" rel="noopener noreferrer">View transaction<ArrowUpRight size={15} aria-hidden="true" /></a>}
    </div> : <>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={`${id}-symbol`}>Ticker</label>
          <input id={`${id}-symbol`} value={props.symbol} onChange={e => props.onSymbol(e.target.value.toUpperCase())} maxLength={10} autoComplete="off" spellCheck={false}
            aria-invalid={!!symbolError} aria-describedby={symbolError ? `${id}-symbol-error` : undefined} />
          {symbolError && <p id={`${id}-symbol-error`} className={styles.fieldError}>{symbolError}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-purchase`}>Opening buy <span>optional</span></label>
          <div className={styles.amount}><input id={`${id}-purchase`} inputMode="decimal" value={props.purchase} onChange={e => props.onPurchase(e.target.value)} placeholder="0" autoComplete="off"
            aria-invalid={!!amountError} aria-describedby={amountError ? `${id}-amount-error` : undefined} /><span>ETH</span></div>
          {amountError && <p id={`${id}-amount-error`} className={styles.fieldError}>{amountError}</p>}
        </div>
      </div>
      <dl className={styles.details}>
        <div><dt>Trading fee</dt><dd>3%</dd></div>
        <div><dt>Creator fees go to</dt><dd title={preview.recipient || undefined}>{preview.recipient ? shortAddress(preview.recipient) : 'Verify your wallet'}</dd></div>
        <div><dt>Buy slippage</dt><dd>1%</dd></div>
      </dl>
      {preview.role === 'admin' && props.onMode && <fieldset className={styles.modeChoice}>
        <legend>Launch with</legend>
        <label><input type="radio" name={`${id}-mode`} value="managed" checked={managed} onChange={() => props.onMode?.('managed')} />Hive deployer</label>
        <label><input type="radio" name={`${id}-mode`} value="connected" checked={!managed} onChange={() => props.onMode?.('connected')} />Connected wallet</label>
      </fieldset>}
      {managed ? <div className={styles.wallet}>
        <span className={styles.hint}>Hive deployer · {preview.managedDeployer ? shortAddress(preview.managedDeployer.address) : 'Unavailable'}</span>
        {!preview.managedDeployer?.available && <p className={styles.fieldError}>{preview.managedDeployer?.reason || 'Hive deployer is unavailable. Use a connected wallet.'}</p>}
      </div> : <div className={styles.wallet}>
        <label htmlFor={`${id}-wallet`}>Launch wallet</label>
        {props.wallets.length > 0 && <select id={`${id}-wallet`} value={props.wallet} onChange={e => props.onWallet(e.target.value)}>
          <option value="">Select a wallet</option>
          {props.wallets.map(w => <option key={w.address.toLowerCase()} value={w.address}>{w.label} · {shortAddress(w.address)}</option>)}
        </select>}
        <button type="button" className={styles.secondary} onClick={props.onConnect} disabled={props.connecting}>
          {props.connecting && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}
          {props.connecting ? 'Opening wallets…' : props.wallets.length ? 'Connect another wallet' : 'Connect wallet'}
        </button>
        {props.wallet && !signerMatches && <p className={styles.fieldError}>Select your verified wallet, {shortAddress(preview.requiredSigner!)}.</p>}
        {props.wallet && signerMatches && <p className={styles.hint}>Connected: {shortAddress(props.wallet)}</p>}
      </div>}
      {preview.issues.length > 0 && <div className={styles.notice}><ul>{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <div className={styles.footer}>
        {!preview.signingEnabled && <p id={`${id}-availability`} className={styles.hint}>Token launches are not enabled yet.</p>}
        <button type="button" className={styles.primary} disabled={!preview.signingEnabled || (managed ? !preview.managedDeployer?.available : !props.wallet || !signerMatches) || !!symbolError || !!amountError || preview.issues.length>0 || !props.onLaunch}
          aria-describedby={!preview.signingEnabled?`${id}-availability`:undefined} onClick={props.onLaunch}>Review launch</button>
      </div>
    </>}
    {props.error && <div className={styles.notice} role="alert"><p>{props.error}</p><button type="button" className={styles.secondary} onClick={props.onRefresh}>Check status</button></div>}
  </div>;
}
