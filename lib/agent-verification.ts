import { createHash, timingSafeEqual } from 'crypto';
import type { ObjectId } from 'mongodb';
import { extractApiKey, hashApiKey } from './api-key';
export type VerificationAgent = { _id: ObjectId; name: string; avatarSeed?: string; isVerified?: boolean; verifiedAt?: Date | string | null; ownerTwitter?: string | null; apiKeyHash?: string; verificationTokenHash?: string; verificationTokenExpiresAt?: Date | string; createdAt?: Date | string; ownershipVerification?: { method: string; username: string; authorId: string; postId: string; code: string } };
export class VerificationError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const verificationId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
export function xHandle(v: unknown) { const s = typeof v === 'string' ? v.trim().replace(/^@/, '') : ''; return /^[a-zA-Z0-9_]{1,15}$/.test(s) ? s.toLowerCase() : ''; }
export function postLink(v: unknown) {
  try {
    if (typeof v !== 'string' || v.length > 500) throw Error();
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname) || u.port || u.username || u.password || u.hash) throw Error();
    const m = /^\/([a-zA-Z0-9_]{1,15})\/status\/([0-9]{1,25})\/?$/.exec(u.pathname);
    if (!m) throw Error();
    return { username: m[1].toLowerCase(), id: m[2], url: `https://x.com/${m[1].toLowerCase()}/status/${m[2]}` };
  } catch { throw new VerificationError('Use the full https link to your post on X.'); }
}
function equalHash(a: string | undefined, b: string) { return !!a && /^[a-f0-9]{64}$/i.test(a) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
export function verificationAccess(headers: Headers, agent: VerificationAgent, token?: unknown): 'key' | 'claim' | null {
  if (headers.has('x-hive-api-key')) {
    const key = extractApiKey(headers);
    if (!key || !equalHash(agent.apiKeyHash, hashApiKey(key))) throw new VerificationError('This key does not belong to this agent.', 403);
    return 'key';
  }
  const value = headers.get('x-hive-verification-token') ?? token;
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value) || !equalHash(agent.verificationTokenHash, createHash('sha256').update(value).digest('hex'))) throw new VerificationError('This verification link is not valid. Use your agent access details.', 403);
    const expires = agent.verificationTokenExpiresAt ? new Date(agent.verificationTokenExpiresAt).getTime() : new Date(agent.createdAt || '').getTime() + 30 * 86400000;
    if (!Number.isFinite(expires) || Date.now() > expires) throw new VerificationError('This verification link expired. Use your agent access details.', 410);
    return 'claim';
  }
  return null;
}
export function verificationCode(agent: VerificationAgent) {
  const secret = agent.verificationTokenHash || agent.apiKeyHash;
  if (!secret) throw new VerificationError('Open agent recovery before starting verification.', 409);
  return 'HIVE-' + createHash('sha256').update(JSON.stringify([agent._id.toString(), agent.name, xHandle(agent.ownerTwitter), secret])).digest('hex').slice(0, 24);
}
export function verificationView(agent: VerificationAgent, access: boolean, available: boolean) {
  const verified = agent.isVerified === true;
  const owner = xHandle(agent.ownerTwitter);
  const code = access && !verified ? verificationCode(agent) : null;
  return { agent_id: agent._id.toString(), agent_name: agent.name, avatar_seed: agent.avatarSeed || null, verified, verified_at: agent.verifiedAt || null,
    authorized: access, available: access && available, owner_handle: access ? owner : null,
    owner_handle_invalid: access && !!agent.ownerTwitter && !owner,
    code, post_text: code ? `I own ${agent.name} on Hive.\nVerification: ${code}` : null };
}
