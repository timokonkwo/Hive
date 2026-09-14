"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Bug, Check, Lightbulb, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/redesign/AppShell';
import common from '@/components/redesign/marketplace/marketplace.module.css';
import styles from '@/components/redesign/feedback/feedback.module.css';

type Errors = { title?: string; description?: string };
export default function FeedbackPage() {
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [contact, setContact] = useState('');
  const [errors, setErrors] = useState<Errors>({}), [error, setError] = useState('');
  const [pending, setPending] = useState(false), [received, setReceived] = useState(false);
  const sending = useRef(false), titleInput = useRef<HTMLInputElement>(null), descriptionInput = useRef<HTMLTextAreaElement>(null), receipt = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (received) receipt.current?.focus(); }, [received]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const invalid: Errors = {};
    if (title.trim().length < 5) invalid.title = 'Enter a title with at least 5 characters.';
    if (description.trim().length < 10) invalid.description = 'Enter at least 10 characters to describe your feedback.';
    setErrors(invalid); setError('');
    if (Object.keys(invalid).length) { (invalid.title ? titleInput.current : descriptionInput.current)?.focus(); return; }
    sending.current = true; setPending(true);
    try {
      const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, title: title.trim(), description: description.trim(), contactInfo: contact.trim() || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many reports were sent. Please try again later.' : 'Your feedback could not be sent. Please try again.');
        return;
      }
      if (typeof data?.id !== 'string' || !data.id) { setError('We could not confirm your submission. Please try again later.'); return; }
      setReceived(true);
    } catch { setError('Connection failed. Check your connection and try again.'); }
    finally { sending.current = false; setPending(false); }
  }

  function reset() {
    setReceived(false); setTitle(''); setDescription(''); setContact(''); setErrors({}); setError('');
    requestAnimationFrame(() => titleInput.current?.focus());
  }

  return <div className={common.page} data-hive-app>
    <a href="#feedback-main" className={common.skipLink}>Skip to feedback</a>
    <AppShell area="Feedback" page="Send feedback"><main id="feedback-main" className={`${common.main} ${styles.main}`} tabIndex={-1}>
      <header className={styles.heading}><h1>Feedback</h1><p>Report a bug or suggest a feature.</p></header>
      {received ? <section className={styles.receipt} aria-labelledby="feedback-received">
        <span className={styles.check}><Check size={28} aria-hidden="true" /></span>
        <h2 id="feedback-received" ref={receipt} tabIndex={-1}>Feedback received</h2>
        <p>Thank you for helping improve Hive.</p>
        <div className={styles.actions}><button onClick={reset} className={styles.submit}>Send more feedback<ArrowRight size={18} aria-hidden="true" /></button><Link href="/marketplace">Open marketplace<ArrowRight size={18} aria-hidden="true" /></Link></div>
      </section> : <form onSubmit={submit} noValidate className={styles.form} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.fields}>
          <fieldset className={styles.types}><legend>Feedback type</legend><div>
            {([{ value: 'bug', label: 'Report a bug', icon: Bug }, { value: 'feature', label: 'Suggest a feature', icon: Lightbulb }] as const).map(({value,label,icon:Icon}) => <label key={value}><input type="radio" name="feedback-type" value={value} checked={type === value} onChange={() => setType(value)} /><Icon size={19} aria-hidden="true" /><span>{label}</span></label>)}
          </div></fieldset>
          <div className={styles.field}><label htmlFor="feedback-title">Title</label><input id="feedback-title" ref={titleInput} value={title} onChange={e => { setTitle(e.target.value); setErrors(prior => ({...prior,title:undefined})); }} required maxLength={200} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined} placeholder={type === 'bug' ? 'What went wrong?' : 'What would you like to add?'} />{errors.title && <p id="title-error" className={styles.fieldError}>{errors.title}</p>}</div>
          <div className={styles.field}><label htmlFor="feedback-description">{type === 'bug' ? 'What happened?' : 'Describe your idea'}</label><p id="description-hint" className={styles.hint}>{type === 'bug' ? 'Include what you did and what you expected to happen.' : 'Tell us how this would help you use Hive.'}</p><textarea id="feedback-description" ref={descriptionInput} rows={6} required maxLength={2000} value={description} onChange={e => { setDescription(e.target.value); setErrors(prior => ({...prior,description:undefined})); }} aria-invalid={!!errors.description} aria-describedby={`description-hint${errors.description ? ' description-error' : ''}`} /><div className={styles.below}>{errors.description && <p id="description-error" className={styles.fieldError}>{errors.description}</p>}<span className={styles.count}>{description.length.toLocaleString()} / 2,000</span></div></div>
          <div className={styles.field}><label htmlFor="feedback-contact">Contact <span>Optional</span></label><input id="feedback-contact" value={contact} onChange={e => setContact(e.target.value)} placeholder="Email or X handle" /></div>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}><button className={styles.submit} disabled={pending} type="submit">{pending ? <><Loader2 size={18} className={styles.spinner} aria-hidden="true" />Sending…</> : <>Send feedback<ArrowRight size={18} aria-hidden="true" /></>}</button><span role="status" className={styles.status}>{pending ? 'Sending your feedback' : ''}</span></div>
      </form>}
    </main></AppShell>
  </div>;
}
