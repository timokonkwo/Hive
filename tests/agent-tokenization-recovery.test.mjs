import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TransactionNotFoundError } from 'viem';
import { journal, worker } from '../scripts/tokenization/modules.mjs';
import { preparedFor, intentFixture, chainFixture, hash, replacementHash } from './helpers/tokenization-fixture.mjs';

test('journal preserves uint256 precision and detects corruption', () => {
  const prepared = preparedFor();
  prepared.maximumTotal = 2n ** 256n - 1n;
  const envelope = journal.packPrepared(prepared);
  assert.deepEqual(journal.unpackPrepared(envelope), prepared);
  assert.throws(() => journal.unpackPrepared({ ...envelope, payload: envelope.payload + ' ' }), /damaged/);
  assert.throws(() => journal.unpackPrepared({ ...envelope, version: 2 }), /damaged/);
  for (const value of [-1n, 2n ** 256n]) assert.throws(() => journal.unpackPrepared(journal.packPrepared({ value })), /amount/);
  for (const item of [{ $uint: '01' }, { $uint: '1', extra: true }, { $uint: 5 }]) {
    const payload = JSON.stringify(item);
    assert.throws(() => journal.unpackPrepared({ version: 1, payload, digest: createHash('sha256').update(payload).digest('hex') }), /amount/);
  }
});

test('recovery discovers a finalized launch after the browser loses its hash', async () => {
  const intent = intentFixture(), { client } = chainFixture(intent);
  const patch = await worker.recoverLaunch(client, intent);
  assert.equal(patch.phase, 'confirmed'); assert.equal(patch.transactionHash, hash);
  assert.equal(patch.token.transactionHash, hash);
});

test('successful inclusion is visible while finality waits, without publishing or replacing the launch', async () => {
  const intent = { ...intentFixture(), transactionHash: hash };
  const { client } = chainFixture(intent);
  const getBlock = client.getBlock;
  client.getBlock = args => args.blockTag === 'finalized' ? Promise.resolve({ number: 9n, hash }) : getBlock(args);
  const waiting = await worker.recoverLaunch(client, intent);
  assert.equal(waiting.phase, 'confirming');
  assert.equal(waiting.receiptConfirmed, true);
  assert.equal(waiting.transactionHash, hash);
  assert.equal(waiting.token, undefined);
  client.getBlock = getBlock;
  assert.equal((await worker.recoverLaunch(client, intent)).phase, 'confirmed');
  client.getBlock = async () => ({ number: 9n, hash: replacementHash });
  const reorganized = await worker.recoverLaunch(client, intent);
  assert.equal(reorganized.receiptConfirmed, false, 'an observed reorg clears the inclusion status');
  assert.equal(reorganized.token, undefined);
});

test('recovery finds a matching replacement when the original hash disappeared', async () => {
  const intent = { ...intentFixture(), transactionHash: hash };
  const { client, actual } = chainFixture(intent, replacementHash);
  client.getTransaction = async ({ hash: requested }) => {
    if (requested === hash) throw new TransactionNotFoundError({ hash });
    return actual;
  };
  const patch = await worker.recoverLaunch(client, intent);
  assert.equal(patch.phase, 'confirmed'); assert.equal(patch.transactionHash, replacementHash);
});

test('recovery bounds log scans and does not release unconsumed nonces', async () => {
  const intent = intentFixture(), { client } = chainFixture(intent);
  let range;
  client.getBlock = async () => ({ number: 10000n, hash });
  client.getLogs = async args => { range = args; return []; };
  client.getTransactionCount = async () => { throw Error('Must finish historical scan first'); };
  assert.deepEqual(await worker.recoverLaunch(client, intent), { phase: 'awaiting-signature', nextBlock: '2010' });
  assert.equal(range.fromBlock, 10n); assert.equal(range.toBlock, 2009n);
  client.getBlock = async () => ({ number: 20n, hash });
  client.getTransactionCount = async () => 4;
  assert.deepEqual(await worker.recoverLaunch(client, intent), { phase: 'awaiting-signature', nextBlock: '21' });
});

test('only finalized nonce consumption plus absent token permits cancellation', async () => {
  const intent = intentFixture(), { client } = chainFixture(intent);
  client.getLogs = async () => [];
  client.getTransactionCount = async ({ blockNumber }) => { assert.equal(blockNumber, 20n); return 5; };
  assert.deepEqual(await worker.recoverLaunch(client, intent), { phase: 'cancelled', cancellationEvidence: { blockNumber: '20', blockHash: hash, consumedNonce: 5 } });
  client.getCode = async () => '0x6001';
  const result = await worker.recoverLaunch(client, intent);
  assert.equal(result.phase, 'confirming'); assert.equal(result.nextBlock, '10'); assert.match(result.lastError, /review/);
});

test('reorgs preserve the cursor and reservation; RPC failures cannot become retries', async () => {
  const intent = intentFixture(), { client } = chainFixture(intent);
  client.getLogs = async () => [];
  let blocks = 0;
  client.getBlock = async () => ({ number: 20n, hash: ++blocks === 3 ? replacementHash : hash });
  assert.deepEqual(await worker.recoverLaunch(client, intent), { phase: 'confirming' });
  blocks = 0;
  client.getBlock = async () => ({ number: 20n, hash: ++blocks === 4 ? replacementHash : hash });
  client.getTransactionCount = async () => 5;
  assert.deepEqual(await worker.recoverLaunch(client, intent), { phase: 'confirming' });
  client.getLogs = async () => { throw Error('RPC offline'); };
  await assert.rejects(worker.recoverLaunch(client, intent), /RPC offline/);
});

test('ambiguous logs, wrong chain and damaged intent fail closed', async () => {
  const intent = intentFixture(), { client } = chainFixture(intent);
  client.getLogs = async () => [{ transactionHash: hash }, { transactionHash: replacementHash }];
  await assert.rejects(worker.recoverLaunch(client, intent), /More than one/);
  await assert.rejects(worker.recoverLaunch({ ...client, getChainId: async () => 1 }, intent), /wrong chain/);
  await assert.rejects(worker.recoverLaunch(client, { ...intent, nonce: 5 }), /identity/);
});

test('broadcast registration rejects unrelated transactions before writing', async () => {
  const intent = intentFixture(), { client, actual } = chainFixture(intent);
  let writes = 0;
  const store = { recordHash: async (_intent, saved) => { writes++; return saved; } };
  assert.equal(await worker.acceptBroadcast(client, store, intent, hash), hash);
  for (const patch of [{ nonce: 5 }, { value: 0n }, { input: '0x1234' }, { from: actual.to }, { to: actual.from }, { hash: replacementHash }]) {
    await assert.rejects(worker.acceptBroadcast({ ...client, getTransaction: async () => ({ ...actual, ...patch }) }, store, intent, hash), /does not match/);
  }
  assert.equal(writes, 1);
});
