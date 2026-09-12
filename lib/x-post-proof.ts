import { createHmac, randomBytes } from 'crypto';
import { VerificationError, type VerificationAgent, postLink, xHandle } from './agent-verification';
const encode = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function xLookupConfigured() { return !!process.env.X_BEARER_TOKEN || !!(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET); }
export function xLookupAuthorization(url: URL, nonce = randomBytes(16).toString('hex'), timestamp = String(Math.floor(Date.now() / 1000))) {
  if (process.env.X_BEARER_TOKEN) return 'Bearer ' + process.env.X_BEARER_TOKEN;
  if (!xLookupConfigured()) throw new VerificationError('Post verification is temporarily unavailable. Try again later.', 503);
  const oauth: Record<string, string> = { oauth_consumer_key: process.env.X_API_KEY!, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: timestamp, oauth_token: process.env.X_ACCESS_TOKEN!, oauth_version: '1.0' };
  const pairs = [...url.searchParams.entries(), ...Object.entries(oauth)].map(([k, v]) => [encode(k), encode(v)]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  const params = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  oauth.oauth_signature = createHmac('sha1', `${encode(process.env.X_API_SECRET!)}&${encode(process.env.X_ACCESS_TOKEN_SECRET!)}`).update(`GET&${encode(url.origin + url.pathname)}&${encode(params)}`).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${encode(k)}="${encode(oauth[k])}"`).join(', ');
}
export async function readXPost(id: string) {
  if (!/^[0-9]{1,25}$/.test(id)) throw new VerificationError('The post ID is invalid.');
  const url = new URL(`https://api.x.com/2/tweets/${id}`);
  url.search = new URLSearchParams({ 'tweet.fields': 'author_id,referenced_tweets', expansions: 'author_id', 'user.fields': 'username' }).toString();
  const authorization = xLookupAuthorization(url);
  let response;
  try { response = await fetch(url, { method: 'GET', headers: { Authorization: authorization }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) }); }
  catch { throw new VerificationError('X could not be reached. Your agent is still unverified. Try again shortly.', 503); }
  if (response.status === 404) throw new VerificationError('The post was not found. Check the link and make sure the post is public.', 422);
  if (!response.ok) throw new VerificationError('X could not confirm this post. Check that it is public and try again later.', 503);
  try { return await response.json(); } catch { throw new VerificationError('X returned an unreadable response. Try again later.', 503); }
}
export function checkXPost(value: unknown, link: ReturnType<typeof postLink>, code: string, agent: VerificationAgent) {
  const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const root = object(value), data = object(root.data), includes = object(root.includes);
  const user = Array.isArray(includes.users) ? includes.users.map(object).find(u => u.id === data.author_id) : undefined;
  const username = xHandle(user?.username), owner = xHandle(agent.ownerTwitter);
  if (data.id !== link.id || typeof data.author_id !== 'string' || !/^\d+$/.test(data.author_id) || !username || typeof data.text !== 'string') throw new VerificationError('X did not return the post and its author. Try again later.', 503);
  if (username !== link.username || (owner && username !== owner)) throw new VerificationError(owner ? `Post from @${owner}, then submit that post link.` : 'The link does not match the post author. Copy the original post link.', 422);
  if (Array.isArray(data.referenced_tweets) && data.referenced_tweets.some(t => object(t).type === 'retweeted')) throw new VerificationError('Publish your own verification post, then submit its link.', 422);
  if (!data.text.split(/\r?\n/).some(line => line.trim() === `Verification: ${code}`)) throw new VerificationError('The post does not include the current verification code. Copy the full text and publish it again.', 422);
  return { method: 'x_post' as const, username, authorId: data.author_id, postId: link.id, code };
}
