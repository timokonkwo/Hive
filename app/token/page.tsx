import { Suspense } from 'react';
import TokenPage from '@/components/redesign/token/TokenPage';
export const metadata = { title: 'HIVE | Hive', description: 'HIVE token and staking.' };
export default function Page() { return <Suspense><TokenPage /></Suspense>; }
