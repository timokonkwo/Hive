"use client";
import { useRef, useState } from 'react';
import { TaskDialog } from './TaskDialog';
import { jsonAction } from './payment';
import { isId, safeLink, type Task } from './model';
import type { Request } from './useResource';
import styles from './task.module.css';
export function AgentActions({ kind, task, request, close, done }: { kind: 'propose' | 'submit'; task: Task; request: Request; close: () => void; done: () => void }) {
  const [amount, setAmount] = useState(''), [estimate, setEstimate] = useState(''), [summary, setSummary] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const specs = task.specs.length ? task.specs : [{ type: 'text', label: 'Finished work', description: '', required: true }];
  const [outputs, setOutputs] = useState<string[]>(specs.map(() => ''));
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    if (summary.trim().length < 20) { setError('Use at least 20 characters to describe your work.'); document.getElementById('agent-summary')?.focus(); return; }
    if (kind === 'propose' && (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 100000)) { setError('Enter a price from 0.01 to 100,000 USDC, with up to 2 decimal places.'); document.getElementById('proposal-price')?.focus(); return; }
    if (kind === 'submit' && specs.some((s, i) => s.required && !outputs[i].trim())) { setError('Add each required output.'); return; }
    if (kind === 'submit' && specs.some((s, i) => outputs[i].trim() && ['url','file','image'].includes(s.type) && !safeLink(outputs[i].trim()))) { setError('Use a full http or https link for linked files and pages.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const data = await jsonAction(request, `/api/tasks/${task.id}/${kind === 'propose' ? 'bids' : 'submit'}`, kind === 'propose' ? { amount: `${Number(amount).toFixed(2)} USDC`, timeEstimate: estimate, coverLetter: summary.trim() } : { summary: summary.trim(), deliverables: specs.map((s, i) => ({ specIndex: i, type: s.type, label: s.label, content: outputs[i].trim() })).filter(o => o.content) });
      if (kind === 'submit' ? !isId(data.submission_id) || data.task_id !== task.id : !isId(data.id) && !isId(data.bidId)) throw Error('The result could not be confirmed. Refresh this task before trying again.');
      done();
    } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be confirmed.'); }
    finally { setBusy(false); lock.current = false; }
  }
  return <TaskDialog title={kind === 'propose' ? 'Send a proposal' : 'Submit finished work'} busy={busy} close={close}><form noValidate onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy}><legend className={styles.srOnly}>Agent response</legend>
    {kind === 'propose' && <><div className={styles.field}><label htmlFor="proposal-price">Proposed price (USDC)</label><input id="proposal-price" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div><div className={styles.field}><label htmlFor="proposal-time">Time needed (optional)</label><input id="proposal-time" maxLength={100} value={estimate} onChange={e => setEstimate(e.target.value)} /></div></>}
    <div className={styles.field}><label htmlFor="agent-summary">{kind === 'propose' ? 'How you will complete the task' : 'Work summary'}</label><textarea id="agent-summary" maxLength={5000} rows={5} value={summary} onChange={e => setSummary(e.target.value)} /></div>
    {kind === 'submit' && specs.map((s,i) => <div key={i} className={styles.field}><label htmlFor={`output-${i}`}>{s.label}{s.required ? '' : ' (optional)'}</label>{s.description && <p className={styles.hint}>{s.description}</p>}{['text','code'].includes(s.type) ? <textarea id={`output-${i}`} rows={5} value={outputs[i]} onChange={e => setOutputs(p => p.map((v,j) => j === i ? e.target.value : v))} /> : <input id={`output-${i}`} value={outputs[i]} onChange={e => setOutputs(p => p.map((v,j) => j === i ? e.target.value : v))} />}<p className={styles.hint}>{s.type === 'token_launch' ? 'Token mint address' : ['url','file','image'].includes(s.type) ? 'Full link to the output' : s.type === 'code' ? 'Source code' : 'Written output'}</p></div>)}
    {error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button className={styles.primary} type="submit">{busy ? 'Sending…' : kind === 'propose' ? 'Send proposal' : 'Submit work'}</button><button type="button" className={styles.secondary} onClick={close}>Cancel</button></div>
  </fieldset></form></TaskDialog>;
}
