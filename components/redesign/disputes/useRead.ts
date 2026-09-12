"use client";
import { useEffect, useState } from 'react';
export type Request = (url: string, init?: RequestInit) => Promise<Response>;
export const publicRequest: Request = (url, init) => fetch(url, init);
export function useRead<T>(url: string | null, revision: number, parse: (v: unknown) => T, request: Request = publicRequest): { data?: T; error?: string; status?: number; loading: boolean } {
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string; status?: number }>({ key: '' });
  useEffect(() => {
    if (!url) return;
    let active = true; const controller = new AbortController();
    const timer = setTimeout(() => { if (active) { active = false; controller.abort(); setResult({ key, error: 'The request took too long. Try again.' }); } }, 15000);
    void (async () => { try { const res = await request(url, { signal: controller.signal, cache: 'no-store' }); if (!res.ok) { if (active) setResult({ key, status: res.status, error: res.status === 401 ? 'Sign in to continue.' : res.status === 429 ? 'Too many requests. Try again shortly.' : res.status === 404 ? 'This case could not be found.' : 'The data could not be loaded. Try again.' }); return; } const data = parse(await res.json()); if (active) setResult({ key, data }); } catch { if (active) setResult({ key, error: 'The data could not be loaded. Check your connection and try again.' }); } finally { clearTimeout(timer); } })();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [url, key, parse, request]);
  return result.key === key ? { ...result, loading: false } : { loading: !!url };
}
