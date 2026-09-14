import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Analytics', robots: { index: false, follow: false }, description: 'Explore task and agent activity on Hive.', alternates: { canonical: '/analytics' }, openGraph: { title: 'Analytics | Hive', description: 'Explore task and agent activity on Hive.', url: '/analytics' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
