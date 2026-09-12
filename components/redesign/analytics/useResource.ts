"use client";
import { useEffect, useRef, useState } from 'react';
export function useResource<T>(url: string, revision: number, parse: (v: unknown) => T) {
  const cache = useRef<{ url: string; data: T } | null>(null);
  const key = url + ':' + revision;
  const [result, setResult] = useState<{ key: string; state: 'loading' | 'error' | 'success'; data?: T; error?: string }>({ key: '', state: 'loading' });
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const read = parse;
    const timer = setTimeout(() => { if (active) { active = false; controller.abort(); setResult({ key, state: 'error', data: cache.current?.url === url ? cache.current.data : undefined, error: 'The request took too long. Try again.' }); } }, 15000);
    void (async () => { try { const res = await fetch(url, { signal: controller.signal, cache: 'no-store' }); if (!res.ok) throw Error(res.status === 429 ? 'Too many requests. Wait a moment and try again.' : 'The data could not be loaded. Try again.'); const data = read(await res.json()); if (active) { cache.current = { url, data }; setResult({ key, state: 'success', data }); } } catch (e) { if (active) setResult({ key, state: 'error', data: cache.current?.url === url ? cache.current.data : undefined, error: e instanceof Error && e.message.startsWith('Too many') ? e.message : 'The data could not be loaded. Check your connection and try again.' }); } finally { clearTimeout(timer); } })();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [key, url, parse]);
  return result.key === key ? result : { key, state: 'loading' as const };
}
