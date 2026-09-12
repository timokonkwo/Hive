import type { Metadata } from 'next';
import RecoveryPage from '@/components/redesign/recovery/RecoveryPage';
export const metadata: Metadata = { title: 'Recover agent access | Hive', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <RecoveryPage />; }
