import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as solana from '@solana/web3.js';
import bs58 from 'bs58';
import * as spl from '@solana/spl-token';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { sessions, platforms, policy } from '../scripts/tokenization/modules.mjs';
// Use the server CJS entry: upstream's ESM agent-payments dependency imports Anchor's BN as a named export.
const require = createRequire(import.meta.url);
const pumpSdk = require('@pump-fun/pump-sdk'), anchor = require('@coral-xyz/anchor');

const load = (name, imports) => loadTypeScript(new URL(`../lib/agent-tokenization/${name}.ts`, import.meta.url), imports);
const journal = load('solana-journal', { 'node:crypto': crypto, '@solana/web3.js': solana, bs58: { default: bs58 }, './session': sessions });
const bags = load('bags', { '@solana/web3.js': solana, bs58: { default: bs58 }, './session': sessions, './platforms': platforms, './policy': policy });
const pump = load('pump', { '@coral-xyz/anchor': anchor, '@solana/web3.js': solana, '@solana/spl-token': spl,
  '@pump-fun/pump-sdk': pumpSdk, './session': sessions, './solana-journal': journal });
const { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } = solana;
const payer = Keypair.generate(), mint = Keypair.generate(), blockhash = Keypair.generate().publicKey.toBase58();
function transaction() {
  return new VersionedTransaction(new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash,
    instructions: [SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
      lamports: 1000, space: 82, programId: spl.TOKEN_2022_PROGRAM_ID })] }).compileToV0Message());
}
test('wallet signing must preserve the exact reviewed message and existing mint signature', () => {
  const prepared = transaction(); prepared.sign([mint]);
  const signed = VersionedTransaction.deserialize(prepared.serialize()); signed.sign([payer]);
  const result = journal.verifySignedTransaction(prepared, signed.serialize());
  assert.equal(result.signature, bs58.encode(signed.signatures[0]));
  const missing = VersionedTransaction.deserialize(prepared.serialize());
  assert.throws(() => journal.verifySignedTransaction(prepared, missing.serialize()), /valid signature/);
  const changed = VersionedTransaction.deserialize(prepared.serialize()); changed.message.recentBlockhash = mint.publicKey.toBase58(); changed.sign([mint, payer]);
  assert.throws(() => journal.verifySignedTransaction(prepared, changed.serialize()), /changed the reviewed/);
  signed.signatures[1][0] ^= 1;
  assert.throws(() => journal.verifySignedTransaction(prepared, signed.serialize()), /signature was replaced/);
});
test('simulation errors distinguish wallet rent, provider funding, expiry and program rejection', async () => {
  const tx = transaction(), signer = payer.publicKey.toBase58();
  const rpc = { getGenesisHash: async () => journal.SOLANA_MAINNET_GENESIS,
    isBlockhashValid: async () => ({ value: true }), getBalance: async () => 20_920_853,
    getFeeForMessage: async () => ({ value: 17500 }) };
  const check = error => journal.reviewSolanaTransaction({ ...rpc,
    simulateTransaction: async () => ({ value: { err: error, logs: ['secret provider diagnostic'] } }),
  }, tx, signer, 100_000_000n);
  await assert.rejects(check({ InsufficientFundsForRent: { account_index: 0 } }), error =>
    error.message.includes('needs more SOL') && error.message.includes(signer)
    && error.message.includes('0.020920853 SOL') && !error.message.includes('Refresh the review'));
  await assert.rejects(check({ InsufficientFundsForRent: { account_index: 1 } }), /provider must resolve/);
  await assert.rejects(check('InsufficientFundsForFee'), /needs more SOL/);
  await assert.rejects(check('BlockhashNotFound'), /transaction expired/);
  await assert.rejects(check({ InstructionError: [2, { Custom: 6001 }] }), /instruction 3 \(code 6001\)/);
  await assert.rejects(check({ InstructionError: [2, 'secret provider diagnostic'] }), error => !error.message.includes('secret'));
});
test('mint secrets and transaction bytes are encrypted with separate authenticated contexts', () => {
  const previous = process.env.TOKENIZATION_JOURNAL_KEY;
  process.env.TOKENIZATION_JOURNAL_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const data = crypto.randomBytes(64), sealed = journal.sealValue(data, 'mint:test');
    assert.deepEqual(Buffer.from(journal.openValue(sealed, 'mint:test')), data);
    assert.equal(JSON.stringify(sealed).includes(data.toString('base64')), false);
    assert.throws(() => journal.openValue(sealed, 'transaction:test'));
    const tampered = { ...sealed, tag: Buffer.alloc(16).toString('base64') };
    assert.throws(() => journal.openValue(tampered, 'mint:test'));
  } finally {
    if (previous === undefined) delete process.env.TOKENIZATION_JOURNAL_KEY; else process.env.TOKENIZATION_JOURNAL_KEY = previous;
  }
});
test('Bags parser preserves partial signatures and the blockhash supplied with that exact transaction', () => {
  const tx = transaction(); tx.sign([mint]);
  const encoded = bs58.encode(tx.serialize());
  const parsed = bags.readBagsTransaction({ transaction: encoded, blockhash: { blockhash, lastValidBlockHeight: 123 } });
  assert.deepEqual(parsed.transaction.serialize(), tx.serialize());
  assert.deepEqual(parsed.lifetime, { blockhash, lastValidBlockHeight: 123 });
  assert.equal(bags.readBagsTransaction(encoded).lifetime, undefined);
  assert.throws(() => bags.readBagsTransaction({ transaction: encoded, blockhash: { blockhash: 'wrong', lastValidBlockHeight: 123 } }), /lifetime/);
  assert.throws(() => bags.readBagsTransaction(Buffer.from(tx.serialize()).toString('base64')));
});
test('Bags request uses standard total fee config, Hive recipient, and the actual connected configuration payer', () => {
  const request = bags.bagsFeeConfigRequest(mint.publicKey.toBase58(), payer.publicKey.toBase58());
  assert.equal(request.bagsConfigType, 'fa29606e-5e48-4c37-827f-4b03d58ee23d');
  assert.deepEqual(request.claimersArray, [sessions.HIVE_SOLANA_FEE_WALLET]);
  assert.deepEqual(request.basisPointsArray, [10000]);
  assert.equal(request.payer, payer.publicKey.toBase58());
  assert.equal(request.partner, undefined);
});
test('Bags transport sends metadata as multipart, excludes social links and does not leak provider errors', async () => {
  const calls = [];
  const api = new bags.BagsLaunchApi('fixture-key', async (url, init) => {
    calls.push({ url, init }); return Response.json({ success: true, response: 'result' });
  });
  await api.post('/token-launch/create-token-info', { name: 'Test', imageUrl: 'https://example.test/image.png', website: 'https://uphive.xyz/agent/id/' + 'a'.repeat(24) });
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(calls[0].init.headers['Content-Type'], undefined);
  assert.equal(calls[0].init.body.has('twitter'), false);
  assert.equal(calls[0].init.body.has('telegram'), false);
  const failed = new bags.BagsLaunchApi('fixture-key', async () => Response.json({ error: 'SECRET CREDENTIAL' }, { status: 500 }));
  await assert.rejects(failed.post('/fee-share/config', {}), error => !error.message.includes('SECRET'));
});
test('Bags setup does not flatten unsupported bundles or accept a changed payer', async () => {
  const response = { needsCreation: true, feeShareAuthority: mint.publicKey.toBase58(), meteoraConfigKey: mint.publicKey.toBase58(),
    transactions: [bs58.encode(transaction().serialize())], bundles: [] };
  const api = { post: async () => response };
  assert.equal((await bags.prepareBagsConfiguration(api, mint.publicKey.toBase58(), payer.publicKey.toBase58())).steps.length, 1);
  await assert.rejects(bags.prepareBagsConfiguration(api, mint.publicKey.toBase58(), Keypair.generate().publicKey.toBase58()), /setup plan/);
  response.bundles = [[response.transactions[0]]];
  await assert.rejects(bags.prepareBagsConfiguration(api, mint.publicKey.toBase58(), payer.publicKey.toBase58()), /bundled/);
});
test('Bags metadata accepts multipart line endings after a rename, but rejects real metadata changes', async () => {
  const metadata = { name: 'Renamed agent', symbol: 'RENAME', description: 'First paragraph.\n\nListed on Hive.',
    socials: { website: platforms.profileUrl('a'.repeat(24)), twitter: '', telegram: '' } };
  const form = new FormData(); form.append('description', metadata.description);
  const wire = await new Response(form).text();
  assert.ok(wire.includes('First paragraph.\r\n\r\nListed on Hive.'));
  const response = { tokenMint: mint.publicKey.toBase58(), tokenMetadata: 'https://ipfs.io/ipfs/test', tokenLaunch: {
    ...metadata, ...metadata.socials, tokenMint: mint.publicKey.toBase58(), description: metadata.description.replaceAll('\n', '\r\n'), accountKeys: 'must not persist',
  } };
  const parsed = bags.readBagsMetadataResponse(response);
  assert.equal(parsed.tokenLaunch.accountKeys, undefined);
  assert.equal(bags.verifyBagsMetadataResponse(parsed, metadata).mint, mint.publicKey.toBase58());
  for (const [field, value] of Object.entries({ name: 'Old agent', symbol: 'OTHER', description: metadata.description + ' ', website: 'https://other.test', twitter: 'unrequested', telegram: 'unrequested', tokenMint: payer.publicKey.toBase58() })) {
    assert.throws(() => bags.verifyBagsMetadataResponse({ ...parsed, tokenLaunch: { ...parsed.tokenLaunch, [field]: value } }, metadata), /different token details/);
  }
  assert.throws(() => bags.readBagsMetadataResponse({ ...response, tokenMetadata: 'https://user:password@example.test/metadata' }), /unsupported/);
});
test('official Pump builder keeps payer separate from Hive creator and disables alternative modes', async () => {
  const connection = {
    getGenesisHash: async () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', getAccountInfo: async () => null,
    getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 123 }),
  };
  const uri = 'https://res.cloudinary.com/test/raw/upload/v1/hive-agent-tokens/' + 'a'.repeat(64) + '.json';
  const { transaction: tx, lifetime } = await pump.buildPumpLaunch(connection, { mint, payer: payer.publicKey,
    metadata: { name: 'Test agent', symbol: 'TEST' }, uri, purchase: 0n });
  assert.equal(lifetime.blockhash, tx.message.recentBlockhash);
  const instructions = TransactionMessage.decompile(tx.message).instructions;
  const create = instructions.find(ix => ix.programId.equals(pumpSdk.PUMP_PROGRAM_ID));
  const coder = new anchor.BorshInstructionCoder(pumpSdk.pumpIdl);
  const decoded = coder.decode(create.data);
  assert.ok(decoded);
  // The vendored IDL keeps snake_case instruction argument names.
  assert.equal(decoded.data.creator.toBase58(), sessions.HIVE_SOLANA_FEE_WALLET);
  const ownerTx = await pump.buildPumpLaunch(connection, { mint, payer: payer.publicKey, recipient: payer.publicKey.toBase58(), metadata: { name: 'Test agent', symbol: 'TEST' }, uri, purchase: 0n });
  const ownerCreate = TransactionMessage.decompile(ownerTx.transaction.message).instructions.find(ix => ix.programId.equals(pumpSdk.PUMP_PROGRAM_ID));
  assert.equal(coder.decode(ownerCreate.data).data.creator.toBase58(), payer.publicKey.toBase58());
  assert.equal(decoded.data.name, 'Test agent');
  assert.equal(decoded.data.uri, uri);
  assert.ok(create.keys.some(key => key.pubkey.equals(payer.publicKey) && key.isSigner));
  assert.ok(create.keys.some(key => key.pubkey.equals(mint.publicKey) && key.isSigner));
  tx.sign([payer]);
  assert.ok(journal.verifySignedTransaction((await pump.buildPumpLaunch(connection, { mint, payer: payer.publicKey,
    metadata: { name: 'Test agent', symbol: 'TEST' }, uri, purchase: 0n })).transaction, tx.serialize()).signature);
  await assert.rejects(pump.buildPumpLaunch({ ...connection, getAccountInfo: async () => ({}) }, { mint, payer: payer.publicKey,
    metadata: { name: 'Test', symbol: 'TEST' }, uri, purchase: 0n }), /already exists/);
});
test('Pump launch and buy stay atomic, use the lookup table before serialization and respect the purchase cap', async t => {
  const fixture=JSON.parse(readFileSync(new URL('fixtures/pump-launch-state.json',import.meta.url)));
  const previous=process.env.PUMP_LAUNCH_LOOKUP_TABLE;
  t.after(()=>{if(previous===undefined)delete process.env.PUMP_LAUNCH_LOOKUP_TABLE;else process.env.PUMP_LAUNCH_LOOKUP_TABLE=previous;});
  process.env.PUMP_LAUNCH_LOOKUP_TABLE=fixture.table.address;
  const table=new solana.AddressLookupTableAccount({key:new solana.PublicKey(fixture.table.address),state:{deactivationSlot:0xffffffffffffffffn,lastExtendedSlot:0,lastExtendedSlotStartIndex:0,addresses:fixture.table.addresses.map(k=>new solana.PublicKey(k))}});
  const rpc={getGenesisHash:async()=>journal.SOLANA_MAINNET_GENESIS,getLatestBlockhash:async()=>({blockhash,lastValidBlockHeight:123}),
    getAccountInfo:async key=>{const row=fixture.accounts[key.toBase58()];return row?{...row,owner:new solana.PublicKey(row.owner),data:Buffer.from(row.data,'base64')}:null;},
    getAddressLookupTable:async key=>{assert.equal(key.toBase58(),fixture.table.address);return{value:table};}};
  const uri='https://res.cloudinary.com/test/raw/upload/v1792610000/hive-agent-tokens/'+'a'.repeat(64)+'.json';
  const input={mint,payer:payer.publicKey,metadata:{name:'A'.repeat(32),symbol:'A'.repeat(10)},uri,purchase:1_000_000n};
  const {transaction:tx}=await pump.buildPumpLaunch(rpc,input);
  assert.ok(tx.serialize().length<=1232);assert.equal(tx.message.addressTableLookups.length,1);
  const uncompressed=solana.TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:[table]});
  assert.ok(new solana.VersionedTransaction(uncompressed.compileToV0Message()).serialize().length>1232,'fixture exercises the oversize path');
  const coder=new anchor.BorshInstructionCoder(pumpSdk.pumpIdl);
  const instructions=uncompressed.instructions.filter(ix=>ix.programId.equals(pumpSdk.PUMP_PROGRAM_ID)).map(ix=>coder.decode(ix.data));
  assert.deepEqual(instructions.map(ix=>ix.name),['create_v2','buy']);
  assert.equal(instructions[0].data.creator.toBase58(),sessions.HIVE_SOLANA_FEE_WALLET);
  assert.ok(BigInt(instructions[1].data.max_sol_cost.toString())<=input.purchase);
  tx.sign([payer]);assert.ok(journal.verifySignedTransaction(tx,tx.serialize()).signature);
  await assert.rejects(pump.buildPumpLaunch({...rpc,getAddressLookupTable:async()=>({value:null})},input),/unavailable/);
  delete process.env.PUMP_LAUNCH_LOOKUP_TABLE;
  await assert.rejects(pump.buildPumpLaunch(rpc,input),/temporarily unavailable/);
});
test('a missing Solana receipt remains unresolved, including after blockhash expiry', async () => {
  let written = false;
  const store = new journal.SolanaJournal({ collection: () => ({ findOneAndUpdate: async () => { written = true; } }) });
  const step = { _id: 'one', signature: 'test', phase: 'submitted' };
  const result = await store.reconcile(step, { getGenesisHash: async () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    getSignatureStatuses: async (_, options) => { assert.equal(options.searchTransactionHistory, true); return { value: [null] }; } });
  assert.equal(result, step); assert.equal(written, false);
});
test('Pump CreateEvent verification checks discriminator and the executing program, not arbitrary log text', () => {
  const event = { name: 'Test', symbol: 'TEST', uri: 'https://example.test/metadata', mint: mint.publicKey,
    bondingCurve: pumpSdk.bondingCurvePda(mint.publicKey), user: payer.publicKey, creator: new solana.PublicKey(sessions.HIVE_SOLANA_FEE_WALLET),
    timestamp: new anchor.BN(1), virtualTokenReserves: new anchor.BN(1), virtualSolReserves: new anchor.BN(1),
    realTokenReserves: new anchor.BN(1), tokenTotalSupply: new anchor.BN(1), tokenProgram: spl.TOKEN_2022_PROGRAM_ID,
    isMayhemMode: false, isCashbackEnabled: false, quoteMint: solana.PublicKey.default, virtualQuoteReserves: new anchor.BN(1),
    creatorFeeBps: new anchor.BN(0), isHolderReward: false, depth: 0 };
  const program = new anchor.Program(pumpSdk.pumpIdl, { connection: {} });
  const discriminator = Buffer.from(pumpSdk.pumpIdl.events.find(e => e.name === 'CreateEvent').discriminator);
  const bytes = Buffer.concat([discriminator, program.coder.types.encode('createEvent', event)]);
  const id = pumpSdk.PUMP_PROGRAM_ID.toBase58(), nested = payer.publicKey.toBase58();
  const data = `Program data: ${bytes.toString('base64')}`;
  const events = pump.pumpCreateEvents([`Program ${id} invoke [1]`, data, `Program ${id} success`]);
  assert.equal(events.length, 1); assert.equal(events[0].creator.toBase58(), sessions.HIVE_SOLANA_FEE_WALLET);
  assert.deepEqual(pump.pumpCreateEvents([data]), []);
  assert.deepEqual(pump.pumpCreateEvents([`Program ${id} invoke [1]`, `Program ${nested} invoke [2]`, data, `Program ${nested} success`, `Program ${id} success`]), []);
  bytes[0] ^= 1;
  assert.deepEqual(pump.pumpCreateEvents([`Program ${id} invoke [1]`, `Program data: ${bytes.toString('base64')}`, `Program ${id} success`]), []);
});
