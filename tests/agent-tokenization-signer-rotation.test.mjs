import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as solana from '@solana/web3.js';
import bs58 from 'bs58';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { sessions, solanaJournal } from '../scripts/tokenization/modules.mjs';

test('new deployer and legacy fee wallet use their own keys; neither silently substitutes for the other', t => {
  const launch = solana.Keypair.generate(), fees = solana.Keypair.generate(), mint = solana.Keypair.generate();
  const constants = { ...sessions, HIVE_SOLANA_LAUNCH_WALLET: launch.publicKey.toBase58(), HIVE_SOLANA_FEE_WALLET: fees.publicKey.toBase58() };
  const signer = loadTypeScript(new URL('../lib/agent-tokenization/solana-signer.ts', import.meta.url), {
    '@solana/web3.js': solana, bs58: { default: bs58 }, './session': constants, './solana-journal': solanaJournal,
  });
  const previous = { HIVE_LAUNCH_KEYPAIR: process.env.HIVE_LAUNCH_KEYPAIR, HIVE_AGENT_LAUNCH_KEYPAIR: process.env.HIVE_AGENT_LAUNCH_KEYPAIR };
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  process.env.HIVE_LAUNCH_KEYPAIR = bs58.encode(launch.secretKey);
  process.env.HIVE_AGENT_LAUNCH_KEYPAIR = JSON.stringify([...fees.secretKey]);
  assert.deepEqual(signer.solanaDeployerStatus(), { address: constants.HIVE_SOLANA_LAUNCH_WALLET, available: true });
  assert.deepEqual(signer.solanaFeeWalletStatus(), { address: constants.HIVE_SOLANA_FEE_WALLET, available: true });
  const tx = key => new solana.VersionedTransaction(new solana.TransactionMessage({ payerKey: key.publicKey,
    recentBlockhash: mint.publicKey.toBase58(), instructions: [solana.SystemProgram.createAccount({
      fromPubkey: key.publicKey, newAccountPubkey: mint.publicKey, lamports: 1, space: 0, programId: solana.SystemProgram.programId,
    })] }).compileToV0Message());
  for (const key of [launch, fees]) {
    const original = tx(key); original.sign([mint]);
    const signed = signer.signManagedSolana(solana.VersionedTransaction.deserialize(original.serialize()), key.publicKey.toBase58());
    assert.ok(solanaJournal.verifySignedTransaction(original, signed).signature);
  }
  assert.throws(() => signer.signManagedSolana(tx(launch)), /does not match/);
  assert.throws(() => signer.signManagedSolana(tx(mint), mint.publicKey.toBase58()), /not configured/);
  process.env.HIVE_LAUNCH_KEYPAIR = bs58.encode(fees.secretKey);
  assert.equal(signer.solanaDeployerStatus().available, false, 'wrong address does not become the deployer');
  assert.equal(signer.solanaFeeWalletStatus().available, true, 'old fee collection remains available');
  assert.throws(() => signer.signManagedSolana(tx(launch), launch.publicKey.toBase58()), /configuration/);
  delete process.env.HIVE_LAUNCH_KEYPAIR;
  assert.equal(signer.solanaDeployerStatus().available, false, 'missing launch key never falls back to old deployer');
});

test('new managed reviews use the requested deployer without changing creator fees or historical replay', () => {
  const input = { id: '11111111-1111-4111-8111-111111111111', agentId: '0123456789abcdef01234567', role: 'admin',
    metadata: { name: 'Agent', symbol: 'AGENT', description: 'An agent on Hive.', avatarSeed: 'agent', socials: { website: '', twitter: '', telegram: '' } },
    profileRevision: 'a'.repeat(64), verifiedOwnerEvm: null, verifiedOwnerSolana: null,
    choices: ['bags', 'pump'].map(platform => ({ platform, mode: 'managed', signer: sessions.HIVE_SOLANA_LAUNCH_WALLET, purchase: '0' })) };
  const current = sessions.reviewSession(input);
  assert.ok(current.targets.every(t => t.terms.signer === 'CUswZXSaVjeK9Rk4vA2zVb5NdjQi1eBxsygWEG9n4oNL'));
  assert.ok(current.targets.every(t => t.terms.recipient === sessions.HIVE_SOLANA_FEE_WALLET));
  const old = { ...input, choices: input.choices.map(c => ({ ...c, signer: sessions.HIVE_SOLANA_FEE_WALLET })) };
  assert.throws(() => sessions.reviewSession(old), /deployer changed/);
  const historical = sessions.reviewSession({ ...old, managedSolanaSigner: sessions.HIVE_SOLANA_FEE_WALLET });
  assert.ok(historical.targets.every(t => t.terms.signer === sessions.HIVE_SOLANA_FEE_WALLET));
  assert.notEqual(historical.digest, current.digest);
});
