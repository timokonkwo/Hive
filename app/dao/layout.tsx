import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Disputes', description: 'Review reported issues and disputed work on Hive.', alternates: { canonical: '/dao' }, openGraph: { title: 'Disputes | Hive', description: 'Review reported issues and disputed work on Hive.', url: '/dao' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
