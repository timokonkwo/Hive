import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { authorization, metadata, avatar, policy } from '../scripts/tokenization/modules.mjs';
import { preview, agent, agentId } from './helpers/tokenization-fixture.mjs';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import * as crypto from 'node:crypto';
import * as dicebear from '@dicebear/core';
import * as bottts from '@dicebear/bottts';

const account = privateKeyToAccount(`0x${'1'.repeat(64)}`); // Public test key; never funded.
const other = privateKeyToAccount(`0x${'2'.repeat(64)}`);
const current = metadata.profilePreview(agentId, { ...agent, walletAddress: account.address }, 'owner');
const choices = { symbol: 'TEST', purchase: '0.01' };
function fixture() {
  const records = new Map();
  const db = { collection: () => ({ createIndex: async () => {}, insertOne: async record => records.set(record._id, structuredClone(record)),
    findOne: async query => [...records.values()].find(record => Object.entries(query).every(([k,v]) => record[k] === v)) }) };
  return { records, db, auth: new authorization.LaunchAuthorizations(db, 'https://uphive.xyz') };
}

test('wallet proof is bound to server-issued message, review and five-minute expiry', async () => {
  const { auth, records } = fixture(), now = new Date();
  const challenge = await auth.issue(current, account.address, choices, now);
  const signature = await account.signMessage({ message: challenge.message });
  const verified = await auth.verify(challenge.id, signature, current, now);
  assert.equal(verified.signer, account.address.toLowerCase());
  assert.equal(verified.expiresAt.getTime() - verified.issuedAt.getTime(), 300000);
  assert.match(challenge.message, /does not.*spend funds/);
  assert.equal(records.size, 1);
  await assert.rejects(auth.verify(challenge.id, signature, current, new Date(now.getTime()+300000)), /expired/);
  await assert.rejects(auth.verify(challenge.id, signature, current, new Date(now.getTime()-1)), /expired/);
  await assert.rejects(auth.verify(challenge.id, await other.signMessage({ message: challenge.message }), current, now), /does not match/);
  await assert.rejects(auth.verify(challenge.id, await account.signMessage({ message: challenge.message+'\nchanged' }), current, now), /does not match/);
  await assert.rejects(auth.verify(challenge.id, '0xnot-a-signature', current, now), /Sign/);
});

test('profile, wallet, role, agent and origin changes invalidate authorization', async () => {
  const { auth, db } = fixture();
  const challenge = await auth.issue(current, account.address, choices);
  const signature = await account.signMessage({ message: challenge.message });
  for (const changed of [
    { ...current, agentId: 'a'.repeat(24) }, { ...current, role: 'admin' },
    { ...current, metadata: { ...current.metadata, name: 'Changed name' } },
    { ...current, metadata: { ...current.metadata, avatarSeed: 'changed-avatar' } },
    { ...current, requiredSigner: other.address, recipient: other.address },
    { ...current, issues: ['Agent suspended'] },
  ]) await assert.rejects(auth.verify(challenge.id, signature, changed));
  await assert.rejects(new authorization.LaunchAuthorizations(db, 'https://other.example').verify(challenge.id, signature, current), /expired/);
  for (const origin of ['http://uphive.xyz','https://uphive.xyz/path','https://uphive.xyz/','javascript:bad']) assert.throws(() => new authorization.LaunchAuthorizations(db, origin));
});

test('review uses canonical amounts and fixed admin recipient policy', () => {
  const a = authorization.launchReview(current, account.address, { symbol: ' test ', purchase: '0.010' });
  const b = authorization.launchReview(current, account.address.toLowerCase(), choices);
  assert.deepEqual(a, b);
  assert.notEqual(authorization.launchReview(current, account.address, { ...choices, purchase: '0.02' }).digest, b.digest);
  assert.notEqual(authorization.launchReview(current, account.address, { ...choices, symbol: 'OTHER' }).digest, b.digest);
  const admin = metadata.profilePreview(agentId, agent, 'admin');
  assert.ok(authorization.launchReview(admin, account.address, choices));
  assert.throws(() => authorization.launchReview({ ...admin, recipient: account.address }, account.address, choices));
  assert.throws(() => authorization.launchReview(current, other.address, choices));
});

test('avatar follows the profile seed and only approved image URL shapes reach calldata', () => {
  const first = avatar.tokenAvatar(preview);
  assert.deepEqual(avatar.tokenAvatar(preview), first);
  assert.notEqual(avatar.tokenAvatar({ ...preview, metadata: { ...preview.metadata, avatarSeed: 'other' } }).publicId, first.publicId);
  assert.match(first.svg, /width="512"/);
  const url = `https://res.cloudinary.com/test/image/upload/v123/${first.publicId}.png`;
  assert.equal(policy.validTokenLogo(url), true);
  for (const bad of [url+'?x=1',url.replace('v123/',''),url.replace('res.cloudinary.com','evil.test'),url.replace('hive-agent-tokens','other'), 'http://localhost/image.png']) assert.equal(policy.validTokenLogo(bad), false);
});

test('Cloudinary uploader never overwrites and rejects unexpected delivery results', async t => {
  const keys = ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'];
  const before = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key,i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; }));
  keys.forEach(key => { process.env[key] = 'test'; });
  let options, patch = {};
  const loaded = loadTypeScript(new URL('../lib/agent-tokenization/avatar.ts',import.meta.url), {
    'node:crypto': crypto, '@dicebear/core': dicebear, '@dicebear/bottts': bottts, './policy': policy, './profile-fields': { AGENT_IMAGE_LIMIT: 2 * 1024 * 1024 },
    cloudinary: { v2: { uploader: { upload: async (data, opts) => {
      assert.match(data, /^data:image\/svg\+xml;base64,/); options = opts;
      return { public_id:opts.public_id,resource_type:'image',type:'upload',format:'png',version:123,width:512,height:512,
        secure_url:`https://res.cloudinary.com/test/image/upload/v123/${opts.public_id}.png`, ...patch };
    } } } },
  });
  await loaded.persistTokenAvatar(preview);
  assert.equal(options.overwrite,false); assert.equal(options.unique_filename,false); assert.equal(options.format,'png');
  for (patch of [{secure_url:'https://evil.test/image.png'}, {format:'svg'}, {version:0}, {width:1}, {public_id:'different'}]) await assert.rejects(loaded.persistTokenAvatar(preview), /verified|unexpected/);
});
