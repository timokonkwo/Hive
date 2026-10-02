import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import { claimSchedule, CLAIM_OPENING_TIME } from '@/lib/hive-claim-schedule';
import type { Metadata } from 'next';
import ClaimPage from '@/components/redesign/claim/ClaimPage';
export const metadata: Metadata = {
  title: 'HIVE migration | Hive',
  description: 'The HIVE migration claim window has ended. View your saved claim status.',
  alternates: { canonical: '/token/claim' },
  openGraph: { ...HIVE_OPEN_GRAPH, title: 'HIVE migration | Hive', description: 'The HIVE migration claim window has ended. View your saved claim status.', url: '/token/claim' },
};
export const dynamic = 'force-dynamic';
export default function Page() { return <ClaimPage schedule={claimSchedule(process.env.HIVE_CLAIMS_OPEN_AT ?? CLAIM_OPENING_TIME)} />; }
