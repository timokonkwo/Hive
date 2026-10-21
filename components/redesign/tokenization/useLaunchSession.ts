"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaunchRole } from '@/lib/agent-tokenization/types';
import type { Request } from '../task/useResource';
import { readSessionResult, type SessionDetails } from './session-model';

export function useLaunchSession(agentId: string, role: LaunchRole, request: Request) {
  const [details, setDetails] = useState<SessionDetails | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsCheck, setNeedsCheck] = useState(false);
  const alive = useRef(true), lock = useRef(false), saved = useRef<SessionDetails | null>(null);
  const apply = useCallback((next: SessionDetails) => { saved.current = next; if (alive.current) setDetails(next); }, []);
  const api = useCallback(async (body?: Record<string, unknown>) => {
    const response = await request(`/api/agents/${agentId}/tokenization/session?role=${role}`, { cache: 'no-store', signal: AbortSignal.timeout(body ? 55000 : 20000),
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw Error(typeof data.error === 'string' ? data.error : 'Launch status is unavailable. Try again.');
    return data;
  }, [agentId, role, request]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api();
      if (data.preview?.agentId !== agentId || !Array.isArray(data.options) || !data.wallets || !Array.isArray(data.tokens)) throw Error('Token details are unavailable.');
      if (data.session) Object.assign(data, readSessionResult(data, agentId));
      apply(data);
      if (alive.current) setNeedsCheck(false);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Token details are unavailable.'); }
    finally { if (alive.current) setLoading(false); }
  }, [api, agentId, apply]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);
  const action = useCallback(async (body: Record<string, unknown>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const data = await api({ id: saved.current?.session?.id, ...body });
      const result = readSessionResult(data, agentId);
      if (saved.current) apply({ ...saved.current, ...result });
      if (alive.current) setNeedsCheck(false);
      return result;
    } catch (e) { if (alive.current) {
      // A lost response is not proof that a transaction or reservation failed.
      setNeedsCheck(true);
      setError(e instanceof Error ? e.message : 'The action could not finish. Check its status.');
    } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [api, agentId, apply]);
  // Polling only reconciles saved receipts. It never signs, starts the next target or allocates another mint.
  useEffect(() => {
    const session = details?.session;
    if (!session || details.readOnly || !session.targets.some(t => ['submitted', 'confirming'].includes(t.phase))) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => { if (!document.hidden && !lock.current) await action({ action: 'check' }); if (!stopped) timer = setTimeout(poll, 7000); };
    timer = setTimeout(poll, 7000); return () => { stopped = true; clearTimeout(timer); };
  }, [details?.session, details?.readOnly, action]);
  return { details, error, setError, busy, loading, needsCheck, load, action };
}
