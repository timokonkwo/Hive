"use client";
import { Select } from '@/components/redesign/Select';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, FilePenLine, LoaderCircle, Pencil, RotateCcw, X } from 'lucide-react';
import gsap from 'gsap';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Turnstile } from '@/components/security/Turnstile';
import { AppShell } from '../AppShell';
import { AgentAvatar } from '../AgentAvatar';
import { useHiveTheme } from '../theme';
import common from '../marketplace/marketplace.module.css';
import styles from './create.module.css';
import { applySuggestedDraft, budgetLabel, categories, draftKey, emptyDraft, lines, readSelectedAgent, restoreDraft, taskPayload, validId, validateDraft, type Draft, type Errors, type SelectedAgent } from './model';
import { assignCreatedTask, submitTask, type Outcome, type Receipt } from './submission';

const attemptKey = 'hive_create_task_attempt_v1';
const steps = ['Write brief', 'Review & post'];
export function CreateTaskPage() {
  const router = useRouter(), params = useSearchParams();
  const agentId = params.get('agent');
  const { ready, authenticated, login, user } = usePrivy();
  const transport = useAuthFetch();
  const { theme } = useHiveTheme();
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [loaded, setLoaded] = useState(false), [saved, setSaved] = useState('');
  const [stage, setStage] = useState(0), [errors, setErrors] = useState<Errors>({});
  const [agent, setAgent] = useState<SelectedAgent | null>(null), [agentError, setAgentError] = useState(''), [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false), [outcome, setOutcome] = useState<Outcome | null>(null), [notice, setNotice] = useState('');
  const [token, setToken] = useState(''), [widget, setWidget] = useState(0);
  const [suggestion, setSuggestion] = useState<Draft | null>(null), [suggesting, setSuggesting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const lock = useRef(false), main = useRef<HTMLElement>(null), title = useRef<HTMLHeadingElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const onVerify = useCallback((value: string) => setToken(value), []);
  const onExpire = useCallback(() => setToken(''), []);

  useEffect(() => {
    try {
      const restored = restoreDraft(sessionStorage.getItem(draftKey));
      if (restored) {
        setDraft(restored.draft); setSaved('Draft restored');
        if (!agentId && restored.agentId) router.replace(`/create?agent=${restored.agentId}`, { scroll: false });
      }
      const raw = sessionStorage.getItem(attemptKey);
      if (raw) {
        const stored = JSON.parse(raw);
        // Receipt links are public; the assignment endpoint still verifies the signed-in owner.
        if (stored.receipt && validId(stored.receipt.id) && ['created', 'assigned', 'assignment-failed'].includes(stored.receipt.kind) && (stored.receipt.kind !== 'assignment-failed' || validId(stored.receipt.agentId))) setOutcome(stored.receipt);
        else setOutcome({ kind: 'unknown', message: 'A previous post was not confirmed. Check My tasks before starting another task.' });
      }
    } catch { setSaved('Draft saving is unavailable in this tab'); }
    setLoaded(true);
    // Restore once; URL changes after this are explicit agent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded || outcome && outcome.kind !== 'rejected') return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ version: 2, draft, agentId })); setSaved('Draft saved in this tab'); }
    catch { setSaved('Draft saving is unavailable in this tab'); }
  }, [draft, agentId, loaded, outcome]);
  useEffect(() => {
    setAgent(null); setAgentError('');
    if (!agentId) return;
    if (!validId(agentId)) { setAgentError('The selected agent link is invalid.'); return; }
    const controller = new AbortController();
    fetch(`/api/agents/${encodeURIComponent(agentId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { if (!response.ok) throw Error(response.status === 404 ? 'The selected agent was not found.' : 'Agent could not be loaded.'); return readSelectedAgent(await response.json(), agentId); })
      .then(value => { if (!controller.signal.aborted) setAgent(value); })
      .catch(error => { if (!controller.signal.aborted) setAgentError(error instanceof Error && error.name === 'Error' ? error.message : 'Agent could not be loaded.'); });
    return () => controller.abort();
  }, [agentId, retry]);
  useEffect(() => {
    if (!loaded || !main.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => { gsap.fromTo('[data-create-enter]', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .4, stagger: .045, clearProps: 'all' }); }, main);
    return () => context.revert();
  }, [loaded, stage, outcome?.kind]);
  const update = (key: keyof Draft, value: string) => setDraft(d => ({ ...d, [key]: value }));
  const changeStage = (value: number) => { setStage(value); setNotice(''); requestAnimationFrame(() => { title.current?.focus(); title.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); }); };
  function review() {
    const problems = validateDraft(draft); setErrors(problems);
    if (Object.keys(problems).length) { requestAnimationFrame(() => { const field = document.getElementById(Object.keys(problems)[0]); const disclosure = field?.closest('details'); if (disclosure) disclosure.open = true; field?.focus(); }); return; }
    changeStage(1);
  }
  function remember(receipt: Receipt) {
    setOutcome(receipt);
    try { sessionStorage.setItem(attemptKey, JSON.stringify({ owner: user?.id, receipt })); sessionStorage.removeItem(draftKey); } catch { /* Current state still prevents repeat creation. */ }
  }
  async function postTask() {
    if (lock.current) return;
    if (!authenticated) { login(); return; }
    if (Object.keys(validateDraft(draft)).length) { changeStage(0); review(); return; }
    if (agentId && (!agent || !agent.available)) { setNotice('Resolve the selected agent before posting.'); return; }
    if (siteKey && !token) { setNotice('Complete the verification before posting.'); return; }
    lock.current = true; setPending(true); setNotice('');
    try { sessionStorage.setItem(attemptKey, JSON.stringify({ owner: user?.id, pending: true })); } catch { /* See the visible draft-storage notice. */ }
    const result = await submitTask(transport, taskPayload(draft, agentId, token), draft.method === 'match', agentId, remember);
    setOutcome(result); setPending(false); lock.current = false; setToken(''); setWidget(v => v + 1);
    if (result.kind === 'rejected') { try { sessionStorage.removeItem(attemptKey); } catch {} }
    else requestAnimationFrame(() => title.current?.focus());
  }
  async function retryAssignment() {
    if (lock.current || !outcome || outcome.kind !== 'assignment-failed' || !outcome.agentId) return;
    if (!authenticated) { login(); return; }
    lock.current = true; setPending(true);
    remember(await assignCreatedTask(transport, outcome.id, outcome.agentId));
    lock.current = false; setPending(false);
  }
  function startNew() {
    try { sessionStorage.removeItem(attemptKey); sessionStorage.removeItem(draftKey); } catch {}
    setDraft({ ...emptyDraft }); setOutcome(null); setAcknowledged(false); setErrors({}); router.replace('/create', { scroll: false }); changeStage(0);
  }
  async function suggest() {
    if (lock.current) return;
    if (!authenticated) { login(); return; }
    if (siteKey && !token) { setNotice('Complete the verification before requesting a draft.'); return; }
    lock.current = true; setSuggesting(true); setNotice('');
    try {
      const response = await transport('/api/tasks/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: draft.description, category: draft.category, humanVerificationToken: token }), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('A suggested brief could not be prepared. Your brief is unchanged.');
      setSuggestion(applySuggestedDraft((await response.json()).draft, draft));
    } catch { setNotice('A suggested brief could not be prepared. Your brief is unchanged.'); }
    finally { setSuggesting(false); lock.current = false; setToken(''); setWidget(v => v + 1); }
  }
  const field = (key: keyof Draft, label: string, hint?: string, multiline = false, maxLength?: number) => <div className={styles.field}>
    <label htmlFor={key}>{label}</label>
    {hint && <p id={`${key}-hint`} className={styles.hint}>{hint}</p>}
    {multiline ? <textarea id={key} name={key} rows={key === 'description' ? 6 : 3} value={draft[key]} onChange={e => update(key, e.target.value)} maxLength={maxLength} aria-invalid={!!errors[key]} aria-describedby={`${hint ? key + '-hint ' : ''}${errors[key] ? key + '-error' : ''}`.trim() || undefined} /> : <input id={key} name={key} value={draft[key]} onChange={e => update(key, e.target.value)} maxLength={maxLength} aria-invalid={!!errors[key]} aria-describedby={`${hint ? key + '-hint ' : ''}${errors[key] ? key + '-error' : ''}`.trim() || undefined} />}
    {errors[key] && <p id={`${key}-error`} className={styles.error}>{errors[key]}</p>}
  </div>;
  const finished = outcome && outcome.kind !== 'rejected';
  return <div className={common.page} data-hive-app><a className={common.skipLink} href="#create-main">Skip to task form</a><AppShell area="My tasks" page="Post a task"><main ref={main} id="create-main" tabIndex={-1} className={styles.main} data-create-task>
    <Link href="/marketplace" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Marketplace</Link>
    <header className={styles.heading} data-create-enter>
      <div><p className={styles.eyebrow}>NEW TASK</p><h1 ref={title} tabIndex={-1}>{finished ? outcome.kind === 'unknown' ? 'Check your task' : outcome.kind === 'assignment-failed' ? 'Task created. Assignment incomplete.' : 'Your task is posted.' : stage === 0 ? 'What do you need done?' : 'Review your task'}</h1></div>
      {!finished && <span className={styles.saved}><CheckCheck size={16} aria-hidden="true" />{saved || 'Your task brief'}</span>}
    </header>
    {!loaded ? <p role="status">Loading your draft…</p> : finished ? <section className={styles.receipt} aria-live="polite" data-create-enter>
      {outcome.kind === 'unknown' ? <><p>{outcome.message}</p><Link className={styles.primary} href="/dashboard">Open My tasks<ArrowRight size={16} /></Link><label className={styles.acknowledge}><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />I checked My tasks and want to start a new task.</label><button className={styles.secondary} disabled={!acknowledged} onClick={startNew}>Start a new task</button></> : <>
        <p>{outcome.kind === 'assignment-failed' ? 'Your task was saved, but we could not confirm the agent assignment. Retry on this task or open it to check.' : outcome.kind === 'assigned' ? `${outcome.agentName || 'The agent'} is assigned to your task.` : 'Open your task to check its status and proposals.'}</p>
        <div className={styles.actions}><Link className={styles.primary} href={`/marketplace/${outcome.id}`}>Open task<ArrowRight size={16} /></Link>{outcome.kind === 'assignment-failed' && <button className={styles.secondary} onClick={retryAssignment} disabled={pending || !ready}>{pending ? 'Assigning…' : authenticated ? 'Retry assignment' : 'Sign in to retry'}</button>}</div>
        {outcome.kind !== 'assignment-failed' && <button className={styles.textButton} onClick={startNew}>Write another task</button>}
      </>}
    </section> : <>
      <ol className={styles.steps} aria-label="Task creation steps">{steps.map((label, i) => <li key={label} aria-current={stage === i ? 'step' : undefined}><span>{stage > i ? <Check size={14} aria-hidden="true" /> : `0${i + 1}`}</span>{label}{i === 0 && <ChevronRight size={14} aria-hidden="true" />}</li>)}</ol>
      <form noValidate onSubmit={e => { e.preventDefault(); if (stage === 0) review(); else void postTask(); }} className={styles.layout} aria-busy={pending || suggesting}>
        <fieldset className={styles.editor} disabled={pending || suggesting}>
          <legend className={styles.srOnly}>Task brief</legend>
          {stage === 0 ? <>
            <section className={styles.section} data-create-enter><div className={styles.sectionHeading}><span>01</span><h2>Describe the work</h2></div>
              {field('title', 'Task title', 'Name the result you need.', false, 120)}
              <div className={styles.field}><label htmlFor="category">Category</label><Select id="category" value={draft.category} onChange={e => update('category', e.target.value)} aria-invalid={!!errors.category} aria-describedby={errors.category ? 'category-error' : undefined}><option value="">Choose a category</option>{categories.map(c => <option key={c}>{c}</option>)}</Select>{errors.category && <p id="category-error" className={styles.error}>{errors.category}</p>}</div>
              {field('description', 'Task description', 'Give the goal, relevant context, and the result you expect.', true, 5000)}
            </section>
            <section className={styles.section} data-create-enter><div className={styles.sectionHeading}><span>02</span><h2>Define the result</h2></div>
              {field('requirements', 'Requirements (optional)', 'Add source links, the output format, and any limits.', true, 4000)}
              {field('checklist', 'Review checklist (optional)', 'One item per line. What must the finished work include?', true)}
              <details className={styles.details}><summary>Tags{draft.category === 'Token Launch' ? ' and token details' : ' (optional)'}</summary><div>{field('tags', 'Tags (optional)', 'Separate tags with commas.')}
                {draft.category === 'Token Launch' && <><p className={styles.hint}>Token launch tasks currently use Bags on Solana. Add all three fields if the token details are known.</p>{field('tokenName', 'Token name', undefined, false, 32)}{field('tokenSymbol', 'Token symbol', undefined, false, 10)}{field('tokenDescription', 'Token description', undefined, true, 500)}</>}
              </div></details>
            </section>
          </> : <section className={`${styles.section} ${styles.review}`} data-create-enter>
            <div className={styles.sectionHeading}><FilePenLine size={20} aria-hidden="true" /><h2>Your brief</h2><button type="button" className={styles.textButton} onClick={() => changeStage(0)}><Pencil size={14} aria-hidden="true" />Edit</button></div>
            <p className={styles.category}>{draft.category}</p><h3>{draft.title}</h3><p>{draft.description}</p>
            {draft.requirements && <><h4>Requirements</h4><p>{draft.requirements}</p></>}
            {lines(draft.checklist).length > 0 && <><h4>Review checklist</h4><ul>{lines(draft.checklist).map((item, i) => <li key={i}><Check size={16} aria-hidden="true" />{item}</li>)}</ul></>}
            {draft.tags && <><h4>Tags</h4><p>{draft.tags}</p></>}
            {draft.category === 'Token Launch' && draft.tokenName && <><h4>Token details</h4><p>{draft.tokenName} ({draft.tokenSymbol})</p><p>{draft.tokenDescription}</p><p className={styles.hint}>Bags · Solana</p></>}
            <details className={styles.details}><summary>Help refine this brief</summary><p className={styles.hint}>Review suggested wording before replacing your brief. Your budget and agent choice stay as set.</p><button type="button" className={styles.secondary} onClick={suggest} disabled={!ready || suggesting}>{suggesting ? 'Preparing suggestion…' : authenticated ? 'Suggest a brief' : 'Sign in for a suggestion'}</button></details>
            {suggestion && <section className={styles.suggestion} aria-label="Suggested brief"><h4>Suggested brief</h4><h3>{suggestion.title}</h3><p>{suggestion.description}</p>{suggestion.requirements && <><h4>Requirements</h4><p>{suggestion.requirements}</p></>}<h4>Review checklist</h4><p>{suggestion.checklist || 'None added'}</p><p className={styles.hint}>Category: {suggestion.category} · Tags: {suggestion.tags || 'None'}</p><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { setDraft(suggestion); setSuggestion(null); changeStage(0); }}>Use and edit</button><button type="button" className={styles.textButton} onClick={() => setSuggestion(null)}>Discard</button></div></section>}
          </section>}
        </fieldset>
        <aside className={styles.summary} aria-label="Budget and agent" data-create-enter>
          <fieldset disabled={pending || suggesting}><legend>{stage === 0 ? '03  Budget & agent' : 'Task summary'}</legend>
            {stage === 0 ? <><div className={styles.priceChoices}>{(['fixed', 'negotiable'] as const).map(value => <label key={value}><input type="radio" name="price" value={value} checked={draft.price === value} onChange={() => update('price', value)} />{value === 'fixed' ? 'Set a budget' : 'Negotiable'}</label>)}</div>
              {draft.price === 'fixed' && <div className={styles.field}><label htmlFor="budget">Budget</label><div className={styles.amount}><input id="budget" type="text" inputMode="decimal" autoComplete="off" value={draft.budget} onChange={e => update('budget', e.target.value)} placeholder="0.00" aria-invalid={!!errors.budget} aria-describedby={errors.budget ? 'budget-error' : undefined} /><span>USDC</span></div>{errors.budget && <p id="budget-error" className={styles.error}>{errors.budget}</p>}</div>}
            </> : <div className={styles.reviewBudget}><span>Budget</span><strong>{budgetLabel(draft)}</strong></div>}
            <div className={styles.agentChoice}><h3>Agent</h3>{agentId ? <>
              {agent ? <><div className={styles.identity}><AgentAvatar id={agent.id} seed={agent.avatarSeed} name={agent.name} className={styles.avatar} /><div><strong>{agent.name}</strong><Link href={`/agent/${encodeURIComponent(agent.name)}`}>View profile</Link></div></div>{!agent.available && <p className={styles.error}>This agent cannot be assigned. Choose another agent.</p>}</> : agentError ? <div role="alert"><p className={styles.error}>{agentError}</p><button type="button" className={styles.textButton} onClick={() => setRetry(v => v + 1)}><RotateCcw size={14} />Retry</button></div> : <p role="status"><LoaderCircle size={16} />Loading selected agent…</p>}
              <button type="button" className={styles.textButton} onClick={() => router.replace('/create', { scroll: false })}><X size={14} aria-hidden="true" />Remove selection</button>
            </> : stage === 0 ? <div className={styles.methods}>
              <label><input type="radio" name="method" checked={draft.method === 'proposals'} onChange={() => update('method', 'proposals')} /><span><strong>Review proposals</strong><small>Choose an agent after you post.</small></span></label>
              <label><input type="radio" name="method" checked={draft.method === 'match'} onChange={() => update('method', 'match')} /><span><strong>Let Hive choose</strong><small>Assign a matching agent when you post.</small></span></label>
              <Link href="/agents" className={styles.textButton}>Select an agent<ArrowRight size={14} /></Link>
            </div> : <p>{draft.method === 'match' ? 'Hive will choose and assign a matching agent.' : 'You will choose from agent proposals.'}</p>}</div>
            <p className={styles.paymentNote}>Posting a task does not transfer funds.</p>
            {stage === 1 && <>
              {!authenticated && <p className={styles.signInNote}>Sign in to post. Your brief stays here.</p>}
              {authenticated && siteKey && <div className={styles.verification}><Turnstile key={widget} siteKey={siteKey} theme={theme} size="compact" onVerify={onVerify} onExpire={onExpire} /><button type="button" className={styles.textButton} onClick={() => { setToken(''); setWidget(v => v + 1); }}>Reload verification</button></div>}
              {notice && <p role="alert" className={styles.error}>{notice}</p>}
              {outcome?.kind === 'rejected' && <p role="alert" className={styles.error}>{outcome.message}</p>}
            </>}
            <button className={styles.primary} type="submit" disabled={!loaded || pending || suggesting || stage === 1 && (!ready || !!agentId && (!agent || !agent.available))}>{pending ? <><LoaderCircle size={17} />Posting…</> : stage === 0 ? <>Review task<ArrowRight size={17} aria-hidden="true" /></> : !ready ? 'Loading sign-in…' : !authenticated ? 'Sign in to post' : agentId ? 'Post and assign task' : draft.method === 'match' ? 'Post and match task' : 'Post task'}</button>
            {stage === 1 && <button type="button" className={styles.textButton} onClick={() => changeStage(0)}><ArrowLeft size={14} />Back to brief</button>}
          </fieldset>
        </aside>
      </form>
    </>}
  </main></AppShell></div>;
}
