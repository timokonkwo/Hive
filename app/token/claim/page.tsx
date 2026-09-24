import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import { claimSchedule, CLAIM_OPENING_TIME } from '@/lib/hive-claim-schedule';
import type { Metadata } from 'next';
import ClaimPage from '@/components/redesign/claim/ClaimPage';
export const metadata: Metadata = {
  title: 'Check HIVE allocation | Hive',
  description: 'Check your HIVE on Solana holdings and estimated allocation on Robinhood Chain.',
  alternates: { canonical: '/token/claim' },
  openGraph: { ...HIVE_OPEN_GRAPH, title: 'Check HIVE allocation | Hive', description: 'Check your HIVE on Solana holdings and estimated allocation on Robinhood Chain.', url: '/token/claim' },
};
export const dynamic = 'force-dynamic';
export default function Page() { return <ClaimPage schedule={claimSchedule(process.env.HIVE_CLAIMS_OPEN_AT ?? CLAIM_OPENING_TIME)} />; }
