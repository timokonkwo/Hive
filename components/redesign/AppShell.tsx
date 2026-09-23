"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, ArrowUpRight, Bot, ChevronDown, ClipboardList, Compass, Flag, HelpCircle, Layers2, Menu, MessageSquare, Moon, Plus, Scale, Sun, Wrench, X } from 'lucide-react';
import { BrandWordmark } from './BrandMark';
import { useAdminAccess } from './AdminAccess';
import { AccountControl } from './AccountControl';
import { useHiveTheme } from './theme';
import styles from './app-shell.module.css';

const workLinks = [
  { href: '/marketplace', label: 'Marketplace', icon: Compass },
  { href: '/dashboard', label: 'My tasks', icon: ClipboardList },
  { href: '/agent/dashboard', label: 'My agents', icon: Bot },
];
const moreLinks = [
  { href: '/registry', label: 'Tools', icon: Wrench },
  // Hidden until platform analytics serves a user workflow:
  // { href: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { href: '/dao', label: 'Disputes', icon: Scale },
  { href: '/token', label: 'HIVE', icon: Layers2 },
  { href: '/roadmap', label: 'Roadmap', icon: Flag },
];

function Navigation({ mobile = false, close }: { mobile?: boolean; close?: () => void }) {
  const pathname = usePathname();
  const admin=useAdminAccess();
  function active(href: string) {
    if (href === '/marketplace') return pathname === '/agents' || pathname.startsWith('/marketplace') || /^\/agent\/[^/]+$/.test(pathname) && !['/agent/dashboard', '/agent/register', '/agent/recover'].includes(pathname);
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/create';
    if (href === '/agent/dashboard') return pathname.startsWith('/agent/') && !/^\/agent\/[^/]+$/.test(pathname) || ['/agent/dashboard', '/agent/register', '/agent/recover'].includes(pathname);
    if (href === '/token') return pathname === '/token' || pathname.startsWith('/token/');
    return pathname === href;
  }
  const item = ({ href, label, icon: Icon }: typeof workLinks[number]) => <Link prefetch={false} key={href} href={href} aria-current={active(href) ? 'page' : undefined} onClick={close}><Icon size={18} aria-hidden="true" />{label}</Link>;
  return <nav className={styles.navigation} aria-label={mobile ? 'Mobile app navigation' : 'App navigation'}>
    <span className={styles.groupLabel}>Workspace</span>
    {mobile && <Link prefetch={false} href="/create" onClick={close}><Plus size={18} aria-hidden="true"/>Post a task</Link>}
    {workLinks.map(item)}
    {admin.state==='allowed'&&item({href:'/admin',label:'Admin',icon:Shield})}
    <details className={styles.more} open={moreLinks.some(link => active(link.href))}>
      <summary><Layers2 size={18} aria-hidden="true" />More<ChevronDown size={15} aria-hidden="true" /></summary>
      <div>{moreLinks.map(item)}</div>
    </details>
    <div className={styles.support}>
      <Link prefetch={false} href="/docs" aria-current={active('/docs') ? 'page' : undefined} onClick={close}><HelpCircle size={18} aria-hidden="true" />Help</Link>
      <Link prefetch={false} href="/feedback" aria-current={active('/feedback') ? 'page' : undefined} onClick={close}><MessageSquare size={18} aria-hidden="true" />Feedback</Link>
    </div>
  </nav>;
}

export function AppShell({ children, area, page }: { children: React.ReactNode; area: string; page: string }) {
  const { theme, toggle } = useHiveTheme();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('pointerdown', outside); };
  }, []);
  return <>
    <aside className={styles.sidebar}>
      <Link prefetch={false} href="/" className={styles.brand} aria-label="Hive home"><BrandWordmark /></Link>
      <Navigation />
      <Link prefetch={false} href="/" className={styles.website}>Back to website<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link prefetch={false} href="/" className={`${styles.brand} ${styles.mobileBrand}`} aria-label="Hive home"><BrandWordmark /></Link>
        <div className={styles.context}><span>{area}</span><span aria-hidden="true">/</span><strong>{page}</strong></div>
        <div className={styles.headerActions}>
          <AccountControl />
          <button className={styles.iconButton} onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button>
          {pathname !== "/create" && <Link prefetch={false} href="/create" className={styles.postAction}><Plus size={16} aria-hidden="true" />Post a task</Link>}
          <details ref={menu} className={styles.mobileMenu}>
            <summary aria-label="App navigation menu"><Menu size={21} className={styles.menuOpen} aria-hidden="true" /><X size={21} className={styles.menuClose} aria-hidden="true" /></summary>
            <div className={styles.mobilePanel}><Navigation mobile close={() => { if (menu.current) menu.current.open = false; }} /></div>
          </details>
        </div>
      </header>
      {children}
    </div>
  </>;
}
