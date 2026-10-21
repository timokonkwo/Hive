"use client";
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import type { LaunchSession } from '@/lib/agent-tokenization/session';
import { platforms } from '@/lib/agent-tokenization/platforms';
import styles from './tokenization.module.css';

export function LaunchApproval({ session, busy, launch, back }: { session: LaunchSession; busy: boolean; launch: () => void; back: () => void }) {
  return <section className={styles.review}>
    <div><h3 className={styles.stepTitle}>Ready to launch</h3><p className={styles.hint}>{session.metadata.name} · ${session.metadata.symbol}</p></div>
    <dl className={styles.details}>{session.targets.filter(t => !['confirmed', 'skipped'].includes(t.phase)).map(t => <div key={t.terms.platform}>
      <dt>{platforms[t.terms.platform].name}</dt><dd>Up to {formatUnits(BigInt(session.estimate?.limits[t.terms.platform] || '0'), t.terms.platform === 'pons' ? 18 : 9)} {platforms[t.terms.platform].currency}</dd>
    </div>)}</dl>
    <p className={styles.hint}>Spending limits include setup, fees and any initial purchase. Only the actual cost is charged.</p>
    {session.targets.some(t => t.replacementSetup && !['confirmed', 'skipped'].includes(t.phase)) && <p className={styles.hint}>These changes require new Bags setup. Previously paid network fees are not refunded.</p>}
    <div className={styles.reviewActions}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={back}>Back</button>
      <button type="button" className={styles.primary} disabled={busy || !session.estimate} onClick={launch}>{busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}Launch tokens</button>
    </div>
  </section>;
}
