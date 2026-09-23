import { AppShell } from '../AppShell';
import { TokenNav } from './TokenNav';
import common from '../marketplace/marketplace.module.css';
import styles from './token-entry.module.css';

export default function TokenPage() {
  return <div className={common.page} data-hive-app>
    <a className={common.skipLink} href="#token-main">Skip to HIVE</a>
    <AppShell area="HIVE" page="Stake"><main id="token-main" tabIndex={-1} className={common.main}>
      <TokenNav active="stake" />
      <section className={styles.comingSoon}><h1>Staking coming soon</h1></section>
    </main></AppShell>
  </div>;
}
