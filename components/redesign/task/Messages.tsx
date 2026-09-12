"use client";
import { Select } from '@/components/redesign/Select';
import { useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { date, dateLabel, isId, record, text } from './model';
import { jsonAction } from './payment';
import { useResource, type Request } from './useResource';
import styles from './task.module.css';
type Thread = { id: string; name: string };
function readThreads(v: unknown): Thread[] { const list = record(v).threads; if (!Array.isArray(list)) throw Error('Conversations could not be read.'); return list.map(v => { const t = record(v); if (!isId(t.id)) throw Error('Invalid conversation.'); return { id: t.id, name: text(t.agentName) || 'Task conversation' }; }); }
function readMessages(v: unknown) { const list = record(v).messages; if (!Array.isArray(list)) throw Error('Messages could not be read.'); return list.map(v => { const m = record(v); if (!isId(m.id)) throw Error('Invalid message.'); return { id: m.id, name: text(m.actorName) || 'Participant', content: text(m.content), date: date(m.createdAt) }; }); }
export function Messages({ id, request, identity, canStart }: { id: string; request: Request; identity: string; canStart: boolean }) {
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState(''), [drafts, setDrafts] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false); const failedRevision = useRef(-1);
  const threads = useResource(`/api/messages/threads?taskId=${id}`, readThreads, request, revision, identity);
  const thread = threads.state === 'success' ? threads.data.find(t => t.id === selected) || threads.data[0] : null;
  const messages = useResource(thread ? `/api/messages/threads/${thread.id}` : null, readMessages, request, revision, identity);
  const draftId = thread?.id || 'new', draft = drafts[draftId] || '';
  async function send() {
    if (lock.current || uncertain || !draft.trim() || (!thread && !canStart)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const data = await jsonAction(request, '/api/messages/threads', { taskId: id, ...(thread ? { threadId: thread.id } : {}), content: draft.trim() });
      if (!isId(data.thread?.id) || !isId(data.message?.id)) throw Error('The message could not be confirmed.');
      setDrafts(p => ({ ...p, [draftId]: '' })); setSelected(data.thread.id); setRevision(v => v + 1);
    } catch { setError('The message was not confirmed. Refresh the conversation before sending again.'); setUncertain(true); failedRevision.current = revision; }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.messages} aria-labelledby="messages-heading"><div className={styles.sectionHeading}><h2 id="messages-heading">Messages</h2><button type="button" className={styles.iconButton} aria-label="Refresh messages" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} aria-hidden="true" /></button></div>
    {threads.state === 'loading' && <p role="status">Loading conversations…</p>}
    {threads.state === 'error' && <p role="alert" className={styles.error}>{threads.message}</p>}
    {threads.state === 'success' && <>
      {threads.data.length > 1 && <div className={styles.field}><label htmlFor="conversation">Conversation</label><Select id="conversation" disabled={busy || uncertain} value={thread?.id || ''} onChange={e => { setSelected(e.target.value); setError(''); setUncertain(false); }}>{threads.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>}
      {messages.state === 'loading' && <p role="status">Loading messages…</p>}
      {messages.state === 'error' && <p role="alert" className={styles.error}>{messages.message}</p>}
      {messages.state === 'success' && <ol className={styles.messageList} aria-label="Conversation messages">{messages.data.map(m => <li key={m.id}><div><strong>{m.name}</strong><time dateTime={m.date || undefined}>{dateLabel(m.date)}</time></div><p>{m.content}</p></li>)}{messages.data.length === 0 && <li>No messages yet.</li>}</ol>}
      {!thread && <p className={styles.hint}>{canStart ? 'No messages yet.' : 'Messages become available after an agent is assigned or starts a conversation.'}</p>}
      {(thread || canStart) && <form onSubmit={e => { e.preventDefault(); void send(); }}><div className={styles.field}><label htmlFor="message-draft">Message</label><textarea id="message-draft" rows={3} maxLength={5000} value={draft} disabled={busy} onChange={e => setDrafts(p => ({ ...p, [draftId]: e.target.value }))} /></div>{error && <p role="alert" className={styles.error}>{error}</p>}{uncertain && revision > failedRevision.current && messages.state === 'success' && <button type="button" className={styles.textButton} onClick={() => { setUncertain(false); setError(''); }}>I checked the conversation; enable sending</button>}<button type="submit" className={styles.secondary} disabled={busy || !draft.trim() || uncertain || messages.state === 'error'}><Send size={15} aria-hidden="true" />{busy ? 'Sending…' : 'Send message'}</button></form>}
      <p className={styles.hint}>Use Refresh to check for new messages.</p>
    </>}
  </section>;
}
