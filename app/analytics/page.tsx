import { Suspense } from 'react';
import type { Metadata } from 'next';
import AnalyticsPage from '@/components/redesign/analytics/AnalyticsPage';
export const metadata: Metadata = { title: 'Analytics | Hive', description: 'Task activity and recorded payments on Hive.' };
export default function Page() { return <Suspense><AnalyticsPage /></Suspense>; }
