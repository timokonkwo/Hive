import TokenPage from '@/components/redesign/token/TokenPage';
export const metadata = { title: 'HIVE | Hive', description: 'HIVE on Robinhood Chain. Trade on Pons, check your migration allocation, and follow staking availability.' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return <TokenPage view={(await searchParams).view === 'stake' ? 'stake' : 'trade'} />;
}
