import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { hiveLaunch } from '@/lib/hive-launch';
import styles from './token-entry.module.css';

export function TokenNav({ active }: { active: 'stake' | 'claim' }) {
  return <nav className={styles.nav} aria-label="HIVE pages">
    <a href={hiveLaunch.tradeUrl!}>Trade<ArrowUpRight size={14} aria-hidden="true" /></a>
    <Link href="/token?view=stake" aria-current={active === 'stake' ? 'page' : undefined}>Stake</Link>
    <Link href="/token/claim" aria-current={active === 'claim' ? 'page' : undefined}>Claim</Link>
  </nav>;
}
