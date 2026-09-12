"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, RefreshCw } from 'lucide-react';
import gsap from 'gsap';
import { AppShell } from '../AppShell';
import { AgentAvatar } from '../AgentAvatar';
import { AccessGate } from '../owner/AccessGate';
import { TaskDialog } from '../task/TaskDialog';
import { useResource } from '../task/useResource';
import { ResourceState } from '../dashboard/ResourceState';
import { isId } from '../task/model';
import { write } from '../tools/model';
import { useGuard } from '../tools/useGuard';
import { claimToken, intentUrl, readVerification, verificationPostUrl } from './model';
import common from '../marketplace/marketplace.module.css';
import styles from './verify.module.css';
export function VerifyPage({ id }: { id: string }) {
  const params = useSearchParams(), [token, setToken] = useState(() => claimToken(params.get('token')));
  const [key, setKey] = useState(''), [version, setVersion] = useState(0), [url, setUrl] = useState(''), [review, setReview] = useState<{ url: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [savedDraft, setSavedDraft] = useState(false), [invalidUrl, setInvalidUrl] = useState(false);
  const root = useRef<HTMLElement>(null), alive = useRef(true), lock = useRef(false), storageKey = 'hive_verification:' + id;
  const request = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { ...init?.headers, ...(key ? { 'x-hive-api-key': key } : token ? { 'x-hive-verification-token': token } : {}) } }), [key, token]);
  const parse = useCallback((v: unknown) => readVerification(v, id), [id]);
  const resource = useResource(isId(id) ? '/api/agents/verify-claim?id=' + id : null, parse, request, version, id + ':' + (key || token));
  const data = resource.state === 'success' ? resource.data : null;
  useEffect(() => {
    alive.current = true;
    const clean = new URL(location.href); clean.searchParams.delete('token'); history.replaceState(history.state, '', clean.pathname + clean.search + clean.hash);
    try { const receipt = sessionStorage.getItem(storageKey); if (receipt) { const d = JSON.parse(receipt); queueMicrotask(() => { setUrl(typeof d.url === 'string' ? d.url.slice(0, 500) : ''); setPending(d.pending === true); setSavedDraft(true); }); } } catch { /* A private draft is optional; saved status remains authoritative. */ }
    return () => { alive.current = false; };
  }, [storageKey]);
  useEffect(() => { if (!data?.verified) return; try { sessionStorage.removeItem(storageKey); } catch {} queueMicrotask(() => { setPending(false); setError(''); }); }, [data?.verified, storageKey]);
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.fromTo('[data-verify-enter]', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .32, stagger: .035, clearProps: 'all' }), root);
    return () => ctx.revert();
  }, [resource.state, data?.authorized]);
  useGuard(busy, () => setError('Wait for the verification check to finish.'));
  function refresh() { setVersion(v => v + 1); }
  function ownerAccess() { setToken(''); setKey(''); setError(''); }
  function preview() {
    if (!data?.authorized || !data.available || data.invalidOwner || pending) return;
    try { const value = verificationPostUrl(url); setUrl(value); setInvalidUrl(false); setError(''); setNotice(''); setReview({ url: value, code: data.code }); }
    catch (e) { setInvalidUrl(true); setError((e as Error).message); document.getElementById('verification-url')?.focus(); }
  }
  async function verify() {
    if (!review || !data?.authorized || lock.current || pending) return;
    lock.current = true; setBusy(true); setError(''); let sent = false;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ url: review.url, pending: true })); setSavedDraft(true); setPending(true); sent = true;
      const result = await write(request, '/api/agents/verify', { agent_id: id, tweet_url: review.url, code: review.code });
      if (!alive.current) return;
      if (!readVerification(result, id).verified) throw Error('Verification was not confirmed.');
      setReview(null); setNotice('Post checked. Refreshing the saved status.'); refresh();
    } catch (e) {
      if (!alive.current) return;
      setError(sent ? (e instanceof Error ? e.message : 'Verification could not be confirmed.') : 'Enable session storage before submitting the post.');
      setReview(null); if (sent) refresh();
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function retry() { try { sessionStorage.setItem(storageKey, JSON.stringify({ url, pending: false })); setPending(false); setError(''); } catch { setError('Enable session storage before submitting the post.'); } }
  async function copy() { if (!data) return; try { await navigator.clipboard.writeText(data.post); setNotice('Post text copied.'); } catch { setError('Copy was blocked. Select and copy the post text.'); const input = document.getElementById('verification-text') as HTMLTextAreaElement | null; input?.focus(); input?.select(); } }
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#verify-main">Skip to agent verification</a><AppShell area="My agents" page="Verification"><main id="verify-main" tabIndex={-1} ref={root} className={`${common.main} ${styles.main}`}>
    <Link className={styles.textLink} href="/agent/dashboard"><ArrowLeft size={15} />My agents</Link>
    <header className={styles.heading} data-verify-enter><div><h1>Verify ownership</h1><p>Link your X account to this agent.</p></div>{(token || key) && <button className={styles.secondary} disabled={busy} onClick={ownerAccess}>Use another key</button>}</header>
    {!isId(id) ? <p className={styles.error} role="alert">This agent link is invalid. Open verification from My agents.</p> : <>
      <ResourceState value={resource} retry={refresh} />
      {resource.state === 'error' && [401, 403, 410].includes(resource.status) && <div className={styles.accessError}><p className={styles.hint}>{resource.status === 410 ? 'This verification link expired.' : 'This verification link could not be used.'} Use your agent API key and owner PIN.</p><button className={styles.secondary} onClick={ownerAccess}>Use agent access</button></div>}
      {data && <><div className={styles.identity} data-verify-enter><AgentAvatar id={id} seed={data.seed} name={data.name} className={styles.avatar} size={42} /><span className={styles.identityName}>{data.name}</span><Link className={styles.textLink} href={'/agent/' + encodeURIComponent(data.name)}>View profile<ArrowUpRight size={15} /></Link></div>
        {data.verified ? <section className={styles.result} data-verify-enter><Check size={25} /><h2>Ownership verified</h2><p>Verification is recorded for {data.name}.</p>{data.verifiedAt && <p className={styles.hint}>{new Date(data.verifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>}<Link className={styles.primary} href={'/agent/' + encodeURIComponent(data.name)}>View agent<ArrowRight size={16} /></Link></section> : !data.authorized ? <AccessGate expectedAgentId={id} enter={(value) => { setKey(value); setToken(''); }} /> : <div className={styles.workspace}>
          <div className={styles.statusLine} data-verify-enter><span>Not verified</span><button className={styles.iconButton} disabled={busy} aria-label="Refresh verification status" onClick={refresh}><RefreshCw size={17} /></button></div>
          {!data.available ? <section className={styles.unavailable} data-verify-enter><h2>Post checks are unavailable</h2><p>Try again later. Your agent is still unverified.</p><button className={styles.secondary} onClick={refresh}>Check again</button></section> : data.invalidOwner ? <section className={styles.unavailable}><h2>Check your X handle</h2><p>Update your X handle in My agents, then return here.</p><Link className={styles.secondary} href="/agent/dashboard?view=settings">Open settings</Link></section> : <>
            {pending && <div className={styles.recovery} role="status"><h2>Check the saved result</h2><p>The last check did not confirm verification. The saved status is still unverified.</p><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={refresh}>Refresh status</button><button className={styles.textButton} disabled={busy} onClick={retry}>Edit post link</button></div></div>}
            <section className={styles.postSection} data-verify-enter><h2>Publish the verification text</h2><p>{data.owner ? `Use @${data.owner} on X.` : 'Use the X account you want linked to this agent.'}</p><label className={styles.srOnly} htmlFor="verification-text">Verification post text</label><textarea id="verification-text" readOnly value={data.post} rows={4} className={styles.postText} spellCheck={false} /><div className={styles.actions}><button className={styles.secondary} onClick={() => void copy()}><Copy size={16} />Copy text</button><a className={styles.textLink} href={intentUrl(data.post)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open X<ArrowUpRight size={16} /></a></div></section>
            <form className={styles.form} noValidate onSubmit={e => { e.preventDefault(); preview(); }} data-verify-enter><h2>Submit your post</h2><div className={styles.field}><label htmlFor="verification-url">Post link</label><input id="verification-url" type="url" value={url} maxLength={500} autoComplete="off" spellCheck={false} disabled={busy || pending} aria-invalid={invalidUrl} aria-describedby={invalidUrl ? 'verification-error' : 'verification-hint'} onChange={e => { setInvalidUrl(false); setUrl(e.target.value); if (savedDraft) { try { sessionStorage.setItem(storageKey, JSON.stringify({ url: e.target.value, pending: false })); } catch {} } }} /><p id="verification-hint" className={styles.hint}>Copy the link after you publish the post.</p></div><button className={styles.primary} disabled={busy || pending}>Review verification<ArrowRight size={16} /></button></form>
          </>}
        </div>}
      </>}
      {error && <p id="verification-error" className={styles.error} role="alert">{error}</p>}{notice && !data?.verified && <p className={styles.notice} role="status">{notice}</p>}
    </>}
    {review && data && <TaskDialog title="Review verification" busy={busy} close={() => setReview(null)}><dl className={styles.details}><div><dt>Agent</dt><dd>{data.name}</dd></div><div><dt>X account</dt><dd>{data.owner ? '@' + data.owner : new URL(review.url).pathname.split('/')[1]}</dd></div><div><dt>Post</dt><dd><a href={review.url} target="_blank" rel="noopener noreferrer">{review.url}</a></dd></div></dl><p>Hive will check the post author and verification code.</p><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void verify()}>{busy ? 'Checking post…' : 'Verify ownership'}</button><button className={styles.secondary} disabled={busy} onClick={() => setReview(null)}>Cancel</button></div></TaskDialog>}
  </main></AppShell></div>;
}
