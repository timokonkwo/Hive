import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as viem from 'viem';
import { MongoClient, ObjectId } from 'mongodb';
import * as modules from '../scripts/tokenization/modules.mjs';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { agent, agentId, preparedFor } from './helpers/tokenization-fixture.mjs';
const { store, sessions, sessionStore, sessionApproval, metadata, policy, authorization } = modules;
const uri = process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if (uri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri)) throw Error('Use isolated loopback MongoDB.');
const load = (name, imports) => loadTypeScript(new URL(`../lib/agent-tokenization/${name}.ts`, import.meta.url), imports);
const preview = metadata.profilePreview(agentId, agent, 'admin');
const choices = { symbol: 'RESEARCH', purchase: '0' };
async function database(t) {
  const mongo = new MongoClient(uri); await mongo.connect();
  const db = mongo.db('hive_queue_' + crypto.randomUUID().replaceAll('-', ''));
  t.after(async () => { await db.dropDatabase(); await mongo.close(); });
  await db.collection('agents').insertOne({ ...agent, _id: new ObjectId(agentId) });
  return db;
}
const reserve = (db, p, id = crypto.randomUUID()) => new store.LaunchStore(db).reserve(p, policy.HIVE_LAUNCH_WALLET, new Date(),
  { id, ...authorization.launchReview(p, policy.HIVE_LAUNCH_WALLET, choices), mode: 'managed' });

test('managed contention reconciles the blocking agent without discarding its reservation', { skip: !uri }, async t => {
  const db = await database(t), launches = new store.LaunchStore(db);
  const blocker = await reserve(db, { ...preview, agentId: 'a'.repeat(24) });
  let release = false, checks = 0;
  const managed = load('managed', {
    'node:crypto': crypto, viem, './authorization': authorization, './policy': policy, './journal': modules.journal,
    './store': store, './managed-signer': { managedDeployerStatus: () => ({ available: true }) }, './transaction': {}, './snapshot': {},
    './preparation': { prepareVerifiedLaunch: (_db, _rpc, p, auth) => reserve(db, p, auth._id) },
    './worker': { runLaunchRecovery: async (_db, _rpc, options) => {
      checks++; assert.equal(options.agentId, blocker.agentId); assert.equal(options.limit, 1);
      if (release) {
        // Only the receipt worker can release an in-flight reservation.
        const claimed = await launches.claim();
        await launches.finish(claimed, { phase: 'reverted' });
      }
    } },
  });
  await assert.rejects(managed.prepareManagedLaunch(db, {}, preview, choices, {}), error => error instanceof store.ManagedDeployerBusy && error.agentId === blocker.agentId);
  assert.equal(checks, 1);
  assert.equal(await db.collection('pons_launch_intents').countDocuments(), 1);
  assert.equal((await launches.current(blocker.agentId)).managedPending, true, 'unsigned review is never discarded to clear contention');
  await assert.rejects(reserve(db, { ...preview, agentId: blocker.agentId }), error => error instanceof store.LaunchConflict && !(error instanceof store.ManagedDeployerBusy), 'same-agent conflict is not classified as queue contention');
  await db.collection('pons_launch_intents').updateOne({ _id: blocker._id }, { $set: { phase: 'confirming', managedSubmission: { ciphertext: 'fixture' } } });
  release = true;
  const ready = await managed.prepareManagedLaunch(db, {}, preview, choices, {});
  assert.equal(checks, 2);
  assert.equal(ready.agentId, agentId);
  assert.equal(ready.phase, 'draft');
  assert.equal((await launches.current(blocker.agentId)).phase, 'reverted');
});

function runtimeFor(db, prepare, confirm) {
  const { SessionRuntime } = load('session-runtime', {
    'node:crypto': crypto, mongodb: { ObjectId }, viem,
    './session-store': sessionStore, './session': sessions, './solana-runtime': modules.solanaRuntime,
    './store': store, './worker': modules.worker, './session-preview': modules.sessionPreview,
    './profile-lease': modules.profileLease, './session-approval': { ...sessionApproval, prepareSessionPons: prepare, confirmSessionPons: confirm },
    './session-edit': modules.sessionEdit, './journal': modules.journal, './metadata': metadata, './managed': modules.managed,
  });
  return new SessionRuntime(db);
}
async function approvedBatch(db) {
  const records = new sessionStore.SessionStore(db);
  let session = await records.create(sessions.reviewSession({ id: crypto.randomUUID(), agentId, role: 'admin', metadata: preview.metadata,
    profileRevision: metadata.profileRevision(agent), verifiedOwnerEvm: null, verifiedOwnerSolana: null,
    choices: ['pump', 'pons'].map(platform => ({ platform, mode: 'managed', purchase: '0',
      signer: platform === 'pons' ? policy.HIVE_LAUNCH_WALLET : sessions.HIVE_SOLANA_LAUNCH_WALLET })) }));
  session = await records.save(session, sessions.transitionTarget(session, 'pump', { phase: 'preparing', intentId: 'saved-pump' }));
  session = await records.save(session, sessions.transitionTarget(session, 'pump', { phase: 'confirmed', token: { platform: 'pump', network: 'solana',
    address: sessions.HIVE_SOLANA_FEE_WALLET, symbol: 'RESEARCH', transactionHash: '2'.repeat(88), launchedAt: new Date().toISOString() } }));
  session = await records.save(session, sessionApproval.approveSession({ ...session,
    estimate: { digest: 'quote', limits: { pons: '1000000000000000' }, expiresAt: new Date(Date.now() + 60000).toISOString() } }, 'quote'));
  return { records, session };
}

test('approved launches wait across restarts, then resume without another approval or repeating completed platforms', { skip: !uri }, async t => {
  const db = await database(t), launches = new store.LaunchStore(db);
  const blocker = await reserve(db, { ...preview, agentId: 'a'.repeat(24) });
  const { records, session } = await approvedBatch(db);
  let signed = 0;
  const prepare = async () => {
    const intent = await reserve(db, preview);
    return { intent: await launches.expose(intent, preparedFor(intent)) };
  };
  const runtime = runtimeFor(db, prepare, async () => { signed++; });
  const first = (await runtime.act(preview, { id: session.id, action: 'advance' })).session;
  assert.equal(first.paused, false);
  assert.deepEqual(first.approval, session.approval);
  assert.equal(first.targets[1].waitingForDeployer, true);
  assert.ok(!first.targets[1].error);
  assert.ok(!first.targets[1].intentId);
  assert.equal(signed, 0);
  const restarted = runtimeFor(db, prepare, async () => { signed++; });
  const second = (await restarted.act(preview, { id: session.id, action: 'advance' })).session;
  assert.equal(second.revision, first.revision, 'waiting polls do not rewrite unchanged progress');
  await launches.cancelDraft(blocker); // Explicit fixture cancellation, never automatic queue behavior.
  await modules.sessionRuntime.recoverLaunchSessions(db, 25000, restarted);
  const resumed = (await records.current(agentId)).session;
  assert.equal(resumed.targets[1].phase, 'submitted');
  assert.equal(resumed.targets[1].waitingForDeployer, false);
  assert.equal(resumed.paused, false);
  assert.equal(resumed.approval.digest, session.approval.digest);
  assert.equal(resumed.approval.expiresAt, session.approval.expiresAt);
  assert.equal(Object.keys(resumed.approval.reserved).length, 1);
  assert.equal(signed, 1);
  assert.deepEqual(resumed.targets[0], session.targets[0]);
  assert.equal((await db.collection('agents').findOne({ _id: new ObjectId(agentId) })).agentTokens[0].address, session.targets[0].token.address);
});

test('waiting never bypasses a pause, an expired approval or a real preparation failure', { skip: !uri }, async t => {
  const db = await database(t), { records, session } = await approvedBatch(db);
  let calls = 0, signed = 0, busy = true;
  const runtime = runtimeFor(db, async () => { calls++; throw busy ? new store.ManagedDeployerBusy('a'.repeat(24)) : new store.LaunchConflict('Launch pricing changed.'); }, async () => { signed++; });
  let current = (await runtime.act(preview, { id: session.id, action: 'advance' })).session;
  await runtime.act(preview, { id: session.id, action: 'pause' });
  await runtime.act(preview, { id: session.id, action: 'advance' });
  assert.equal(calls, 1);
  current = (await records.current(agentId)).session;
  current = await records.save(current, { ...current, editing: false, paused: false, approval: { ...session.approval, expiresAt: '2000-01-01' }, revision: current.revision + 1 });
  current = (await runtime.act(preview, { id: session.id, action: 'advance' })).session;
  assert.equal(calls, 1);
  assert.ok(!current.approval);
  assert.equal(current.paused, true);
  current = await records.save(current, { ...current, paused: false, approval: session.approval, revision: current.revision + 1 });
  busy = false;
  const failed = (await runtime.act(preview, { id: session.id, action: 'advance' })).session;
  assert.equal(failed.paused, true);
  assert.ok(!failed.approval);
  assert.match(failed.targets[1].error, /pricing changed/);
  assert.equal(signed, 0);
});
