import {timingSafeEqual} from 'node:crypto';

export function deploymentOrigin(host,remote) {
  if(['localhost:8789','127.0.0.1:8789'].includes(host))return 'http://'+host;
  if(remote&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(remote.origin)&&host===new URL(remote.origin).host)return remote.origin;
  throw Error('Deployment host is not allowed.');
}
export function validAccessToken(value,remote,now=Date.now()) {
  if(!remote||!Number.isFinite(remote.expiresAt)||remote.expiresAt<=now||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(remote.token??''))return false;
  const expected=Buffer.from(remote.token),given=Buffer.from(value);return expected.length===given.length&&timingSafeEqual(expected,given);
}
export function sessionCookie(value,origin,seconds=14400){return `hiveDeploy=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${origin.startsWith('https://')?'; Secure':''}`;}
