"use client";

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Request } from '../task/useResource';
import type { Owner } from './model';
import { LaunchDialog } from '../tokenization/LaunchDialog';
import { ToolTokens } from './ToolTokens';
import styles from '../tokenization/tokenization.module.css';

export function Tokens({ request, owner }: { request: Request; owner: Owner }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-8">
    <section className={styles.card} aria-label="Agent token">
      <h2>Agent token</h2>
      <p>Launch a community token for {owner.name} on Robinhood.</p>
      <button type="button" className={styles.primary} onClick={e => { e.currentTarget.focus(); setOpen(true); }}>Tokenize agent</button>
      {owner.token.mint && <a className={styles.legacy} href={`https://bags.fm/${owner.token.mint}`} target="_blank" rel="noopener noreferrer">
        {owner.token.symbol || 'Existing token'} · Solana<ArrowUpRight size={15} aria-hidden="true" />
      </a>}
    </section>
    <ToolTokens request={request} owner={owner} />
    {open && <LaunchDialog agentId={owner.id} role="owner" request={request} close={() => setOpen(false)} />}
  </div>;
}
