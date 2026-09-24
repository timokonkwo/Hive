import test from 'node:test';import assert from 'node:assert/strict';
import {deploymentOrigin,validAccessToken,sessionCookie} from './access.mjs';
const remote={origin:'https://unit-test.trycloudflare.com',token:'ab'.repeat(32),expiresAt:2000};
test('only loopback and the exact configured HTTPS tunnel host are accepted',()=>{
 assert.equal(deploymentOrigin('localhost:8789',remote),'http://localhost:8789');assert.equal(deploymentOrigin('unit-test.trycloudflare.com',remote),remote.origin);
 for(const host of ['unit-test.trycloudflare.com.evil.test','other.trycloudflare.com','localhost:9999','evil.test'])assert.throws(()=>deploymentOrigin(host,remote));
 assert.throws(()=>deploymentOrigin('unit-test.trycloudflare.com',null));assert.throws(()=>deploymentOrigin('evil.test',{...remote,origin:'https://evil.test'}));
});
test('private access token has fixed entropy, constant-time comparison and expiry',()=>{
 assert.equal(validAccessToken(remote.token,remote,1000),true);
 for(const token of [undefined,'',remote.token.slice(1),'00'.repeat(32)])assert.equal(validAccessToken(token,remote,1000),false);
 assert.equal(validAccessToken(remote.token,remote,2000),false);assert.equal(validAccessToken(remote.token,null,1000),false);
});
test('remote session cookies are HTTPS-only, HttpOnly, SameSite Strict and time-limited',()=>{
 const cookie=sessionCookie('test',remote.origin,20);for(const part of ['Secure','HttpOnly','SameSite=Strict','Max-Age=20'])assert.ok(cookie.includes(part));assert.ok(!sessionCookie('test','http://localhost:8789').includes('Secure'));
});
