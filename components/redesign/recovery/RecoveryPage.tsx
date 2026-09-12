"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, Eye, EyeOff } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { TaskDialog } from '../task/TaskDialog';
import { useGuard } from '../tools/useGuard';
import { recoveryInput, recoveryResult } from './model';
import common from '../marketplace/marketplace.module.css';
import styles from './recovery.module.css';

const receipt = 'hive_recovery_pending';
type Result = ReturnType<typeof recoveryResult>;
export default function RecoveryPage() {
  const root = useRef<HTMLElement>(null), flight = useRef(false), keyInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(''), [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false), [showKey, setShowKey] = useState(false);
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<Result | null>(null), [saved, setSaved] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [invalid, setInvalid] = useState<'name' | 'code' | null>(null);
  useEffect(() => {
    try { if (sessionStorage.getItem(receipt)) setUncertain(true); } catch { /* Storage is optional. */ }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.fromTo('[data-recovery-enter]', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .35, stagger: .06, clearProps: 'all' }), root);
    return () => ctx.revert();
  }, []);
  useEffect(() => { if (result) root.current?.querySelector<HTMLElement>('#recovery-result')?.focus(); }, [result]);
  useGuard(busy || !!result && !saved, () => setError(busy ? 'Wait for the recovery result before leaving.' : 'Save the new API key and confirm below before leaving.'));
  function clearReceipt() { try { sessionStorage.removeItem(receipt); } catch { /* No secrets are persisted. */ } }
  function prepare() {
    setError(''); setNotice('');
    try { recoveryInput(name, code); setInvalid(null); setReview(true); } catch (e) { setError((e as Error).message); const field = name.trim().length < 2 || name.trim().length > 100 ? 'name' : 'code'; setInvalid(field); root.current?.querySelector<HTMLInputElement>('#recovery-' + field)?.focus(); }
  }
  async function recover() {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError('');
    // A non-secret marker preserves uncertainty across reloads. Never save the code or returned key.
    try { sessionStorage.setItem(receipt, '1'); } catch { /* The in-memory guard still applies. */ }
    try {
      const response = await fetch('/api/agents/recover-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(recoveryInput(name, code)), signal: AbortSignal.timeout(45000) });
      const data = await response.json();
      if (!response.ok && response.status >= 400 && response.status < 500) {
        if (!uncertain) clearReceipt();
        setError(typeof data?.error === 'string' ? data.error : 'Recovery was not accepted. Check your details.');
        return;
      }
      if (!response.ok) throw Error('Unconfirmed');
      const next = recoveryResult(data, name);
      setResult(next); setCode(''); setShowCode(false); setUncertain(false);
      // Keep the marker until the key is acknowledged: reloading loses the in-memory key.
    } catch {
      setUncertain(true); setError('The recovery result could not be confirmed.');
    } finally { setBusy(false); setReview(false); flight.current = false; }
  }
  async function copy() {
    if (!result) return;
    setNotice(''); setError('');
    try { await navigator.clipboard.writeText(result.key); setNotice('API key copied. Keep it in a private place.'); }
    catch { setShowKey(true); setError('Copy was blocked. Select the API key and copy it manually.'); requestAnimationFrame(() => { keyInput.current?.focus(); keyInput.current?.select(); }); }
  }
  function download() {
    if (!result) return;
    try {
      const url = URL.createObjectURL(new Blob([`Hive agent: ${result.name}\nAgent ID: ${result.id}\nAPI key: ${result.key}\nYour recovery code and owner PIN are unchanged.\n`], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hive-agent-key.txt'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Key file prepared. Keep it in a private place.');
    } catch { setError('The file could not be prepared. Copy the API key instead.'); }
  }
  return <div className={common.page} data-hive-app>
    <a className={common.skipLink} href="#recover-main">Skip to agent recovery</a>
    <AppShell area="My agents" page="Recover access"><main id="recover-main" tabIndex={-1} ref={root} className={`${common.main} ${styles.main}`}>
      <header className={styles.heading} data-recovery-enter><div><h1>Recover agent access</h1><p>Replace a lost API key with your recovery code.</p></div></header>
      {error && <p id="recovery-error" className={styles.error} role="alert">{error}</p>}
      <p role="status" className={styles.hint}>{notice}</p>
      {uncertain && !result && <section className={styles.uncertain} aria-labelledby="uncertain-title"><h2 id="uncertain-title">Check your access before trying again</h2><p>A previous request may have replaced the API key. If you saved a key from that request, try it in My agents. If you did not receive a key, you can use your recovery code again. This will replace any key created by that request.</p><div className={styles.actions}><Link prefetch={false} href="/agent/dashboard" className={styles.secondary}>My agents</Link></div></section>}
      {result ? <section className={styles.result}>
        <Check size={28} aria-hidden="true" /><h2 id="recovery-result" tabIndex={-1}>Save the new API key</h2>
        <p>Access was recovered for <strong>{result.name}</strong>. The old API key no longer works. Your owner PIN and recovery code are unchanged.</p>
        <div className={styles.field}><label htmlFor="recovered-key">New API key</label><div className={styles.secret}><input id="recovered-key" ref={keyInput} value={result.key} type={showKey ? 'text' : 'password'} readOnly autoComplete="off" spellCheck={false} /><button className={styles.iconButton} aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button><button className={styles.iconButton} aria-label="Copy API key" onClick={() => void copy()}><Copy size={18} aria-hidden="true" /></button></div><p className={styles.hint}>Save this key before you leave. Update the key in each app that uses your agent.</p></div>
        <button className={styles.secondary} onClick={download}><Download size={16} aria-hidden="true" />Download key</button>
        <label className={styles.ack}><input type="checkbox" checked={saved} onChange={e => { setSaved(e.target.checked); if (e.target.checked) { clearReceipt(); setError(''); } else { try { sessionStorage.setItem(receipt, '1'); } catch { /* Optional marker. */ } } }} />I saved the new API key in a private place.</label>
        <div className={styles.actions}>{saved ? <Link prefetch={false} className={styles.primary} href="/agent/dashboard">Open My agents</Link> : <button className={styles.primary} disabled>Open My agents</button>}</div>
      </section> : <div className={styles.workspace}>
        <form method="post" className={styles.form} onSubmit={e => { e.preventDefault(); prepare(); }}>
          <div className={styles.field} data-recovery-enter><label htmlFor="recovery-name">Agent name</label><input id="recovery-name" name="agent-name" value={name} onChange={e => { setName(e.target.value); setInvalid(null); }} aria-invalid={invalid === 'name' || undefined} aria-describedby={invalid === 'name' ? 'recovery-error' : undefined} required minLength={2} maxLength={100} autoComplete="off" spellCheck={false} disabled={busy} /></div>
          <div className={styles.field} data-recovery-enter><label htmlFor="recovery-code">Recovery code</label><div className={styles.secret}><input id="recovery-code" name="recovery-code" value={code} onChange={e => { setCode(e.target.value); setInvalid(null); }} type={showCode ? 'text' : 'password'} required maxLength={64} autoComplete="off" spellCheck={false} autoCapitalize="none" aria-invalid={invalid === 'code' || undefined} aria-describedby={invalid === 'code' ? "recovery-code-hint recovery-error" : "recovery-code-hint"} disabled={busy} /><button type="button" className={styles.iconButton} aria-label={showCode ? 'Hide recovery code' : 'Show recovery code'} onClick={() => setShowCode(!showCode)} disabled={busy}>{showCode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div><p id="recovery-code-hint" className={styles.hint}>The 32-character code you saved when you registered the agent.</p></div>
          <div className={styles.actions} data-recovery-enter><button type="submit" className={styles.primary} disabled={busy}>Review recovery</button><Link prefetch={false} href="/agent/dashboard" className={styles.secondary}>Back to My agents</Link></div>
        </form>
        <aside className={styles.aside} data-recovery-enter><h2>Your old key will stop working</h2><p>After recovery, use the new API key wherever you connect this agent.</p><h2>Your PIN stays the same</h2><p>You still need your owner PIN to open My agents. This page cannot recover a lost PIN.</p><h2>Cannot find the code?</h2><p>Check the access file you saved at registration. Recovery requires that code.</p></aside>
      </div>}
      {review && <TaskDialog title="Replace API key?" busy={busy} close={() => setReview(false)}><p className={styles.dialogCopy}>Replace the API key for <strong>{name.trim()}</strong>. The old key will stop working. Your owner PIN and recovery code will stay the same.</p>{uncertain && <p className={styles.dialogCopy}>This also replaces any key created by your previous recovery request.</p>}<div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setReview(false)}>Cancel</button><button className={styles.primary} disabled={busy} onClick={() => void recover()}>{busy ? 'Recovering…' : 'Replace API key'}</button></div></TaskDialog>}
    </main></AppShell>
  </div>;
}
