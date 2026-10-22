import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { authorization, metadata, avatar, policy, sessions, sessionAccess, managed } from '../scripts/tokenization/modules.mjs';
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

test('walletless owner Pons sponsorship is session-bound and cannot redirect fees or signers', async () => {
  const p=metadata.profilePreview(agentId,{...agent,walletAddress:null,walletAddressVerifiedAt:null},'owner');
  const session=sessions.reviewSession({id:'11111111-1111-4111-8111-111111111111',agentId,role:'owner',metadata:p.metadata,profileRevision:metadata.profileRevision(agent),verifiedOwnerEvm:null,verifiedOwnerSolana:null,
    choices:[{platform:'pons',mode:'managed',signer:policy.HIVE_LAUNCH_WALLET,purchase:'0'}]});
  const db={collection:()=>({findOne:async()=>({session})})};
  const frozen=await sessionAccess.sessionPonsPreview(db,p,session.id);
  assert.deepEqual(frozen.issues,[]);
  managed.requireManagedAdmin(frozen,false);
  assert.ok(authorization.launchReview(frozen,policy.HIVE_LAUNCH_WALLET,{symbol:'TEST',purchase:'0'}));
  assert.throws(()=>authorization.launchReview({...frozen,recipient:account.address},policy.HIVE_LAUNCH_WALLET,{symbol:'TEST',purchase:'0'}));
  assert.throws(()=>authorization.launchReview(frozen,account.address,{symbol:'TEST',purchase:'0'}));
  assert.throws(()=>managed.requireManagedAdmin({...frozen,sessionId:undefined},false));
  await assert.rejects(sessionAccess.sessionPonsPreview(db,p,'wrong-session'));
  session.targets[0].terms.mode='connected';session.targets[0].terms.signer=account.address;session.targets[0].terms.recipient=account.address;
  const own=await sessionAccess.sessionPonsPreview(db,p,session.id);
  assert.ok(authorization.launchReview(own,account.address,{symbol:'TEST',purchase:'0'}));
  assert.throws(()=>managed.requireManagedAdmin(own,false));
});
