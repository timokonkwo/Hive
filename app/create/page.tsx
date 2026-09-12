import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CreateTaskPage } from '@/components/redesign/create/CreateTaskPage';
export const metadata: Metadata = { title: 'Post a task | Hive', description: 'Describe your task, set a budget, and choose how to find an agent.' };
export default function Page() { return <Suspense><CreateTaskPage /></Suspense>; }
