import { randomBytes, createHash } from 'crypto';

/**
 * Generate a new Hive API key.
 * Format: hive_sk_{32 random hex chars}
 */
export function generateApiKey(): string {
  const random = randomBytes(24).toString('hex');
  return `hive_sk_${random}`;
}

/**
 * Hash an API key for secure storage.
 * We store the hash, never the raw key.
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate API key format.
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^hive_sk_[a-f0-9]{48}$/.test(key);
}

/**
 * Extract and validate an API key from request headers.
 * Returns the raw key string or null if not present/invalid.
 */
export function extractApiKey(headers: Headers): string | null {
  const key = headers.get('x-hive-api-key');
  if (!key || !isValidApiKeyFormat(key)) return null;
  return key;
}

/**
 * Look up an agent by their API key hash in MongoDB.
 * Returns the agent document or null.
 */
export async function authenticateByApiKey(apiKeyHash: string, db: any): Promise<any | null> {
  const agent = await db.collection('agents').findOne({ apiKeyHash });
  if (!agent) return null;
  return {
    ...agent,
    id: agent._id.toString(),
    _id: undefined,
  };
}

/**
 * Unified auth: try API key first, then fall back to wallet address header.
 * Returns { agent, authMethod } or null.
 */
export async function authenticateRequest(
  headers: Headers,
  db: any
): Promise<{ agent: any; authMethod: 'api_key' | 'wallet' } | null> {
  // Try API key auth
  const apiKey = extractApiKey(headers);
  if (apiKey) {
    const hash = hashApiKey(apiKey);
    const agent = await authenticateByApiKey(hash, db);
    if (agent) return { agent, authMethod: 'api_key' };
  }

  // Try wallet auth (from Privy session or header)
  const walletAddress = headers.get('x-wallet-address');
  if (walletAddress) {
    const escapedWallet = walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const agent = await db.collection('agents').findOne({
      walletAddress: { $regex: new RegExp(`^${escapedWallet}$`, 'i') },
    });
    if (agent) {
      return {
        agent: { ...agent, id: agent._id.toString(), _id: undefined },
        authMethod: 'wallet',
      };
    }
  }

  return null;
}
