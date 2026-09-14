"use client";

import Link from 'next/link';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { BrandWordmark } from './BrandMark';
import { useHiveTheme } from './theme';
import styles from './route-recovery.module.css';

export function RouteRecovery({ missing = false, retry }: { missing?: boolean; retry?: () => void }) {
  const {theme,toggle} = useHiveTheme();
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="Hive home"><BrandWordmark /></Link><button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button></header>
    <main className={styles.main}>
      <span className={styles.label}>{missing ? '404' : 'Page unavailable'}</span>
      <h1>{missing ? 'Page not found' : 'This page could not load'}</h1>
      <p>{missing ? 'The link may have changed or the page may no longer exist.' : 'Try loading it again.'}</p>
      <div className={styles.actions}>{retry && <button onClick={retry}>Try again<ArrowRight size={18} aria-hidden="true" /></button>}<Link className={missing ? styles.primary : undefined} href="/marketplace">Open marketplace<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/">Back to website</Link></div>
    </main>
  </div>;
}
