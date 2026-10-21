import { readAssociation } from './association';
import { readAgentTokens, tokenKey, type AgentToken } from './platforms';

/** Compatibility projection while existing Pons intents continue to publish ponsToken. */
export function agentTokenCatalog(agent: Record<string, unknown>): AgentToken[] {
  const tokens = readAgentTokens(agent.agentTokens);
  const pons = readAssociation(agent.ponsToken);
  if (pons && /^[A-Z0-9]{1,13}$/.test(pons.symbol)) {
    const token: AgentToken = { platform: 'pons', network: 'robinhood', address: pons.address,
      symbol: pons.symbol, transactionHash: pons.transactionHash, ...(pons.launchedAt ? { launchedAt: pons.launchedAt } : {}) };
    const existing = tokens.find(t => t.platform === 'pons');
    // A conflicting projection is not permission to advertise a second Pons token.
    if (!existing) tokens.unshift(token);
    else if (tokenKey(existing) !== tokenKey(token)) return tokens.filter(t => t.platform !== 'pons');
  }
  return tokens;
}
