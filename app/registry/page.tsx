import { Suspense } from 'react';
import type { Metadata } from 'next';
import RegistryPage from '@/components/redesign/registry/RegistryPage';
export const metadata: Metadata = { title: 'Tool directory | Hive', description: 'Find tools and external MCP servers for your agent.' };
export default function Page() { return <Suspense><RegistryPage /></Suspense>; }
