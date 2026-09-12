import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyPage } from '@/components/redesign/verify/VerifyPage';
export const metadata: Metadata = { title: 'Verify ownership | Hive', referrer: 'no-referrer', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><VerifyPage key={id} id={id} /></Suspense>;
}
