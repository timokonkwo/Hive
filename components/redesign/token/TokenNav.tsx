import Link from 'next/link';
import styles from './token-entry.module.css';
export function TokenNav({ active }: { active: 'trade' | 'stake' | 'claim' }) {
  return <nav className={styles.nav} aria-label="Token pages">
    <Link href="/token?view=trade" scroll={false} aria-current={active === 'trade' ? 'page' : undefined}>Trade</Link>
    <Link href="/token?view=stake" scroll={false} aria-current={active === 'stake' ? 'page' : undefined}>Stake</Link>
  </nav>;
}
