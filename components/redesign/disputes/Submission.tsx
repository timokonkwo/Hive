"use client";
import { Select } from '@/components/redesign/Select';
import { useEffect, useRef, useState } from 'react';
import { TaskDialog } from '../task/TaskDialog';
import { write, WriteError } from '../tools/model';
import { useAccess } from './Account';
import { blankReport, evidencePayload, reportPayload, reportCategories, newRequestId, object } from './model';
import { EvidenceLink } from './controls';
import styles from './disputes.module.css';
export function Submission({ caseId, close, done }: { caseId?: string; close: () => void; done: () => void }) {
  const access = useAccess(), lock = useRef(false);
  const [draft, setDraft] = useState(blankReport), [uri, setUri] = useState(''), [summary, setSummary] = useState(''), [review, setReview] = useState<Record<string, string> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false);
  const dirty = !!(uri || summary || Object.entries(draft).some(([k, v]) => v !== blankReport[k as keyof typeof blankReport]));
  useEffect(() => { if (!dirty && !busy) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', guard); return () => removeEventListener('beforeunload', guard); }, [dirty, busy]);
  function dismiss() { if (busy) return; if (dirty) setDiscard(true); else close(); }
  async function submit() {
    if (!access || !review || lock.current || access.pending) return;
    lock.current = true; setBusy(true); setError(''); let sent = false;
    const id = newRequestId();
    try {
      access.remember({ id, kind: caseId ? 'evidence' : 'report', ...(caseId ? { caseId } : {}) });
      if (!access.active()) return;
      sent = true;
      const d = await write(access.request, caseId ? `/api/disputes/${caseId}/evidence` : '/api/dispute-reports', { ...review, requestId: id });
      if (!access.active()) return;
      if (d.success !== true || object(caseId ? d.evidence : d.report).id !== id) throw Error('The saved result could not be confirmed.');
      access.clear(); done(); close();
    } catch (e) {
      if (!access.active()) return;
      if (sent && (!(e instanceof WriteError) || e.status >= 500 || e.status === 409)) { close(); return; }
      access.clear(); setError(!sent ? 'This browser could not save a request reference. Enable site storage before submitting.' : e instanceof Error ? e.message : 'Submission failed. Your input is still here.');
    } finally { lock.current = false; if (access.active()) setBusy(false); }
  }
  const field = (key: keyof typeof blankReport, name: string, options: { max?: number; multiline?: boolean; optional?: boolean } = {}) => <label className={styles.field}>{name}{options.optional && <span>Optional</span>}{options.multiline ? <textarea value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} rows={5} maxLength={options.max} required /> : <input value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} maxLength={options.max} required={!options.optional} autoComplete="off" spellCheck={false} />}</label>;
  return <TaskDialog title={discard ? 'Discard this draft?' : review ? caseId ? 'Review evidence' : 'Review report' : caseId ? 'Add evidence' : 'Report a problem'} busy={busy} close={dismiss}>
    <div className={styles.form}>
      {discard ? <><p>Your unsent input will be removed.</p><div className={styles.actions}><button className={styles.secondary} onClick={() => setDiscard(false)}>Keep editing</button><button className={styles.primary} onClick={close}>Discard draft</button></div></> : review ? <>
        <p>{caseId ? 'This evidence and summary will be public.' : 'Your report will be reviewed. A public case may be opened with your report and evidence.'}</p>
        <dl className={styles.review}>{Object.entries(review).filter(([k, v]) => v && !['evidenceUri', 'uri'].includes(k)).map(([k, v]) => <div key={k}><dt>{({ providerAddress: 'Provider · Solana', toolId: 'Tool', category: 'Category', reason: 'Problem', summary: 'Summary', sessionLedgerId: 'Usage reference' } as Record<string, string>)[k]}</dt><dd>{k === 'category' ? reportCategories[v as keyof typeof reportCategories] : v}</dd></div>)}</dl>
        <EvidenceLink uri={review.evidenceUri || review.uri} /><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setReview(null)}>Edit</button><button className={styles.primary} disabled={busy || !!access?.pending} onClick={submit}>{busy ? 'Submitting…' : caseId ? 'Submit evidence' : 'Submit report'}</button></div>
      </> : <form onSubmit={e => { e.preventDefault(); setError(''); try { setReview(caseId ? evidencePayload(uri, summary) : reportPayload(draft)); } catch (err) { setError(err instanceof Error ? err.message : 'Check your input.'); } }}>
        <p className={styles.hint}>{caseId ? 'Add a link and explain what it shows. Evidence is public.' : 'Report a problem with a registered tool. Reports are reviewed before a case is opened.'}</p>
        {caseId ? <><label className={styles.field}>Evidence link<input value={uri} onChange={e => setUri(e.target.value)} maxLength={500} required autoComplete="off" placeholder="https://…" /></label><label className={styles.field}>Summary<textarea value={summary} onChange={e => setSummary(e.target.value)} rows={5} minLength={10} maxLength={1000} required /></label></> : <>
          {field('providerAddress', 'Provider Solana address', { max: 44 })}{field('toolId', 'Tool name', { max: 80 })}<label className={styles.field}>Category<Select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}>{Object.entries(reportCategories).map(([v, name]) => <option key={v} value={v}>{name}</option>)}</Select></label>{field('reason', 'What went wrong?', { max: 2000, multiline: true })}{field('evidenceUri', 'Evidence link', { max: 500 })}{field('sessionLedgerId', 'Usage reference', { max: 24, optional: true })}
        </>}
        <p className={styles.hint}>Use an HTTPS, IPFS or Arweave link. Do not include passwords, API keys or private wallet details.</p><button className={styles.primary} type="submit">Review {caseId ? 'evidence' : 'report'}</button>
      </form>}{error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </TaskDialog>;
}
