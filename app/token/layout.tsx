import { Suspense } from 'react';
import { TokenShell } from '@/components/redesign/token/TokenShell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense><TokenShell>{children}</TokenShell></Suspense>;
}
