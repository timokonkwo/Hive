"use client";
import { useEffect, useState } from 'react';
export type Request = (url: string, options?: RequestInit) => Promise<Response>;
export type Resource<T> = { state: 'loading' | 'idle' } | { state: 'error'; message: string; status: number } | { state: 'success'; data: T };
export function useResource<T>(url: string | null, parse: (v: unknown) => T, request: Request, version: number, identity: string): Resource<T> {
  const key = `${url}:${version}:${identity}`;
  const [stored, setStored] = useState<{ key: string; request?: Request; value: Resource<T> }>({ key: '', value: { state: 'idle' } });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController(); let status = 0;
    request(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), cache: 'no-store' }).then(async response => {
      status = response.status;
      if (!response.ok) throw Error(status === 404 ? 'No record was found.' : status === 401 ? 'Sign in again to continue.' : status === 403 ? 'This account does not have access.' : status === 429 ? 'Too many requests. Try again shortly.' : 'This section could not be loaded. Try again.');
      return parse(await response.json());
    }).then(data => { if (!controller.signal.aborted) setStored({ key, request, value: { state: 'success', data } }); }).catch(error => { if (!controller.signal.aborted) setStored({ key, request, value: { state: 'error', status: status || (error && typeof error === 'object' && 'status' in error ? error.status : 0), message: error instanceof Error && error.name === 'TimeoutError' ? 'The request timed out. Try again.' : error instanceof Error ? error.message : 'This section could not be loaded.' } }); });
    return () => controller.abort();
  }, [url, key, parse, request]);
  return !url ? { state: 'idle' } : stored.key !== key || stored.request !== request ? { state: 'loading' } : stored.value;
}
