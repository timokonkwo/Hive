"use client";

import { ArrowUpRight, Check, Circle, Loader2, TriangleAlert } from 'lucide-react';
import type { LaunchSession, TargetPhase } from '@/lib/agent-tokenization/session';
import { platforms, tradeUrl, transactionUrl, type PlatformId } from '@/lib/agent-tokenization/platforms';
import styles from './tokenization.module.css';

const labels: Record<TargetPhase, string> = {
  queued: 'Waiting', preparing: 'Preparing launch…', 'awaiting-signature': 'Ready for approval',
  submitted: 'Confirming launch…', confirming: 'Confirming launch…', confirmed: 'Launched',
  failed: 'Launch failed', skipped: 'Skipped', blocked: 'Check launch status',
};
export function LaunchBatchProgress({ session, busy, readOnly = false, onContinue, onRetry, onSkip, onCheck }: {
  session: LaunchSession; busy: boolean; readOnly?: boolean; onContinue: () => void;
  onRetry: (platform: PlatformId) => void; onSkip: (platform: PlatformId) => void; onCheck: () => void;
}) {
  const successes = session.targets.filter(t => t.phase === 'confirmed').length;
  const unresolved = session.targets.some(t => ['preparing', 'awaiting-signature', 'submitted', 'confirming', 'blocked'].includes(t.phase));
  const complete = session.targets.every(t => ['confirmed', 'skipped'].includes(t.phase));
  const heading = complete ? successes === 0 ? 'No tokens launched' : successes === session.targets.length ? 'Launch complete' : 'Launch finished'
    : session.paused ? 'Launch paused' : 'Launching tokens';
  return <div className={styles.review} aria-busy={busy}>
    <div><h3 className={styles.stepTitle}>{heading}</h3>
      <p className={styles.hint} role="status">{successes} of {session.targets.length} launched</p></div>
    <ol className={styles.batchList}>
      {session.targets.map(target => {
        const platform = platforms[target.terms.platform], token = target.token;
        const pending = ['preparing', 'submitted', 'confirming'].includes(target.phase);
        const failed = target.phase === 'failed' || target.phase === 'blocked';
        return <li key={target.terms.platform}>
          <div className={styles.batchIdentity}>
            {pending ? <Loader2 size={20} className={styles.spinner} aria-hidden="true" /> : token ? <Check size={20} aria-hidden="true" />
              : failed ? <TriangleAlert size={20} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
            <div><strong>{platform.name}</strong><span role="status">{platform.chainName} · {labels[target.phase]}</span></div>
          </div>
          {token && <div className={styles.batchLinks}><a href={tradeUrl(token)} target="_blank" rel="noopener noreferrer">Trade<ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href={transactionUrl(token.network, token.transactionHash)} target="_blank" rel="noopener noreferrer">Transaction<ArrowUpRight size={14} aria-hidden="true" /></a></div>}
          {failed && <div className={styles.batchError} role="alert"><p>{target.error || 'The launch needs attention before continuing.'}</p>
            {!readOnly && (target.phase === 'failed' ? <div className={styles.recoveryActions}>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => onRetry(target.terms.platform)}>{busy && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}Retry launch</button>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => onSkip(target.terms.platform)}>{busy && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}Skip this platform</button>
            </div> : <button type="button" className={styles.secondary} disabled={busy} onClick={onCheck}>
              {busy && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}Check status
            </button>)}
          </div>}
        </li>;
      })}
    </ol>
    {!readOnly && session.paused && !unresolved && !complete && !session.targets.some(t => t.phase === 'failed') &&
      <button type="button" className={styles.primary} disabled={busy} onClick={onContinue}>
        {busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}Continue remaining launches
      </button>}
  </div>;
}
