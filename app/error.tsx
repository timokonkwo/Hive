"use client";
import { RouteRecovery } from '@/components/redesign/RouteRecovery';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteRecovery retry={reset} />; }
