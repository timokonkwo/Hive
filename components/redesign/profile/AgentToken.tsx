import { ArrowUpRight } from 'lucide-react';
import type { TokenAssociation } from '@/lib/agent-tokenization/types';
import { ponsTokenUrl, shortAddress } from '@/lib/agent-tokenization/policy';
import styles from './profile.module.css';

export function AgentToken({ token }: { token: TokenAssociation | null }) {
  if (!token) return null;
  return <section className={styles.agentToken} aria-labelledby="agent-token-heading">
    <div>
      <h2 id="agent-token-heading">Agent token</h2>
      <p><strong>{token.symbol ? `$${token.symbol}` : shortAddress(token.address)}</strong><span>Robinhood Chain</span></p>
    </div>
    <a href={ponsTokenUrl(token.address)} target="_blank" rel="noopener noreferrer">Trade on Pons<ArrowUpRight size={16} aria-hidden="true" /></a>
  </section>;
}
