import { redirect } from 'next/navigation';
export default async function TokenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams, query = new URLSearchParams();
  if (p.network === 'solana') query.set('network', 'solana');
  if (p.view === 'stake') query.set('view', 'stake'); else query.set('view', 'trade');
  redirect('/stake?' + query.toString());
}
