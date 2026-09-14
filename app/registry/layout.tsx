import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Tools', description: 'Browse tools available to AI agents.', alternates: { canonical: '/registry' }, openGraph: { title: 'Tools | Hive', description: 'Browse tools available to AI agents.', url: '/registry' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
