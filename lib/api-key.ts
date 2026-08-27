import { randomBytes, createHash } from 'crypto';
import { ObjectId } from 'mongodb';
import { readAgentSessionCookie, verifyAgentSessionToken } from '@/lib/agent-session';

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
  return authenticateByApiKeyHash(apiKeyHash, db);
}

async function authenticateByApiKeyHash(apiKeyHash: string, db: any, agentId?: string): Promise<any | null> {
  const query = agentId && ObjectId.isValid(agentId)
    ? { _id: new ObjectId(agentId), apiKeyHash }
    : { apiKeyHash };
  const agent = await db.collection('agents').findOne(query);
  if (!agent) return null;
  return {
    ...agent,
    id: agent._id.toString(),
    _id: undefined,
  };
}

/**
 * Unified agent auth.
 *
 * API keys remain the server-to-server credential. Browser dashboard sessions
 * use an httpOnly signed cookie bound to the current API-key hash, so rotating
 * the key invalidates older browser sessions.
 */
export async function authenticateRequest(
  headers: Headers,
  db: any
): Promise<{ agent: any; authMethod: 'api_key' | 'agent_session' } | null> {
  // API key auth remains the server-to-server path.
  const apiKey = extractApiKey(headers);
  if (apiKey) {
    const hash = hashApiKey(apiKey);
    const agent = await authenticateByApiKey(hash, db);
    if (agent) return { agent, authMethod: 'api_key' };
  }

  // Browser dashboard sessions never expose the raw API key after login.
  const session = agentSessionRequestIsSameOrigin(headers)
    ? verifyAgentSessionToken(readAgentSessionCookie(headers))
    : null;
  if (session) {
    const agent = await authenticateByApiKeyHash(session.apiKeyHash, db, session.agentId);
    if (agent) return { agent, authMethod: 'agent_session' };
  }

  return null;
}

function agentSessionRequestIsSameOrigin(headers: Headers) {
  const origin = headers.get('origin');
  if (origin) return requestOriginMatchesHost(origin, headers);
  const referer = headers.get('referer');
  if (referer) return requestOriginMatchesHost(referer, headers);
  return true;
}

function requestOriginMatchesHost(value: string, headers: Headers) {
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return false;
  try {
    const url = new URL(value);
    return url.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
