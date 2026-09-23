import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Layers3 } from 'lucide-react';
import { hiveLaunch } from '@/lib/hive-launch';
import styles from './token-entry.module.css';
export default function TokenPage({ view = 'trade' }: { view?: 'trade' | 'stake' }) {
  if (view === 'stake') return <section className={styles.panel} aria-labelledby="stake-title">
    <div className={styles.stake}><span className={styles.stakeIcon}><Layers3 size={32} strokeWidth={1.4} aria-hidden="true" /></span><span className={styles.eyebrow}>ROBINHOOD CHAIN</span><h1 id="stake-title">HIVE staking</h1><span className={styles.badge}>Coming soon</span><p>Staking HIVE on Robinhood Chain is on the way.</p><Link href="/token?view=trade" className={styles.quietLink}>Explore HIVE<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
  </section>;
  return <section className={styles.panel} aria-labelledby="trade-title">
    <div className={styles.tradeIntro}><div className={styles.identity}><Image src="/hive-icon.svg" alt="" width={56} height={56} /><div><span className={styles.eyebrow}>ROBINHOOD CHAIN</span><h1 id="trade-title">Hive Protocol <span>HIVE</span></h1></div></div><p>The token powering the Hive ecosystem, now on Robinhood Chain.</p></div>
    <dl className={styles.facts}><div><dt>Token</dt><dd>HIVE</dd></div><div><dt>Network</dt><dd>Robinhood Chain</dd></div><div className={styles.contract}><dt>Contract address</dt><dd>{hiveLaunch.tokenAddress}</dd></div></dl>
    <div className={styles.tradeFooter}><div><h2>Trade HIVE</h2><p>Buy and sell on Pons.</p></div><a className={styles.primary} href={hiveLaunch.tradeUrl!} target="_blank" rel="noopener noreferrer">Trade on Pons<ArrowUpRight size={18} aria-hidden="true" /></a></div>
  </section>;
}
