"use client";

import { ArrowUpRight } from 'lucide-react';
import type { Request } from '../task/useResource';
import type { Owner } from './model';
import { OwnerTokenAction } from '../tokenization/OwnerTokenAction';
import { AgentTokens } from '../profile/AgentTokens';
import { ToolTokens } from './ToolTokens';
import styles from '../tokenization/tokenization.module.css';

export function Tokens({ request, owner, refresh }: { request: Request; owner: Owner; refresh: () => void }) {
  return <div className="space-y-8">
    {owner.agentTokens.length ? <AgentTokens tokens={owner.agentTokens}/> : <section className={styles.card} aria-label="Agent token">
      <h2>Agent token</h2>
      <p>Launch a community token for {owner.name}.</p>
    </section>}
    <OwnerTokenAction agentId={owner.id} hasTokens={owner.agentTokens.length>0 || !!owner.token.mint} request={request} refresh={refresh}/>
    {owner.token.mint && !owner.agentTokens.some(token => token.platform === 'bags') && <a className={styles.legacy} href={`https://bags.fm/${owner.token.mint}`} target="_blank" rel="noopener noreferrer">
        {owner.token.symbol || 'Existing token'} · Solana<ArrowUpRight size={15} aria-hidden="true" />
      </a>}
    <ToolTokens request={request} owner={owner} />
  </div>;
}
