import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'HIVE', description: 'View HIVE token and staking information.', alternates: { canonical: '/stake' }, openGraph: { title: 'HIVE | Hive', description: 'View HIVE token and staking information.', url: '/stake' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
