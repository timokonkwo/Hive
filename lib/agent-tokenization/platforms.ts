/** Shared, JSON-safe platform identities. Never infer a platform from a chain alone. */
export const platformIds = ['pons', 'bags', 'pump'] as const;
export type PlatformId = typeof platformIds[number];
export type TokenNetwork = 'robinhood' | 'solana';
export const platforms = {
  pons: { name: 'Pons', network: 'robinhood', chainName: 'Robinhood', currency: 'ETH', order: 2 },
  bags: { name: 'Bags', network: 'solana', chainName: 'Solana', currency: 'SOL', order: 0 },
  pump: { name: 'pump.fun', network: 'solana', chainName: 'Solana', currency: 'SOL', order: 1 },
} as const;

export interface AgentToken {
  platform: PlatformId;
  network: TokenNetwork;
  address: string;
  symbol: string;
  transactionHash: string;
  launchedAt?: string;
}

export function isPlatform(value: unknown): value is PlatformId {
  return typeof value === 'string' && platformIds.includes(value as PlatformId);
}

// Decode instead of just checking length: 32-character base58 need not be a 32-byte public key.
export function validSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const character of value) n = n * 58n + BigInt(alphabet.indexOf(character));
  let bytes = 0;
  while (n > 0n) { bytes++; n >>= 8n; }
  bytes += value.match(/^1*/)?.[0].length || 0;
  return bytes === 32 && value !== '11111111111111111111111111111111';
}

export function tokenKey(token: Pick<AgentToken, 'network' | 'address'>): string {
  return `${token.network}:${token.network === 'robinhood' ? token.address.toLowerCase() : token.address}`;
}
export function tradeUrl(token: Pick<AgentToken, 'platform' | 'network' | 'address'>): string {
  if (platforms[token.platform].network !== token.network) throw Error('Token network does not match its platform.');
  if (token.network === 'robinhood') {
    if (!/^0x[0-9a-f]{40}$/i.test(token.address) || /^0x0{40}$/i.test(token.address)) throw Error('Invalid token address.');
    return `https://www.ponsfamily.com/launchpad/${token.address}`;
  }
  if (!validSolanaAddress(token.address)) throw Error('Invalid token mint.');
  return token.platform === 'bags' ? `https://bags.fm/${token.address}` : `https://pump.fun/coin/${token.address}`;
}
export function transactionUrl(network: TokenNetwork, signature: string) {
  if (network === 'robinhood' && /^0x[a-f0-9]{64}$/i.test(signature)) return `https://robinhoodchain.blockscout.com/tx/${signature}`;
  if (network === 'solana' && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return `https://solscan.io/tx/${signature}`;
  throw Error('Invalid transaction identifier.');
}

export function readAgentToken(value: unknown): AgentToken | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const t = value as Record<string, unknown>;
  if (t.status !== undefined && t.status !== 'confirmed') return null;
  if (!isPlatform(t.platform) || t.network !== platforms[t.platform].network || typeof t.address !== 'string'
    || typeof t.transactionHash !== 'string' || typeof t.symbol !== 'string' || !/^[A-Z0-9]{1,13}$/.test(t.symbol)) return null;
  const token: AgentToken = { platform: t.platform, network: platforms[t.platform].network, address: t.address, symbol: t.symbol, transactionHash: t.transactionHash };
  try { tradeUrl(token); transactionUrl(token.network, token.transactionHash); } catch { return null; }
  if (typeof t.launchedAt === 'string' && Number.isFinite(Date.parse(t.launchedAt))) token.launchedAt = new Date(t.launchedAt).toISOString();
  return token;
}

/** Public catalog contains receipt-verified associations only, never launch attempts or tool tokens. */
export function readAgentTokens(value: unknown): AgentToken[] {
  if (!Array.isArray(value) || value.length > platformIds.length) return [];
  const parsed = value.map(readAgentToken);
  if (parsed.some(token => !token)) return [];
  const tokens = parsed as AgentToken[];
  if (new Set(tokens.map(t => t.platform)).size !== tokens.length || new Set(tokens.map(tokenKey)).size !== tokens.length) return [];
  return tokens.sort((a, b) => platformIds.indexOf(a.platform) - platformIds.indexOf(b.platform));
}

export function profileUrl(agentId: string): string {
  if (!/^[a-f0-9]{24}$/.test(agentId)) throw Error('Invalid agent identity.');
  return `https://uphive.xyz/agent/id/${agentId}`;
}

/** Strict integer arithmetic for SOL. */
export function purchaseLamports(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,9})?$/.test(value)) throw Error('Enter a SOL amount with up to 9 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
}
