"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { platforms } from '@/lib/agent-tokenization/platforms';
import { shortAddress } from '@/lib/agent-tokenization/policy';
import type { TransactionReview } from './session-model';
import styles from './tokenization.module.css';

export function SolanaLaunchReview({ review, purchase, connected, busy, signing, confirm, refresh, connect }: {
  review: TransactionReview; purchase: string; connected: boolean; busy: boolean; signing: boolean;
  confirm: () => void; refresh: () => void; connect: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = now >= Date.parse(review.expiresAt);
  const needsWallet = review.mode === 'connected' && !connected;
  const label = signing ? review.mode === 'connected' ? 'Waiting for wallet…' : 'Submitting…'
    : busy ? 'Preparing review…' : expired ? 'Refresh estimate' : needsWallet ? 'Connect launch wallet' : 'Approve transaction';
  return <section className={styles.transactionReview}>
    <h3 className={styles.stepTitle}>{review.stage === 'setup' ? 'Set up Bags launch' : `Launch on ${platforms[review.platform].name}`}</h3>
    <dl className={styles.details}>
      <div><dt>Wallet</dt><dd title={review.signer}>{shortAddress(review.signer)}</dd></div>
      {review.stage === 'launch' && BigInt(purchase) > 0n && <div><dt>Initial purchase</dt><dd>{formatUnits(BigInt(purchase), 9)} SOL</dd></div>}
      <div><dt>Total, maximum</dt><dd>{formatUnits(BigInt(review.maximumDebit), 9)} SOL</dd></div>
    </dl>
    {expired && <p className={styles.hint} role="status">Fee estimate expired. Refresh to continue.</p>}
    <button type="button" className={styles.primary} disabled={busy} onClick={expired ? refresh : needsWallet ? connect : confirm}>
      {busy && <Loader2 size={17} className={styles.spinner} aria-hidden="true" />}{label}
    </button>
  </section>;
}
