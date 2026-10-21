"use client";

import { useId } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { platforms, purchaseLamports, type PlatformId } from '@/lib/agent-tokenization/platforms';
import type { LaunchMode, LaunchRole } from '@/lib/agent-tokenization/types';
import { normalizeSymbol, purchaseWei, shortAddress } from '@/lib/agent-tokenization/policy';
import { formatUnits } from 'viem';
import { AgentAvatar } from '../AgentAvatar';
import type { SessionDetails } from './session-model';
import styles from './tokenization.module.css';

type Network = 'evm' | 'solana';
type Wallet = { address: string; label: string };
export interface SessionChoice { platform: PlatformId; mode: LaunchMode; signer: string; purchase: string }
export interface SessionDraft {
  symbol: string;
  modes: Record<Network, LaunchMode>;
  addresses: Record<Network, string>;
  purchase: Record<PlatformId, string>;
  purchasesOpen: boolean;
}
export function initialSessionDraft(details: SessionDetails, role: LaunchRole): SessionDraft {
  const mode = role === 'admin' ? 'managed' : 'connected';
  const draft: SessionDraft = { symbol: details.session?.metadata.symbol || details.preview.metadata.symbol, modes: { evm: mode, solana: mode },
    addresses: { evm: details.wallets.evm || '', solana: details.wallets.solana || '' },
    purchase: { pons: '0', bags: '0', pump: '0' }, purchasesOpen: false };
  for (const target of details.session?.targets || []) {
    const network = target.terms.platform === 'pons' ? 'evm' : 'solana';
    draft.modes[network] = target.terms.mode; draft.addresses[network] = target.terms.signer;
    draft.purchase[target.terms.platform] = formatUnits(BigInt(target.terms.purchase), network === 'evm' ? 18 : 9);
  }
  return draft;
}
const matches = (network: Network, a: string, b: string) => network === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function SessionReview({ details, selected, role, wallets, draft, change, busy, connect, submit, back, edit }: {
  details: SessionDetails; selected: PlatformId[]; role: LaunchRole; wallets: Record<Network, Wallet[]>;
  draft: SessionDraft; change: (draft: SessionDraft) => void;
  busy: boolean; connect: (network: Network) => void;
  submit: (symbol: string, choices: SessionChoice[]) => void; back: () => void; edit: () => void;
}) {
  const id = useId();
  const networks = (['evm', 'solana'] as const).filter(network => selected.some(platform => (platform === 'pons' ? 'evm' : 'solana') === network));
  const eligibleWallets = (network: Network) => wallets[network].filter(w => role === 'admin' || matches(network, w.address, details.wallets[network] || ''));
  // The select uses the provider's exact casing; EVM identity remains case-insensitive.
  const selectedWallet = (network: Network) => eligibleWallets(network).find(w => matches(network, w.address, draft.addresses[network]));
  const purchasePlatforms = selected.filter(platform => platform !== 'pump' || details.options.find(option => option.platform === platform)?.purchaseAvailable);
  const choices = selected.map(platform => {
    const network = platform === 'pons' ? 'evm' : 'solana';
    return { platform, mode: draft.modes[network],
      signer: draft.modes[network] === 'managed' ? details.deployers?.[network].address || '' : selectedWallet(network)?.address || '',
      purchase: purchasePlatforms.includes(platform) ? draft.purchase[platform] || '0' : '0' };
  });
  let symbolError = '';
  try {
    normalizeSymbol(draft.symbol);
    if (selected.some(p => p !== 'pons') && draft.symbol.length > 10) throw Error('Use up to 10 letters or numbers for Solana.');
  } catch (error) { symbolError = (error as Error).message; }
  const amountErrors = Object.fromEntries(purchasePlatforms.map(platform => {
    try { (platform === 'pons' ? purchaseWei : purchaseLamports)(draft.purchase[platform] || '0'); return [platform, '']; }
    catch (error) { return [platform, (error as Error).message]; }
  }));
  const valid = choices.length > 0 && !symbolError && !Object.values(amountErrors).some(Boolean) && choices.every(c => {
    const network = c.platform === 'pons' ? 'evm' : 'solana';
    return c.mode === 'managed' ? details.deployers?.[network].available : !!selectedWallet(network);
  });
  const hasPurchase = choices.some(choice => !/^0(?:\.0+)?$/.test(choice.purchase));

  return <form className={styles.review} onSubmit={e => { e.preventDefault(); if (valid && !busy) submit(draft.symbol, choices); }}>
    <div className={styles.identity}>
      <AgentAvatar id={details.preview.agentId} name={details.preview.metadata.name} seed={details.preview.metadata.avatarSeed} imageUrl={details.preview.metadata.imageUrl} size={56} className={styles.avatar} />
      <div><h3 tabIndex={-1}>{details.preview.metadata.name}</h3><p className={styles.hint}>{selected.map(p => platforms[p].name).join(' · ')}</p>
        {role === 'admin' && <button type="button" className={styles.editDetails} disabled={busy} onClick={edit}>Edit agent details</button>}
      </div>
    </div>
    <div className={styles.field}><label htmlFor={`${id}-symbol`}>Ticker</label>
      <input id={`${id}-symbol`} value={draft.symbol} onChange={e => change({ ...draft, symbol: e.target.value.toUpperCase() })}
        maxLength={selected.some(p => p !== 'pons') ? 10 : 13} autoComplete="off" spellCheck={false} required disabled={busy}
        aria-invalid={!!symbolError} aria-describedby={symbolError ? `${id}-symbol-error` : undefined} />
      {symbolError && <p id={`${id}-symbol-error`} className={styles.fieldError}>{symbolError}</p>}
    </div>
    <div className={styles.networkWallets}>{networks.map(network => <fieldset className={styles.networkWallet} key={network} disabled={busy}>
      <legend>{network === 'evm' ? 'Robinhood wallet' : 'Solana wallet'}</legend>
      {role === 'admin' && <div className={styles.modeChoice}>
        {(['managed', 'connected'] as const).map(mode => <label key={mode}><input type="radio" name={`${id}-${network}-mode`} checked={draft.modes[network] === mode}
          onChange={() => change({ ...draft, modes: { ...draft.modes, [network]: mode } })} />{mode === 'managed' ? 'Hive deployer' : 'Connected wallet'}</label>)}
      </div>}
      {draft.modes[network] === 'managed'
        ? <p className={styles.hint} title={details.deployers?.[network].address}>{shortAddress(details.deployers?.[network].address || '')}
          {!details.deployers?.[network].available && ' · Unavailable. Use a connected wallet.'}</p>
        : <div className={styles.wallet}>
          {eligibleWallets(network).length > 0 && <><label className={styles.srOnly} htmlFor={`${id}-${network}`}>{network === 'evm' ? 'Select Robinhood wallet' : 'Select Solana wallet'}</label>
            <select id={`${id}-${network}`} value={selectedWallet(network)?.address || ''}
              onChange={e => change({ ...draft, addresses: { ...draft.addresses, [network]: e.target.value } })}>
              <option value="">Select wallet</option>{eligibleWallets(network).map(w => <option key={network === 'evm' ? w.address.toLowerCase() : w.address} value={w.address}>{w.label} · {shortAddress(w.address)}</option>)}
            </select></>}
          <button type="button" className={styles.secondaryLink} onClick={() => connect(network)}>{eligibleWallets(network).length ? 'Connect another wallet' : 'Connect wallet'}</button>
          {role === 'owner' && !selectedWallet(network) && <p className={styles.hint}>{details.wallets[network]
            ? `Connect your verified wallet, ${shortAddress(details.wallets[network]!)}.` : 'Verify a wallet in account settings first.'}</p>}
        </div>}
    </fieldset>)}</div>
    {purchasePlatforms.length > 0 && <details className={styles.purchaseOptions} open={draft.purchasesOpen}
      onToggle={event => { if (event.currentTarget.open !== draft.purchasesOpen) change({ ...draft, purchasesOpen: event.currentTarget.open }); }}>
      <summary>Initial purchase<span>{hasPurchase ? 'Added' : 'Optional'}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className={styles.fields}>{purchasePlatforms.map(platform => <div className={styles.field} key={platform}>
        <label htmlFor={`${id}-${platform}-buy`}>{platforms[platform].name} purchase</label>
        <div className={styles.amount}><input id={`${id}-${platform}-buy`} value={draft.purchase[platform]} inputMode="decimal" autoComplete="off" disabled={busy}
          onChange={e => change({ ...draft, purchase: { ...draft.purchase, [platform]: e.target.value } })}
          aria-invalid={!!amountErrors[platform]} aria-describedby={amountErrors[platform] ? `${id}-${platform}-error` : undefined} /><span>{platforms[platform].currency}</span></div>
        {amountErrors[platform] && <p id={`${id}-${platform}-error`} className={styles.fieldError}>{amountErrors[platform]}</p>}
      </div>)}</div>
    </details>}
    <div className={styles.reviewActions}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={back}>Back</button>
      <button type="submit" className={styles.primary} disabled={busy || !valid}>{busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}{busy ? 'Preparing review…' : 'Review launch'}</button>
    </div>
  </form>;
}
