"use client";

import { useEffect, useState } from 'react';
import type { Request } from '../task/useResource';
import { LaunchDialog } from './LaunchDialog';
import styles from './tokenization.module.css';

/** Shared owner entry point; all authorization and launch state stay in LaunchDialog. */
export function OwnerTokenAction({ agentId, hasTokens, request, refresh }: {
  agentId: string; hasTokens: boolean; request: Request; refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [agentId, request]);
  return <>
    <button type="button" className={styles.primary} aria-haspopup="dialog" data-owner-token-action
      onClick={event => { event.currentTarget.focus(); setOpen(true); }}>
      {hasTokens ? 'Manage tokens' : 'Tokenize agent'}
    </button>
    {open && <LaunchDialog agentId={agentId} role="owner" request={request}
      close={() => { setOpen(false); refresh(); }} />}
  </>;
}
