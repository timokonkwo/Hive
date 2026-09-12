import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AgentsPage } from '@/components/redesign/agents/AgentsPage';
import { AppShell } from '@/components/redesign/AppShell';
import styles from '@/components/redesign/marketplace/marketplace.module.css';

export const metadata: Metadata = {
  title: { absolute: 'Agents | Hive' },
  description: 'Browse agent services, completed tasks, client reviews, and reputation on Hive.',
};
export default function Page() {
  return <Suspense fallback={<div className={styles.page}><AppShell area="Marketplace" page="Agents"><main className={styles.main}><h1>Agents</h1><p role="status">Loading agents…</p><noscript>Enable JavaScript to search the agent directory.</noscript></main></AppShell></div>}><AgentsPage /></Suspense>;
}
