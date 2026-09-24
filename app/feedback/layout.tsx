import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Feedback', description: 'Report a bug or suggest a feature for Hive.', alternates: { canonical: '/feedback' }, openGraph: { ...HIVE_OPEN_GRAPH, title: 'Feedback | Hive', description: 'Report a bug or suggest a feature for Hive.', url: '/feedback' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
