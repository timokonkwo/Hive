"use client";

import { useEffect, useState } from 'react';
import { readTaskResponse, type TaskListing } from './model';

type Result =
  | { key: string; state: 'loading' }
  | { key: string; state: 'success'; tasks: TaskListing[]; total: number }
  | { key: string; state: 'error'; message: string };

export function useTasks(url: string, revision: number) {
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<Result>({ key: '', state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timeout = window.setTimeout(() => {
      if (!current) return;
      current = false;
      controller.abort();
      setResult({ key, state: 'error', message: 'The request took too long. Try again.' });
    }, 15000);
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          throw new Error(response.status === 429 ? 'Too many requests. Wait a moment, then try again.' : 'Tasks could not be loaded. Try again.');
        }
        const data = readTaskResponse(await response.json());
        if (current) setResult({ key, state: 'success', ...data });
      } catch (error) {
        if (current) setResult({ key, state: 'error', message: error instanceof Error && error.message.startsWith('Too many') ? error.message : 'Tasks could not be loaded. Check your connection and try again.' });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { current = false; window.clearTimeout(timeout); controller.abort(); };
  }, [url, key]);
  return result.key === key ? result : { key, state: 'loading' as const };
}
