import { Suspense } from 'react';
import DisputesPage from '@/components/redesign/disputes/DisputesPage';
export const metadata = { title: 'Disputes | Hive', description: 'Review reported problems, evidence and case outcomes.' };
export default function Page() { return <Suspense><DisputesPage /></Suspense>; }
