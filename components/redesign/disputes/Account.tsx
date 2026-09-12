"use client";
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { object, readReceipt, type Receipt } from './model';
import { useRead, type Request } from './useRead';
import { ReadState } from './controls';
import { TaskDialog } from '../task/TaskDialog';
import styles from './disputes.module.css';
export type Access = { account: string; request: Request; pending: Receipt | null; remember: (r: Receipt) => void; clear: () => void; active: () => boolean; refresh: () => void };
const AccessContext = createContext<Access | null>(null);
export const useAccess = () => useContext(AccessContext);
const parseIdentity = (v: unknown) => { const d = object(v); if (typeof d.accountId !== 'string' || !d.accountId) throw Error('Account not available.'); return d.accountId as string; };
function AccountSession({ account, request, children, refresh }: { account: string; request: Request; children: React.ReactNode; refresh: () => void }) {
  const storageKey = 'hive-dispute-request:' + account;
  const [pending, setPending] = useState<Receipt | null>(null), [ready, setReady] = useState(false), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false), [release, setRelease] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; try { setPending(readReceipt(JSON.parse(localStorage.getItem(storageKey) || 'null'))); } catch { /* Writes require working storage below. */ } setReady(true); return () => { mounted.current = false; }; }, [storageKey]);
  function remember(r: Receipt) { localStorage.setItem(storageKey, JSON.stringify(r)); setPending(r); setNotice(''); setMissing(false); }
  function clear() { try { localStorage.removeItem(storageKey); } catch { /* A saved receipt can be checked again after reload. */ } if (mounted.current) setPending(null); }
  async function check() {
    if (!pending || busy) return; setBusy(true); setNotice('');
    try {
      const url = pending.kind === 'report' ? '/api/dispute-reports?requestId=' + pending.id : pending.kind === 'evidence' ? `/api/disputes/${pending.caseId}/evidence?requestId=${pending.id}` : `/api/disputes/${pending.caseId}/voter?address=${encodeURIComponent(pending.address || '')}`;
      const res = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!res.ok) throw Error('The saved result could not be checked. Try again.');
      const d = object(await res.json());
      if (!mounted.current) return;
      const found = pending.kind === 'report' ? object(d.report).id === pending.id : pending.kind === 'evidence' ? object(d.item).id === pending.id : d.disputeId === pending.caseId && object(d.vote).address === pending.address && object(d.vote).choice === pending.choice;
      if (found) { clear(); setNotice(pending.kind === 'vote' ? 'Your vote is recorded.' : pending.kind === 'report' ? 'Your report is recorded.' : 'Your evidence is recorded.'); refresh(); }
      else { setMissing(true); setNotice('No matching result is recorded yet. Check again before making another submission.'); }
    } catch (e) { if (mounted.current) setNotice(e instanceof Error ? e.message : 'The result could not be checked.'); } finally { if (mounted.current) setBusy(false); }
  }
  return <AccessContext.Provider value={ready ? { account, request, pending, remember, clear, active: () => mounted.current, refresh } : null}>
    {pending && <section className={styles.pending} aria-label="Unconfirmed submission"><h2>Check your last submission</h2><p>The {pending.kind === 'vote' ? 'vote' : pending.kind} result needs confirmation. Another submission is paused.</p><p className={styles.hint}>Reference: <code>{pending.id}</code></p><button className={styles.secondary} disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Check saved result'}</button>{missing && <button className={styles.secondary} disabled={busy} onClick={() => setRelease(true)}>Clear pending reference</button>}</section>}
    {release && pending && <TaskDialog title="Clear pending reference?" close={() => setRelease(false)}><div className={styles.form}><p>The original request may still complete. Keep this reference so you can check it later.</p><p className={styles.reason}><code>{pending.id}</code></p><p>Clearing this notice does not cancel or delete a submission.</p><div className={styles.actions}><button className={styles.secondary} onClick={() => setRelease(false)}>Keep checking</button><button className={styles.primary} onClick={() => { clear(); setRelease(false); setMissing(false); setNotice('Pending reference cleared. The original request may still complete.'); refresh(); }}>Clear reference</button></div></div></TaskDialog>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}{children}
  </AccessContext.Provider>;
}
export function AccountBoundary({ children, refresh }: { children: React.ReactNode; refresh: () => void }) {
  const { user, ready, login } = useAuth(), request = useAuthFetch();
  return <Identity key={(user?.id || '') + ':' + (user?.wallet?.address || '')} ready={ready} request={request} login={login} refresh={refresh}>{children}</Identity>;
}
function Identity({ ready, request, login, children, refresh }: { ready: boolean; request: Request; login: () => void; children: React.ReactNode; refresh: () => void }) {
  const [revision, setRevision] = useState(0); const r = useRead(ready ? '/api/dispute-reports?access=1' : null, revision, parseIdentity, request);
  return r.data ? <AccountSession key={r.data} account={r.data} request={request} refresh={refresh}>{children}</AccountSession> : <AccessContext.Provider value={null}>{r.error && r.status !== 401 && <ReadState error="Account access could not be checked. Public cases are still available." retry={() => setRevision(v => v + 1)} />}<div className={styles.accountBar}><span>{!ready || r.loading ? 'Checking account…' : 'Sign in to report a problem or vote.'}</span><button className={styles.secondary} disabled={!ready} onClick={login}>Sign in</button></div>{children}</AccessContext.Provider>;
}
