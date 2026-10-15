"use client";

import { useId, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import type { LaunchPreview } from '@/lib/agent-tokenization/types';
import { AGENT_NAME_LIMIT, AGENT_BIO_LIMIT, AGENT_IMAGE_LIMIT, validateAgentDetails } from '@/lib/agent-tokenization/profile-fields';
import { AgentAvatar } from '../AgentAvatar';
import styles from './tokenization.module.css';

export interface AgentProfileEdit { name: string; bio: string; revision: string; image?: string }

export function AgentDetailsEditor({ preview, save, cancel, busyChanged }: {
  preview: LaunchPreview; save: (input: AgentProfileEdit) => Promise<void>;
  cancel: () => void; busyChanged: (busy: boolean) => void;
}) {
  const initial = preview.adminProfile!;
  const id = useId(), lock = useRef(false);
  const [name, setName] = useState(initial.name), [bio, setBio] = useState(initial.bio);
  const [image, setImage] = useState<string>(), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
  async function choose(file?: File) {
    if (!file || lock.current) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > AGENT_IMAGE_LIMIT) {
      setError('Choose a PNG, JPEG or WebP image up to 2 MB.'); return;
    }
    lock.current = true; setReading(true); busyChanged(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(Error());
        reader.onerror = () => reject(Error()); reader.readAsDataURL(file);
      });
      setImage(data);
    } catch { setError('The image could not be read. Choose it again.'); }
    finally { lock.current = false; setReading(false); busyChanged(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    setError('');
    let fields;
    try { fields = validateAgentDetails(name, bio); }
    catch (error) { setError((error as Error).message); return; }
    lock.current = true; setBusy(true); busyChanged(true);
    try { await save({ ...fields, revision: initial.revision, ...(image ? { image } : {}) }); cancel(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Changes could not be saved. Try again.'); }
    finally { lock.current = false; setBusy(false); busyChanged(false); }
  }
  return <form className={styles.editor} onSubmit={submit} aria-busy={busy || reading}>
    <h3 className={styles.stepTitle}>Edit agent details</h3>
    <div className={styles.imageEdit}>
      <AgentAvatar id={preview.agentId} name={name} seed={preview.metadata.avatarSeed} imageUrl={image || initial.imageUrl} size={80} className={styles.editAvatar} />
      <div><label className={styles.secondary} htmlFor={`${id}-image`}>
        {reading ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
        {reading ? 'Reading image…' : 'Change image'}
      </label><input className={styles.fileInput} id={`${id}-image`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || reading}
        onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
      <p className={styles.hint}>PNG, JPEG or WebP · Up to 2 MB</p></div>
    </div>
    <div className={styles.field}><label htmlFor={`${id}-name`}>Agent name</label>
      <input id={`${id}-name`} autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={AGENT_NAME_LIMIT} disabled={busy || reading} required autoComplete="off" /></div>
    <div className={styles.field}><label htmlFor={`${id}-bio`}>Bio</label>
      <textarea id={`${id}-bio`} value={bio} onChange={e => setBio(e.target.value)} maxLength={AGENT_BIO_LIMIT} minLength={10} rows={5} disabled={busy || reading} required /></div>
    <p className={styles.hint}>Updates the agent profile and token preview.</p>
    {error && <p role="alert" className={styles.fieldError}>{error}</p>}
    <div className={styles.recoveryActions}>
      <button className={styles.secondary} type="button" disabled={busy || reading} onClick={cancel}>Cancel</button>
      <button className={styles.primary} type="submit" disabled={busy || reading}>{busy && <Loader2 size={16} className={styles.spinner} aria-hidden="true" />}{busy ? 'Saving changes…' : 'Save changes'}</button>
    </div>
  </form>;
}
