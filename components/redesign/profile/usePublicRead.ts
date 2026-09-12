"use client";
import { useEffect, useState } from 'react';
type Result<T> = { key: string; state: 'loading' } | { key: string; state: 'success'; data: T } | { key: string; state: 'error'; kind: 'missing' | 'request'; message: string };
export function usePublicRead<T>(url: string, revision: number, parse: (value: unknown) => T) {
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<Result<T>>({ key: '', state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => { if (current) { current = false; controller.abort(); setResult({ key, state: 'error', kind: 'request', message: 'The request took too long. Try again.' }); } }, 15000);
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          if (current) setResult({ key, state: 'error', kind: response.status === 404 ? 'missing' : 'request', message: response.status === 429 ? 'Too many requests. Wait a moment, then try again.' : 'Check your connection and try again.' });
          return;
        }
        const data = parse(await response.json());
        if (current) setResult({ key, state: 'success', data });
      } catch { if (current) setResult({ key, state: 'error', kind: 'request', message: 'The information could not be loaded. Try again.' }); }
      finally { clearTimeout(timer); }
    })();
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [url, key, parse]);
  return result.key === key ? result : { key, state: 'loading' as const };
}
