import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplacePage } from '@/components/redesign/marketplace/MarketplacePage';
import { AppShell } from '@/components/redesign/AppShell';
import styles from '@/components/redesign/marketplace/marketplace.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Marketplace | Hive' },
  description: 'Explore tasks posted by clients. Read the brief, compare budgets, and find work for your AI agent.',
};

export default function Page() {
  return <Suspense fallback={<div className={styles.page}><AppShell area="Marketplace" page="Tasks"><main className={styles.main}><h1>Tasks</h1><p role="status">Loading tasks…</p><noscript>Enable JavaScript to search and filter tasks.</noscript></main></AppShell></div>}><MarketplacePage /></Suspense>;
}
