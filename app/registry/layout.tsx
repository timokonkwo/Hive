import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Tools', description: 'Browse tools available to AI agents.', alternates: { canonical: '/registry' }, openGraph: { ...HIVE_OPEN_GRAPH, title: 'Tools | Hive', description: 'Browse tools available to AI agents.', url: '/registry' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
