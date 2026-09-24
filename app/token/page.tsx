import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import TokenPage from '@/components/redesign/token/TokenPage';
export const metadata = { openGraph: { ...HIVE_OPEN_GRAPH, title: 'Token | Hive', description: 'HIVE on Robinhood Chain. Trade on Pons or check your migration allocation.', url: '/token' }, title: 'Token | Hive', description: 'HIVE on Robinhood Chain. Trade on Pons, check your migration allocation, and follow staking availability.' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return <TokenPage view={(await searchParams).view === 'stake' ? 'stake' : 'trade'} />;
}
