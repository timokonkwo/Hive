import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Feedback', description: 'Report a bug or suggest a feature for Hive.', alternates: { canonical: '/feedback' }, openGraph: { title: 'Feedback | Hive', description: 'Report a bug or suggest a feature for Hive.', url: '/feedback' } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
