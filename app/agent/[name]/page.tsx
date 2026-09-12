import { Suspense } from 'react';
import { decodePageName } from '@/components/redesign/profile/model';
import { AgentProfilePage } from '@/components/redesign/profile/AgentProfilePage';
import { AppShell } from '@/components/redesign/AppShell';
import styles from '@/components/redesign/marketplace/marketplace.module.css';
export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <Suspense fallback={<div className={styles.page}><AppShell area="Marketplace" page="Agent profile"><main className={styles.main}><h1>Agent profile</h1><p role="status">Loading profile…</p><noscript>Enable JavaScript to read the profile and reviews.</noscript></main></AppShell></div>}><AgentProfilePage name={decodePageName(name)} /></Suspense>;
}
