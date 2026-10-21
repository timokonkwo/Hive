import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { privateKeyToAccount } from 'viem/accounts';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { store as stores, worker, authorization, metadata, journal, profileLease, sessionAccess } from '../scripts/tokenization/modules.mjs';
import { preview, signer, token, hash, replacementHash, agentId, agent, preparedFor, chainFixture } from './helpers/tokenization-fixture.mjs';

// Opt-in, loopback only, random disposable DB. Never use the application's DB.
const uri = process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if (uri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri)) throw Error('Tests require a bare loopback MongoDB URI.');
test('MongoDB launch journal concurrency and crash recovery', { skip: !uri }, async t => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  t.after(() => client.close());
  async function fixture(t) {
    const db = client.db(`hive_pons_test_${randomUUID().replaceAll('-', '')}`);
    t.after(() => db.dropDatabase());
    const store = new stores.LaunchStore(db);
    await store.ensureIndexes();
    return { db, store, intents: db.collection('pons_launch_intents') };
  }
  await t.test('concurrent owner/admin attempts reserve one agent; drafts alone may be cancelled', async t => {
    const { store, intents } = await fixture(t);
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => store.reserve(i % 2 ? metadata.profilePreview(agentId, agent, 'admin') : preview, signer)));
    assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
    assert.ok(attempts.filter(a => a.status === 'rejected').every(a => a.reason instanceof stores.LaunchConflict));
    const intent = attempts.find(a => a.status === 'fulfilled').value;
    await store.cancelDraft(intent);
    const second = await store.reserve(preview, signer);
    const exposed = await store.expose(second, preparedFor(second));
    await assert.rejects(store.cancelDraft(exposed), /already have reached/);
    assert.equal((await store.current(agentId)).active, true);
    assert.equal((await intents.indexes()).some(i => i.expireAfterSeconds !== undefined), false);
  });
  await t.test('two agents cannot expose transactions with the same signer nonce', async t => {
    const { store } = await fixture(t);
    const intents = await Promise.all([store.reserve(preview, signer), store.reserve({ ...preview, agentId: 'a'.repeat(24) }, signer)]);
    const attempts = await Promise.allSettled(intents.map(intent => store.expose(intent, preparedFor(intent))));
    assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
    assert.ok(attempts.find(a => a.status === 'rejected').reason instanceof stores.LaunchConflict);
    const stale = intents.find(i => i._id === attempts.find(a => a.status === 'fulfilled').value._id);
    await assert.rejects(store.expose(stale, preparedFor(stale)), /changed/);
  });
  await t.test('expired or altered preparations are never exposed', async t => {
    const { store } = await fixture(t);
    const intent = await store.reserve(preview, signer);
    const expired = preparedFor(intent); expired.expiresAt = 1n;
    await assert.rejects(store.expose(intent, expired), /expired/);
    const changed = preparedFor(intent); changed.candidate.params.creatorFeeRecipient = token;
    await assert.rejects(store.expose(intent, changed), /differs/);
    assert.equal((await store.current(agentId)).phase, 'draft');
  });
  await t.test('only one worker owns a lease and a reclaimed lease rejects stale completion', async t => {
    const { store } = await fixture(t);
    const intent = await store.reserve(preview, signer);
    await store.expose(intent, preparedFor(intent));
    const now = new Date();
    const leases = await Promise.all(Array.from({ length: 6 }, () => store.claim(now)));
    assert.equal(leases.filter(Boolean).length, 1);
    const stale = leases.find(Boolean);
    const fresh = await store.claim(new Date(now.getTime() + 121000));
    assert.ok(fresh); assert.notEqual(fresh.leaseId, stale.leaseId);
    assert.equal(await store.finish(stale, { phase: 'cancelled' }), null);
    assert.ok(await store.finish(fresh, { phase: 'confirming' }));
    assert.equal((await store.current(agentId)).phase, 'confirming');
  });
  await t.test('a browser hash update cannot be overwritten by an older worker', async t => {
    const { store } = await fixture(t);
    const draft = await store.reserve(preview, signer);
    const exposed = await store.expose(draft, preparedFor(draft));
    const lease = await store.claim();
    await store.recordHash(exposed, replacementHash);
    assert.equal(await store.finish(lease, { transactionHash: hash }), null);
    assert.equal((await store.current(agentId)).transactionHash, replacementHash);
  });
  await t.test('replacement reviews preserve the reservation and invalidate stale worker and browser writes',async t=>{
    const {store}=await fixture(t);
    const draft=await store.reserve(preview,signer),exposed=await store.expose(draft,preparedFor(draft));
    const lease=await store.claim(),prepared=journal.unpackPrepared(exposed.prepared);
    const cancel={...prepared,maximumTotal:prepared.maximumNetworkFee,transaction:{...prepared.transaction,to:signer,data:'0x',value:0n}};
    const attempts=await Promise.all([store.saveReplacementReview(exposed,'cancel',cancel),store.saveReplacementReview(exposed,'resume',prepared)]);
    assert.equal(attempts.filter(Boolean).length,1);
    assert.equal(await store.finish(lease,{phase:'cancelled'}),null);
    const latest=await store.current(agentId);
    assert.equal(latest.active,true);assert.equal(latest.nonce,4);assert.equal(latest.prepared.digest,exposed.prepared.digest);
    await assert.rejects(store.saveReplacementReview(latest,'resume',{...prepared,transaction:{...prepared.transaction,nonce:5}}),/replacement/);
    await assert.rejects(store.saveReplacementReview(latest,'cancel',{...cancel,transaction:{...cancel.transaction,value:1n}}),/replacement/);
    const submitted=await store.recordCancellation(latest,replacementHash);
    assert.equal(submitted.phase,'confirming');assert.equal(submitted.cancellationHash,replacementHash);assert.equal(submitted.active,true);
    await assert.rejects(store.recordCancellation(latest,hash),/changed/);
    assert.equal((await store.current(agentId)).cancellationHash,replacementHash);
  });
  await t.test('confirmed receipt is saved before profile publication and publication is idempotent', async t => {
    const { store, db } = await fixture(t);
    await db.collection('agents').insertOne({ _id: new ObjectId(agentId), ...agent, tokenMintAddress: 'solana-token' });
    const draft = await store.reserve(preview, signer);
    const exposed = await store.expose(draft, preparedFor(draft));
    const lease = await store.claim();
    const confirmed = await store.finish(lease, await worker.recoverLaunch(chainFixture(exposed).client, exposed));
    // Simulated interruption before writing the agent profile.
    assert.equal((await db.collection('agents').findOne({ _id: new ObjectId(agentId) })).ponsToken, undefined);
    const resumed = await store.claim(new Date(Date.now() + 61000));
    assert.equal(resumed._id, confirmed._id); assert.equal(resumed.phase, 'confirmed');
    await store.publish(resumed); await store.publish(resumed); await store.finish(resumed, {});
    const actual = await db.collection('agents').findOne({ _id: new ObjectId(agentId) });
    assert.equal(actual.ponsToken.address, token); assert.equal(actual.tokenMintAddress, 'solana-token');
    assert.equal((await store.current(agentId)).projected, true);
    assert.equal(await store.claim(new Date(Date.now() + 300000)), null);
    await assert.rejects(store.reserve(preview, signer), /already has a launch/);
  });
  await t.test('worker does not overwrite an existing token and retries projection later', async t => {
    const { store, db, intents } = await fixture(t);
    await db.collection('agents').insertOne({ _id: new ObjectId(agentId), ponsToken: { address: signer } });
    const draft = await store.reserve(preview, signer);
    const exposed = await store.expose(draft, preparedFor(draft));
    const chain = chainFixture(exposed).client;
    assert.deepEqual(await worker.runLaunchRecovery(db, chain), { checked: 1, confirmed: 1, published: 0, errors: 1 });
    assert.equal((await store.current(agentId)).phase, 'confirmed');
    assert.equal((await store.current(agentId)).projected, false);
    assert.equal((await db.collection('agents').findOne({ _id: new ObjectId(agentId) })).ponsToken.address, signer);
    // Operator resolves the conflicting profile record, then the next cron retries.
    await db.collection('agents').updateOne({ _id: new ObjectId(agentId) }, { $unset: { ponsToken: '' } });
    await intents.updateOne({ _id: draft._id }, { $set: { nextCheckAt: new Date(0) } });
    assert.deepEqual(await worker.runLaunchRecovery(db, chain), { checked: 1, confirmed: 0, published: 1, errors: 0 });
  });
  await t.test('RPC failures leave a reserved, retryable job without leaking provider secrets', async t => {
    const { store, db } = await fixture(t);
    const draft = await store.reserve(preview, signer);
    const exposed = await store.expose(draft, preparedFor(draft));
    const chain = { ...chainFixture(exposed).client, getLogs: async () => { throw Error('https://secret-token@rpc.test'); } };
    const result = await worker.runLaunchRecovery(db, chain);
    assert.equal(result.errors, 1);
    const saved = await store.current(agentId);
    assert.equal(saved.active, true); assert.equal(saved.phase, 'awaiting-signature');
    assert.equal(saved.leaseId, undefined); assert.doesNotMatch(saved.lastError, /secret-token/);
    await assert.rejects(store.reserve(preview, signer), /already has a launch/);
  });
  await t.test('finalized cancellation releases the agent but never recycles its consumed nonce', async t => {
    const { store, db } = await fixture(t);
    const draft = await store.reserve(preview, signer);
    const exposed = await store.expose(draft, preparedFor(draft));
    const chain = { ...chainFixture(exposed).client, getLogs: async () => [], getTransactionCount: async () => 5 };
    await worker.runLaunchRecovery(db, chain);
    const cancelled = await store.current(agentId);
    assert.equal(cancelled.phase, 'cancelled'); assert.equal(cancelled.active, false);
    assert.equal(cancelled.cancellationEvidence.consumedNonce, 5);
    const next = await store.reserve(preview, signer);
    await assert.rejects(store.expose(next, preparedFor(next, 4)), /nonce/);
    assert.equal((await store.expose(next, preparedFor(next, 5))).nonce, 5);
  });
  await t.test('replayed wallet proof returns one reservation and cannot resurrect a cancelled launch', async t => {
    const { db, store } = await fixture(t);
    const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
    const current = metadata.profilePreview(agentId, { ...agent, walletAddress: account.address }, 'owner');
    const auth = new authorization.LaunchAuthorizations(db, 'https://uphive.xyz');
    const challenge = await auth.issue(current, account.address, { symbol: 'RESEARCH', purchase: '0' });
    const signature = await account.signMessage({ message: challenge.message });
    const verified = await auth.verify(challenge.id, signature, current);
    const grant = { id: verified._id, digest: verified.digest, choices: verified.choices };
    const attempts = await Promise.all(Array.from({length:6}, () => store.reserve(current, account.address, new Date(), grant)));
    assert.equal(new Set(attempts.map(a => a._id)).size, 1);
    assert.equal(new Set(attempts.map(a => a.salt)).size, 1);
    await store.cancelDraft(attempts[0]);
    await assert.rejects(store.reserve(current, account.address, new Date(), grant), /already has/);
    const indexes = await db.collection('pons_launch_authorizations').indexes();
    assert.equal(indexes.find(i => i.name === 'expired_launch_authorizations').expireAfterSeconds, 0);
  });

  async function preparationFixture(t) {
    const { db, store, intents } = await fixture(t);
    const account = privateKeyToAccount(`0x${'1'.repeat(64)}`);
    const current = metadata.profilePreview(agentId, { ...agent, walletAddress: account.address }, 'owner');
    const auth = new authorization.LaunchAuthorizations(db, 'https://uphive.xyz');
    const challenge = await auth.issue(current, account.address, { symbol: 'RESEARCH', purchase: '0' });
    const signature = await account.signMessage({ message: challenge.message });
    const request = { origin: 'https://uphive.xyz', preview: current, challengeId: challenge.id, signature };
    const trace = [];
    const coordinator = loadTypeScript(new URL('../lib/agent-tokenization/preparation.ts',import.meta.url), {
      './session-access': sessionAccess,
      './authorization': authorization, './store': stores, './profile-lease': profileLease,
      './snapshot': { readLaunchSnapshot: async () => { trace.push('snapshot'); return { blockNumber: 10n }; }, assertReviewedRelease: () => {} },
      './transaction': { prepareReviewedLaunch: async (_client, preview, choices) => {
        trace.push('simulate');
        return preparedFor({ preview, signer: choices.signer, salt: choices.salt });
      } },
    });
    const client = { getCode: async () => '0x' };
    const services = { release: { reviewed: true }, refreshPreview: async () => current,
      persistAvatar: async () => { trace.push('upload'); return preparedFor().candidate.params.logo; } };
    const run = overrides => coordinator.prepareAuthorizedLaunch(db, client, request, { ...services, ...overrides });
    return { db, store, intents, current, client, services, run, request, trace };
  }

  await t.test('preparation saves one exact transaction and replay performs no new upload/simulation', async t => {
    const f = await preparationFixture(t);
    const result = await f.run();
    assert.equal(result.phase, 'awaiting-signature'); assert.ok(result.prepared); assert.equal(result.leaseId, undefined);
    assert.deepEqual(f.trace, ['snapshot','upload','snapshot','simulate']);
    const resumed = await f.run();
    assert.equal(resumed._id, result._id); assert.deepEqual(resumed.prepared, result.prepared);
    assert.equal(f.trace.length, 4);
  });

  await t.test('preparation lock prevents duplicate uploads while the first request is running', async t => {
    const f = await preparationFixture(t);
    let unblock, began;
    const waiting = new Promise(resolve => { unblock = resolve; });
    const started = new Promise(resolve => { began = resolve; });
    const first = f.run({ persistAvatar: async () => { began(); await waiting; return f.services.persistAvatar(); } });
    await started;
    try {
      assert.equal((await f.store.current(agentId)).prepared, undefined);
      await assert.rejects(f.run(), /being updated or prepared/);
    } finally { unblock(); }
    assert.equal((await first).phase, 'awaiting-signature');
    assert.equal(f.trace.filter(step => step === 'upload').length, 1);
  });

  await t.test('upload failure releases the preparation lock and retry uses the same salt', async t => {
    const f = await preparationFixture(t);
    await assert.rejects(f.run({ persistAvatar: async () => { throw Error('Provider offline'); } }), /Provider offline/);
    const before = await f.store.current(agentId);
    assert.equal(before.phase, 'draft'); assert.equal(before.leaseId, undefined);
    const result = await f.run();
    assert.equal(result.salt, before.salt); assert.equal(result._id, before._id);
  });

  await t.test('profile changes, smart accounts and unreviewed releases cannot expose a transaction', async t => {
    const f = await preparationFixture(t);
    await assert.rejects(f.run({ release: { reviewed: false } }), /review/);
    assert.equal(await f.store.current(agentId), null);
    f.client.getCode = async () => '0x6001';
    await assert.rejects(f.run(), /Smart account/);
    assert.equal(f.trace.includes('upload'), false);
    f.client.getCode = async () => '0x';
    let reads = 0;
    await assert.rejects(f.run({ refreshPreview: async () => ++reads === 1 ? f.current : { ...f.current, metadata: { ...f.current.metadata, name: 'Changed' } } }), /changed/);
    const saved = await f.store.current(agentId);
    assert.equal(saved.phase, 'draft'); assert.equal(saved.prepared, undefined); assert.ok(saved.logoURI);
    assert.equal(saved.leaseId, undefined);
  });

});
