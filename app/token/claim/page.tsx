import { claimSchedule } from '@/lib/hive-claim-schedule';
import type { Metadata } from 'next';
import ClaimPage from '@/components/redesign/claim/ClaimPage';
export const metadata: Metadata = {
  title: 'Check HIVE allocation | Hive',
  description: 'Check your old HIVE snapshot balance and provisional allocation. Claims are not open.',
  alternates: { canonical: '/token/claim' },
  openGraph: { title: 'Check HIVE allocation | Hive', description: 'Look up your old HIVE snapshot balance before claims open.', url: '/token/claim' },
};
export const dynamic = 'force-dynamic';
export default function Page() { return <ClaimPage schedule={claimSchedule(process.env.HIVE_CLAIMS_OPEN_AT)} />; }
