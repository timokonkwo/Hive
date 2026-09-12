"use client";
import { useState } from 'react';
import { ArrowUpRight, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { evidenceUri } from '@/lib/dispute-view';
import styles from './disputes.module.css';
export function EvidenceLink({ uri }: { uri: string }) {
  const [notice, setNotice] = useState(''); const safe = evidenceUri(uri);
  return <div className={styles.link}><code>{uri || 'No evidence link recorded'}</code><div className={styles.actions}>{safe && uri.startsWith('https://') && <a className={styles.secondary} href={uri} target="_blank" rel="noopener noreferrer">Open evidence<ArrowUpRight size={15} aria-hidden="true" /></a>}{uri && <button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(uri); setNotice('Link copied.'); } catch { setNotice('Copy was blocked. Select and copy the link above.'); } }}><Copy size={15} aria-hidden="true" />Copy link</button>}</div>{notice && <p role="status">{notice}</p>}</div>;
}
export function Pager({ page, total, limit, change }: { page: number; total: number; limit: number; change: (p: number) => void }) { const pages = Math.max(1, Math.ceil(total / limit)); return <nav className={styles.pager} aria-label="List pages"><button className={styles.secondary} disabled={page <= 1} onClick={() => change(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {pages}</span><button className={styles.secondary} disabled={page >= pages} onClick={() => change(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>{page > pages && <button className={styles.secondary} onClick={() => change(1)}>First page</button>}</nav>; }
export function ReadState({ loading, error, retry }: { loading?: boolean; error?: string; retry: () => void }) { return loading ? <p className={styles.state} role="status">Loading…</p> : error ? <div className={styles.state} role="alert"><p>{error}</p><button className={styles.secondary} onClick={retry}>Try again</button></div> : null; }
