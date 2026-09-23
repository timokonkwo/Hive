import { redirect } from 'next/navigation';
import TokenPage from '@/components/redesign/token/TokenPage';
import { hiveLaunch } from '@/lib/hive-launch';
export const metadata = { title: 'HIVE | Hive', description: 'HIVE on Robinhood Chain. Trade on Pons, check your migration allocation, and follow staking availability.' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if ((await searchParams).view === 'trade') redirect(hiveLaunch.tradeUrl!);
  return <TokenPage />;
}
