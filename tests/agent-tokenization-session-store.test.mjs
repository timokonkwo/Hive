import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { sessions, sessionStore, sessionAccess, sessionRuntime, solanaRuntime, metadata, profileEdit, solanaJournal } from '../scripts/tokenization/modules.mjs';
import { agent, agentId } from './helpers/tokenization-fixture.mjs';
import { Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
const uri = process.env.HIVE_TOKENIZATION_TEST_MONGO_URI;
if (uri && !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri)) throw Error('Tests require an isolated loopback database.');
test('multi-platform reservations, publication and signed Solana journal are durable and fenced', { skip: !uri }, async t => {
  const mongo = new MongoClient(uri); await mongo.connect();
  const db = mongo.db('hive_sessions_' + randomUUID().replaceAll('-', ''));
  t.after(async () => { await db.dropDatabase(); await mongo.close(); });
  const a = { ...agent, _id: new ObjectId(agentId) }; await db.collection('agents').insertOne(a);
  const preview = metadata.profilePreview(agentId, a, 'admin'), store = new sessionStore.SessionStore(db);
  const review = (platforms = ['bags','pump','pons']) => sessions.reviewSession({ id: randomUUID(), agentId, role: 'admin',
    metadata: preview.metadata, profileRevision: metadata.profileRevision(a), verifiedOwnerEvm: null, verifiedOwnerSolana: null,
    choices: platforms.map(platform => ({ platform, mode: 'connected', signer: platform === 'pons' ? '0x'+'1'.repeat(40) : sessions.HIVE_SOLANA_FEE_WALLET, purchase: '0' })) });
  let session;
  await t.test('two overlapping tabs cannot both reserve, while a lost create response resumes the same review', async () => {
    const one = review(), two = review();
    const results = await Promise.allSettled([store.create(one), store.create(two)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    session = results.find(r => r.status === 'fulfilled').value;
    assert.deepEqual(await store.create(session), session);
    await assert.rejects(store.create({ ...session, digest: '0'.repeat(64) }), /another review/);
  });
  await t.test('standalone Pons and profile edits cannot bypass a reserved batch', async () => {
    await assert.rejects(sessionAccess.sessionPonsPreview(db, preview), /multi-platform/);
    await assert.rejects(sessionAccess.sessionPonsPreview(db, preview, session.id), /earlier platform/);
    await assert.rejects(profileEdit.saveAgentProfile(db, agentId, { name: 'Changed', bio: 'Changed description', revision: metadata.profileRevision(a) }, async () => ''), /already has a launch/);
  });
  await t.test('CAS admits one transition and verified successes publish once without overwriting earlier tokens', async () => {
    const next = sessions.transitionTarget(session, 'bags', { phase: 'preparing', intentId: 'bags-intent' });
    const results = await Promise.allSettled([store.save(session, next), store.save(session, next)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); session = next;
    const token = { platform: 'bags', network: 'solana', symbol: 'SAGE', address: sessions.HIVE_SOLANA_FEE_WALLET, transactionHash: '2'.repeat(88), launchedAt: new Date().toISOString() };
    const confirmed = sessions.transitionTarget(session, 'bags', { phase: 'confirmed', token });
    session = await store.save(session, confirmed); await store.publish(agentId, 'bags'); await store.publish(agentId, 'bags');
    assert.equal(await db.collection('agent_token_catalog').countDocuments(), 1);
    assert.equal((await db.collection('agents').findOne({ _id: a._id })).agentTokens.length, 1);
    assert.equal((await store.current(agentId)).projectionPending, false);
    const blocked = sessions.transitionTarget(session, 'pump', { phase: 'preparing', intentId: 'pump-intent' });
    session = await store.save(session, blocked);
    await assert.rejects(store.create(review(['pons'])), /Resume the current/);
  });
  await t.test('an authorized Solana transaction persists before broadcast; retries cannot sign a replacement', async () => {
    const before = process.env.TOKENIZATION_JOURNAL_KEY; process.env.TOKENIZATION_JOURNAL_KEY = '9'.repeat(64);
    t.after(() => { if (before === undefined) delete process.env.TOKENIZATION_JOURNAL_KEY; else process.env.TOKENIZATION_JOURNAL_KEY = before; });
    const payer = Keypair.generate(), recipient = Keypair.generate();
    const tx = new VersionedTransaction(new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(),
      instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient.publicKey, lamports: 1 })] }).compileToV0Message());
    const journal = new solanaJournal.SolanaJournal(db), digest = solanaJournal.messageDigest(tx);
    const step = await journal.reserve({ _id: randomUUID(), agentId, sessionId: session.id, intentId: 'fixture', signer: payer.publicKey.toBase58(), mint: recipient.publicKey.toBase58(),
      phase: 'review', revision: 0, createdAt: new Date(), review: { transaction: Buffer.from(tx.serialize()).toString('base64'), digest, blockhash: tx.message.recentBlockhash,
        maximumDebit: '5001', networkFee: '5000', expiresAt: new Date(Date.now()+60000).toISOString() } });
    tx.sign([payer]); let broadcasts = 0;
    const connection = { isBlockhashValid: async () => ({ value: true }), getGenesisHash: async () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      sendRawTransaction: async () => { broadcasts++; const saved = await journal.get(step._id); assert.ok(saved.submission); return saved.signature; } };
    const results = await Promise.allSettled([journal.authorize(step, digest, tx.serialize(), connection), journal.authorize(step, digest, tx.serialize(), connection)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const saved = await journal.get(step._id); await journal.broadcast(saved, connection); await journal.broadcast(saved, connection);
    assert.equal(broadcasts, 2); assert.equal((await journal.get(step._id)).signature, saved.signature);
    await assert.rejects(journal.refresh(step, { ...step.review, digest: '0'.repeat(64) }), /changed/);
    const missing = await journal.reconcile(saved, { ...connection, getSignatureStatuses: async () => ({ value: [null] }) });
    assert.equal(missing.phase, 'submitted');
  });
  await t.test('a crash after saving submission is recovered even while the session still shows a review', async () => {
    const active = session.targets.find(t => t.terms.platform === 'pump');
    assert.equal(active.phase, 'preparing');
    const payer = Keypair.generate(), tx = new VersionedTransaction(new TransactionMessage({
      payerKey: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [],
    }).compileToV0Message());
    tx.sign([payer]);
    const signature = '3'.repeat(88);
    await db.collection('agent_launch_solana_intents').insertOne({
      _id: active.intentId, sessionId: session.id, agentId, platform: 'pump', mint: payer.publicKey.toBase58(),
      setupSteps: [], launchStep: 'crash-step', createdAt: new Date(),
    });
    await db.collection('agent_launch_solana_steps').insertOne({
      _id: 'crash-step', intentId: active.intentId, sessionId: session.id, agentId, phase: 'submitted', revision: 1,
      signer: payer.publicKey.toBase58(), mint: payer.publicKey.toBase58(), signature, createdAt: new Date(),
      review: { transaction: Buffer.from(tx.serialize()).toString('base64') },
    });
    const connection = {
      getGenesisHash: async () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      getSignatureStatuses: async () => ({ value: [{ slot: 123, confirmationStatus: 'finalized', err: { InstructionError: [0, 'Custom'] } }] }),
      getTransaction: async () => ({ slot: 123, meta: { err: { InstructionError: [0, 'Custom'] } },
        transaction: { signatures: [signature], message: tx.message } }),
    };
    const runtime = new sessionRuntime.SessionRuntime(db);
    runtime.solana = new solanaRuntime.SolanaLaunchRuntime(db, connection);
    assert.deepEqual(await sessionRuntime.recoverLaunchSessions(db, 25000, runtime), { checked: 1, errors: 0 });
    session = (await store.current(agentId)).session;
    assert.equal(session.targets.find(t => t.terms.platform === 'pump').phase, 'failed');
    assert.equal(session.paused, true);
    assert.equal(session.targets.find(t => t.terms.platform === 'pons').phase, 'queued');
    assert.ok((await store.current(agentId)).recoveredAt instanceof Date);
  });
  await t.test('abandoned reviews rotate out of the recovery batch instead of starving later submissions', async () => {
    const records = db.collection('agent_launch_sessions'), visited = [];
    for (let i = 0; i < 7; i++) {
      const id = new ObjectId().toString(), pending = { ...session, agentId: id, id: randomUUID(),
        targets: [{ terms: { platform: 'pump' }, phase: 'awaiting-signature' }] };
      await records.insertOne({ _id: id, session: pending, updatedAt: new Date(0), revision: 0, tokens: [] });
    }
    const runtime = {
      require: async id => (await records.findOne({ _id: id })).session,
      reconcile: async saved => { visited.push(saved.agentId); return saved; },
    };
    await sessionRuntime.recoverLaunchSessions(db, 25000, runtime);
    await sessionRuntime.recoverLaunchSessions(db, 25000, runtime);
    assert.equal(new Set(visited).size, 7);
  });
});
