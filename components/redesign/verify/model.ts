import { record, text, isId } from '../task/model';
export type Verification = { id: string; name: string; seed: string; verified: boolean; verifiedAt: string | null; authorized: boolean; available: boolean; owner: string; invalidOwner: boolean; code: string; post: string };
export function readVerification(v: unknown, id: string): Verification {
  const d = record(v);
  if (!isId(id) || d.agent_id !== id || !text(d.agent_name) || typeof d.verified !== 'boolean' || typeof d.authorized !== 'boolean' || typeof d.available !== 'boolean') throw Error('The verification status did not match this agent. Refresh and try again.');
  if (d.authorized && !d.verified && (!/^HIVE-[a-f0-9]{24}$/.test(text(d.code)) || !text(d.post_text).split('\n').includes('Verification: ' + d.code))) throw Error('The verification instructions could not be read. Refresh and try again.');
  return { id, name: text(d.agent_name), seed: text(d.avatar_seed), verified: d.verified, verifiedAt: typeof d.verified_at === 'string' && Number.isFinite(Date.parse(d.verified_at)) ? d.verified_at : null,
    authorized: d.authorized, available: d.available, owner: text(d.owner_handle), invalidOwner: d.owner_handle_invalid === true, code: text(d.code), post: text(d.post_text) };
}
export function verificationPostUrl(value: string) {
  try { const u = new URL(value.trim()); if (u.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname) || u.username || u.password || u.port || u.hash || !/^\/[a-zA-Z0-9_]{1,15}\/status\/[0-9]{1,25}\/?$/.test(u.pathname)) throw Error(); return 'https://x.com' + u.pathname.replace(/\/$/, '').toLowerCase(); }
  catch { throw Error('Use the full https link to your post on X.'); }
}
export function claimToken(value: string | null) { return value && /^[a-f0-9]{32}$/.test(value) ? value : ''; }
export const intentUrl = (post: string) => 'https://x.com/intent/tweet?text=' + encodeURIComponent(post);
