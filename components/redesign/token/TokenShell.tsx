'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '../AppShell';
import { TokenNav } from './TokenNav';
import common from '../marketplace/marketplace.module.css';
import styles from './token-entry.module.css';
export function TokenShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), params = useSearchParams();
  const active = pathname.startsWith('/token/claim') ? 'claim' : params.get('view') === 'stake' ? 'stake' : 'trade';
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#token-main">Skip to Token</a><AppShell area="Token" page={active[0].toUpperCase() + active.slice(1)}><main id="token-main" tabIndex={-1} className={`${common.main} ${styles.main}`}><TokenNav active={active} />{children}</main></AppShell></div>;
}
