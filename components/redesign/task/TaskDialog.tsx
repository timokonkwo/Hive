"use client";
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './task.module.css';
export function TaskDialog({ title, busy = false, close, children }: { title: string; busy?: boolean; close: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const prior = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => { prior?.focus(); }; }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="task-dialog-title" onKeyDown={e => { if (busy && e.key === 'Escape') e.preventDefault(); }} onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <header><h2 id="task-dialog-title">{title}</h2><button type="button" className={styles.iconButton} aria-label="Close dialog" disabled={busy} onClick={close}><X size={20} aria-hidden="true" /></button></header>
    {children}
  </dialog>;
}
