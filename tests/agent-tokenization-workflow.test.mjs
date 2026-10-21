import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { sessions, sessionApproval, sessionEdit, sessionStore, sessionRuntime, solanaJournal, metadata, profileEdit, policy } from '../scripts/tokenization/modules.mjs';
import { agent, agentId } from './helpers/tokenization-fixture.mjs';

const preview = metadata.profilePreview(agentId, agent, 'admin');
const review = (platforms = ['bags', 'pump']) => sessions.reviewSession({ id: randomUUID(), agentId, role: 'admin', metadata: preview.metadata,
  profileRevision: metadata.profileRevision(agent), verifiedOwnerEvm: null, verifiedOwnerSolana: null,
  choices: platforms.map(platform => ({ platform, mode: 'managed', signer: platform === 'pons' ? policy.HIVE_LAUNCH_WALLET : sessions.HIVE_SOLANA_FEE_WALLET, purchase: '0' })) });
function approval(session) {
  return sessionApproval.approveSession({ ...session, estimate: { digest: 'quote', expiresAt: new Date(Date.now() + 60000).toISOString(), limits: { bags: '100', pump: '100' } } }, 'quote');
}
test('one approval is bound to terms and expiry; cost reservations cannot overspend or double-charge a retry', () => {
  const draft = review();
  assert.equal(sessionApproval.approved(draft), false);
  let s = approval(draft);
  assert.equal(sessionApproval.approved(s), true);
  s = sessionApproval.reserveSpend(s, 'bags', 'setup-1', '60');
  assert.equal(sessionApproval.reserveSpend(s, 'bags', 'setup-1', '60'), s);
  assert.throws(() => sessionApproval.reserveSpend(s, 'bags', 'setup-2', '41'), /limit/);
  assert.throws(() => sessionApproval.reserveSpend(s, 'bags', 'setup-1', '61'), /changed/);
  assert.equal(sessionApproval.approved({ ...s, digest: 'changed' }), false);
  assert.equal(sessionApproval.approved({ ...s, paused: true }), false);
  assert.equal(sessionApproval.approved({ ...s, editing: true }), false);
  assert.equal(sessionApproval.approved({ ...s, approval: { ...s.approval, expiresAt: '2000-01-01' } }), false);
  assert.throws(() => sessionApproval.approveSession({ ...draft, estimate: { digest: 'quote', expiresAt: '2000-01-01' } }, 'quote'), /changed/);
});

test('expired Solana recovery requires independent finalized history, expiry and absence on both RPCs', async () => {
  const step = { _id: 'step', phase: 'submitted', signature: 'signature', revision: 1, review: { blockhash: 'hash', lastValidBlockHeight: 100 } };
  let writes = 0;
  const journal = new solanaJournal.SolanaJournal({ collection: () => ({ findOneAndUpdate: async (_q, patch) => { writes++; return { ...step, ...patch.$set }; } }) });
  const rpc = { getGenesisHash: async () => solanaJournal.SOLANA_MAINNET_GENESIS, getBlockHeight: async () => 101,
    isBlockhashValid: async () => ({ value: false }), getSignatureStatuses: async () => ({ value: [null] }), getTransaction: async () => null };
  assert.equal((await journal.reconcile(step, rpc)).phase, 'submitted');
  assert.equal((await journal.reconcile(step, rpc, { ...rpc, getBlockHeight: async () => 100 })).phase, 'submitted');
  assert.equal((await journal.reconcile(step, rpc, { ...rpc, getTransaction: async () => ({ slot: 1 }) })).phase, 'submitted');
  assert.equal((await journal.reconcile(step, rpc, { ...rpc, getSignatureStatuses: async () => ({ value: [{ confirmationStatus: 'confirmed' }] }) })).phase, 'submitted');
  await assert.rejects(journal.reconcile(step, rpc, { ...rpc, getGenesisHash: async () => { throw Error('offline'); } }), /offline/);
  assert.equal(writes, 0);
  assert.equal((await journal.reconcile(step, rpc, rpc)).phase, 'expired');
  assert.equal(writes, 1);
});

const uri = process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
test('receipt progress updates even when the session phase stays confirming', async () => {
  const s = review(['pons']);
  s.targets[0].phase = 'confirming';
  const runtime = new sessionRuntime.SessionRuntime({ collection: () => ({ findOneAndUpdate: async (_query, patch) => ({ session: patch.$set.session }) }) });
  const hash = '0x' + 'a'.repeat(64);
  const included = await runtime.update(s, 'pons', { phase: 'confirming', transactionHash: hash, awaitingFinality: true });
  assert.equal(included.targets[0].transactionHash, hash);
  assert.equal(included.targets[0].awaitingFinality, true);
  assert.equal(included.targets[0].token, undefined);
  assert.equal(await runtime.update(included, 'pons', { phase: 'confirming', transactionHash: hash, awaitingFinality: true }), included);
  const reorg = await runtime.update(included, 'pons', { phase: 'confirming', transactionHash: hash, awaitingFinality: false });
  assert.equal(reorg.targets[0].awaitingFinality, false);
});
if (uri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri)) throw Error('Use isolated loopback MongoDB.');
test('editing and managed execution preserve journals and survive process restarts', { skip: !uri }, async t => {
  const mongo = new MongoClient(uri); await mongo.connect();
  const db = mongo.db('hive_workflow_' + randomUUID().replaceAll('-', ''));
  t.after(async () => { await db.dropDatabase(); await mongo.close(); });
  const a = { ...agent, _id: new ObjectId(agentId), status: 'active' }; await db.collection('agents').insertOne(a);
  const store = new sessionStore.SessionStore(db), runtime = new sessionRuntime.SessionRuntime(db);
  let session = await store.create(review());
  session = await store.save(session, sessions.transitionTarget(session, 'bags', { phase: 'preparing', intentId: 'saved-bags' }));
  await db.collection('agent_launch_solana_steps').insertOne({ _id: 'saved-bags:setup:fee-config', intentId: 'saved-bags', phase: 'confirmed' });
  await db.collection('agent_launch_solana_steps').insertOne({ _id: 'saved-bags:setup:manager', intentId: 'saved-bags', phase: 'submitted' });
  const paused = await runtime.act(preview, { action: 'pause', id: session.id });
  assert.equal(paused.session.editing, true); assert.ok(!paused.session.approval);
  assert.deepEqual(paused.editablePlatforms, ['pump']);
  const changedProfile = await profileEdit.saveAgentProfile(db, agentId, { name: 'Cipher Updated', bio: 'Updated research and security agent.', revision: metadata.profileRevision(a) }, async () => '');
  assert.equal(changedProfile.metadata.name, 'Cipher Updated');
  let draft = { ...review(['pump']), id: session.id, metadata: { ...changedProfile.metadata, symbol: 'NEW' } };
  let revised = await sessionEdit.reviseSession(db, paused.session, draft);
  assert.equal(revised.targets.find(t => t.terms.platform === 'bags').metadata.name, preview.metadata.name, 'pending target retains frozen metadata');
  assert.equal(revised.targets.find(t => t.terms.platform === 'pump').phase, 'queued');
  assert.equal(revised.approval, undefined);
  session = await store.revise(paused.session, revised);
  assert.equal(await db.collection('agent_launch_session_history').countDocuments(), 1);
  await assert.rejects(store.revise(paused.session, revised), /changed/);
  await db.collection('agent_launch_solana_steps').updateOne({ _id: 'saved-bags:setup:manager' }, { $set: { phase: 'expired' } });
  revised = await sessionEdit.reviseSession(db, session, { ...draft, targets: [], digest: 'cancelled' });
  assert.ok(revised.targets.every(t => t.phase === 'skipped'));
  session = await store.revise(session, revised);
  assert.equal(await db.collection('agent_launch_solana_steps').countDocuments(), 2, 'old setup receipts remain saved');

  const before = { ...process.env };
  Object.assign(process.env, { AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED: 'true', AGENT_MULTI_PLATFORM_RECOVERY_ENABLED: 'true', TOKENIZATION_JOURNAL_KEY: '9'.repeat(64),
    CRON_SECRET: 'fixture', CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'fixture' });
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  const currentAgent = await db.collection('agents').findOne({ _id: a._id });
  session = await store.create({ ...review(['pump']), profileRevision: metadata.profileRevision(currentAgent) });
  session = await store.save(session, approval(session));
  let signed = 0, step;
  runtime.solana = {
    pendingStep: async () => step,
    prepare: async () => (step = { _id: 'pump:launch', phase: 'review', review: { digest: 'same', maximumDebit: '50', expiresAt: new Date(Date.now()+60000).toISOString() } }),
    reconcile: async () => ({ phase: step?.phase === 'submitted' ? 'confirming' : 'awaiting-signature' }),
    confirm: async () => { signed++; step.phase = 'submitted'; }, review: async () => null, rebroadcast: async () => {},
  };
  const result = await runtime.act(preview, { action: 'advance', id: session.id });
  assert.equal(result.session.targets[0].phase, 'submitted'); assert.equal(signed, 1);
  const restarted = new sessionRuntime.SessionRuntime(db); restarted.solana = runtime.solana;
  await restarted.act(preview, { action: 'advance', id: session.id });
  assert.equal(signed, 1, 'restart does not sign again');
  await restarted.act(preview, { action: 'pause', id: session.id });
  await restarted.act(preview, { action: 'advance', id: session.id });
  assert.equal(signed, 1, 'editing revokes execution approval');

  // A launch that ran out of funds after setup must not ask for approval again
  // until its pending unsigned transaction can simulate successfully.
  step.phase = 'review';
  runtime.solana.prepare = async (_session, _target, _preview, options) => {
    assert.equal(options.refreshReview, true);
    throw new sessions.SessionConflict('The Solana launch wallet needs more SOL for fees and account rent.');
  };
  const unfunded = await runtime.act(preview, { action: 'estimate', id: session.id });
  assert.equal(unfunded.session.paused, true);
  assert.ok(!unfunded.session.estimate);
  assert.ok(!unfunded.session.approval);
  assert.match(unfunded.session.targets[0].error, /needs more SOL/);
  await assert.rejects(runtime.act(preview, { action: 'approve', id: session.id, confirmation: 'quote' }), /changed/);
  assert.equal(signed, 1, 'preflight failure never signs');
  runtime.solana.prepare = async () => step;
  const funded = await runtime.act(preview, { action: 'estimate', id: session.id });
  assert.ok(funded.session.estimate);
  assert.ok(!funded.session.targets[0].error);
  assert.ok(!funded.session.approval, 'funding alone is not execution approval');
  assert.equal(signed, 1);
});
