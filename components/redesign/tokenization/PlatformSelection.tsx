"use client";

import { ArrowUpRight, Loader2 } from 'lucide-react';
import { platformIds, platforms, tradeUrl, type AgentToken, type PlatformId } from '@/lib/agent-tokenization/platforms';
import styles from './tokenization.module.css';

export interface PlatformOption {
  platform: PlatformId;
  available: boolean;
  purchaseAvailable?: boolean;
  existingUrl?: string;
  token?: AgentToken;
  pending?: boolean;
  reason?: string;
}
export function PlatformSelection({ options, selected, onChange, onContinue, onResume, busy = false }: {
  options: PlatformOption[]; selected: PlatformId[]; onChange: (selected: PlatformId[]) => void;
  onContinue: () => void; onResume: (platform: PlatformId) => void; busy?: boolean;
}) {
  const available = options.filter(option => option.available && !option.token && !option.pending).map(option => option.platform);
  const valid = selected.length > 0 && selected.every(platform => available.includes(platform));
  return <div className={styles.review}>
    <div><h3 className={styles.stepTitle}>{available.length ? 'Choose where to launch' : options.some(option => option.token) ? 'Your agent tokens' : 'Launch platforms'}</h3>
      {available.length > 0 && <p className={styles.hint}>Each platform creates an independent token.</p>}</div>
    <fieldset className={styles.platformChoices} disabled={busy}>
      <legend className={styles.srOnly}>Launch platforms</legend>
      {platformIds.map(platform => {
        const option = options.find(item => item.platform === platform);
        if (!option) return null;
        const details = platforms[platform];
        const title = platform === 'pons' ? details.chainName : details.name;
        const subtitle = platform === 'pons' ? details.name : details.chainName;
        const locked = !option.available || !!option.token || !!option.pending;
        return <div className={styles.platformChoice} key={platform} data-selected={selected.includes(platform) && !locked}>
          {option.token ? <><div><strong>{title}</strong><span>{subtitle} · ${option.token.symbol}</span></div>
            <a href={tradeUrl(option.token)} target="_blank" rel="noopener noreferrer">Trade<ArrowUpRight size={15} aria-hidden="true" /></a></>
            : option.existingUrl ? <><div><strong>{title}</strong><span>{subtitle} · Existing token</span></div><a href={option.existingUrl} target="_blank" rel="noopener noreferrer">View token<ArrowUpRight size={15} aria-hidden="true" /></a></>
            : option.pending ? <><div><strong>{title}</strong><span>{subtitle}</span></div>
              <button type="button" className={styles.secondary} onClick={() => onResume(platform)}>Resume</button></>
              : <label><input type="checkbox" checked={!locked && selected.includes(platform)} disabled={locked}
                onChange={event => onChange(event.target.checked ? platformIds.filter(id => id === platform || selected.includes(id)) : selected.filter(id => id !== platform))} />
                <div><strong>{title}</strong><span>{subtitle}{!option.available && ` · ${option.reason || 'Unavailable'}`}</span></div>
              </label>}
        </div>;
      })}
    </fieldset>
    {available.length > 0 && <div className={styles.selectionFooter}>
      {available.length > 1 && <button type="button" className={styles.secondaryLink} disabled={busy} onClick={() => onChange(available)}>
        Select all available
      </button>}
      <button type="button" className={styles.primary} disabled={busy || !valid} onClick={onContinue}>
        {busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}{busy ? 'Preparing review…' : 'Continue'}
      </button>
    </div>}
  </div>;
}
