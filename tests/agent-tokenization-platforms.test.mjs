import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { platforms as p, catalog, sessions as s } from '../scripts/tokenization/modules.mjs';

const evm = '0x' + '1'.repeat(40), sol = Keypair.generate().publicKey.toBase58();
const token = (platform, address = platform === 'pons' ? evm : Keypair.generate().publicKey.toBase58()) => ({
  platform, network: p.platforms[platform].network, address, symbol: 'TEST',
  transactionHash: platform === 'pons' ? '0x' + 'a'.repeat(64) : '2'.repeat(88),
});
const input = (selected = ['pons', 'bags', 'pump']) => ({
  id: '11111111-1111-4111-8111-111111111111', agentId: '0123456789abcdef01234567', role: 'owner',
  metadata: { name: 'Test agent', symbol: 'test', description: 'An agent on Hive.', avatarSeed: 'test', socials: { website: '', twitter: '', telegram: '' } },
  profileRevision: 'a'.repeat(64), verifiedOwnerEvm: evm, verifiedOwnerSolana: sol,
  choices: selected.map(platform => ({ platform, mode: 'connected', signer: platform === 'pons' ? evm : sol, purchase: platform === 'pons' ? '0.01' : '0.1' })),
});

test('all seven platform selections have deterministic chain-grouped execution and exact separate totals', () => {
  for (let bits = 1; bits < 8; bits++) {
    const selected = p.platformIds.filter((_, i) => bits & 1 << i), session = s.reviewSession(input(selected));
    assert.equal(session.targets.length, selected.length);
    assert.deepEqual(session.targets.map(t => t.terms.platform), ['bags', 'pump', 'pons'].filter(id => selected.includes(id)));
    const count = selected.filter(id => id !== 'pons').length;
    assert.deepEqual(s.sessionPurchases(session), { SOL: String(BigInt(count) * 100000000n), ETH: selected.includes('pons') ? '10000000000000000' : '0' });
    assert.equal(s.nextTarget(session).terms.platform, session.targets[0].terms.platform);
  }
});
test('Owner-funded launches pay their signer; admin recipients remain unchanged', () => {
  const owner = s.reviewSession(input());
  assert.equal(owner.targets.find(t => t.terms.platform === 'pons').terms.recipient, evm);
  assert.ok(owner.targets.every(t => t.terms.recipient === t.terms.signer));
  const admin = s.reviewSession({ ...input(), role: 'admin' });
  assert.equal(admin.targets.find(t => t.terms.platform === 'pons').terms.recipient, '0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19');
  assert.equal(admin.targets[0].terms.signer, sol);
  assert.equal(admin.targets[0].terms.policy, 'bags-standard-v1');
});
test('review binds metadata, platform selection, payer and exact purchases; socials are profile-only', () => {
  const base = s.reviewSession(input());
  assert.equal(base.metadata.socials.website, `https://uphive.xyz/agent/id/${base.agentId}`);
  assert.equal(base.metadata.socials.twitter, '');
  for (const change of [
    { metadata: { ...input().metadata, name: 'Different name' } },
    { choices: input().choices.slice(0, 1) },
    { profileRevision: 'b'.repeat(64) },
    { choices: input().choices.map(c => ({ ...c, purchase: '0.2' })) },
    { role: 'admin' },
  ]) assert.notEqual(s.reviewSession({ ...input(), ...change }).digest, base.digest);
});
test('duplicate targets, fake managed deployer and conflicting Solana wallets fail closed', () => {
  const original = input();
  for (const patch of [
    { choices: [] }, { choices: [original.choices[0], original.choices[0]] },
    { choices: original.choices.map(c => ({ ...c, mode: 'managed' })) },
    { role: 'admin', choices: original.choices.map(c => ({ ...c, mode: 'managed' })) },
    { role: 'admin', choices: original.choices.map(c => c.platform === 'bags' ? { ...c, signer: Keypair.generate().publicKey.toBase58() } : c) },
    { metadata: { ...original.metadata, name: '🎉'.repeat(9) } },
  ]) assert.throws(() => s.reviewSession({ ...original, ...patch }));
});
test('no later target starts while a prior target is unresolved; failure pauses the batch', () => {
  let session = s.reviewSession(input());
  assert.throws(() => s.transitionTarget(session, 'pons', { phase: 'preparing' }), /earlier/);
  session = s.transitionTarget(session, 'bags', { phase: 'preparing', intentId: 'bags-one' });
  session = s.transitionTarget(session, 'bags', { phase: 'awaiting-signature' });
  session = s.transitionTarget(session, 'bags', { phase: 'submitted' });
  session = s.transitionTarget(session, 'bags', { phase: 'blocked' });
  assert.equal(s.nextTarget(session), null);
  assert.throws(() => s.continueSession(session, { platform: 'bags', action: 'skip' }), /unresolved/);
  assert.throws(() => s.transitionTarget(session, 'bags', { phase: 'submitted', intentId: 'replacement' }), /replaced/);
  session = s.transitionTarget(session, 'bags', { phase: 'failed' });
  session = s.continueSession(session, { platform: 'bags', action: 'retry' });
  assert.equal(session.targets[0].intentId, 'bags-one');
  assert.equal(s.nextTarget(session).terms.platform, 'bags');
});
test('confirmed targets survive a later failure; retries cannot recreate a success', () => {
  let session = s.reviewSession(input());
  for (const phase of ['preparing', 'awaiting-signature', 'submitted']) session = s.transitionTarget(session, 'bags', { phase });
  const bags = token('bags');
  session = s.transitionTarget(session, 'bags', { phase: 'confirmed', token: bags });
  assert.throws(() => s.transitionTarget(session, 'bags', { phase: 'preparing' }));
  session = s.transitionTarget(session, 'pump', { phase: 'preparing' });
  session = s.transitionTarget(session, 'pump', { phase: 'awaiting-signature' });
  session = s.transitionTarget(session, 'pump', { phase: 'failed' });
  session = s.continueSession(session, { platform: 'pump', action: 'skip' });
  assert.equal(s.nextTarget(session).terms.platform, 'pons');
  assert.deepEqual(session.targets[0].token, bags);
  assert.equal(s.sessionComplete(session), false);
});
test('token identity uses network and exact Solana case; wrong-chain, duplicate and unverified records are rejected', () => {
  const bags = token('bags'), pump = token('pump'), pons = token('pons');
  assert.equal(p.readAgentTokens([pons, bags, pump]).length, 3);
  assert.equal(p.readAgentToken({ ...pump, network: 'robinhood' }), null);
  assert.deepEqual(p.readAgentTokens([bags, bags]), []);
  assert.deepEqual(p.readAgentTokens([bags, { ...pump, address: bags.address }]), []);
  assert.notEqual(p.tokenKey(bags), p.tokenKey({ ...bags, address: bags.address.toLowerCase() }));
  assert.equal(p.tokenKey(pons), p.tokenKey({ ...pons, address: pons.address.toUpperCase() }));
  assert.equal(p.validSolanaAddress('2'.repeat(32)), false);
  assert.deepEqual(catalog.agentTokenCatalog({ tokenLaunchStatus: 'launched', tokenMintAddress: bags.address }), []);
  assert.equal(catalog.agentTokenCatalog({ ponsToken: { chainId: 4663, ...pons }, agentTokens: [bags, pump] }).length, 3);
});
test('SOL purchases are exact and reject rounding, exponents and negative values', () => {
  assert.equal(p.purchaseLamports('1.000000001'), 1000000001n);
  for (const value of ['-1', '1e2', '.1', '0.0000000001', '01', 'Infinity', ' 1']) assert.throws(() => p.purchaseLamports(value));
});

test('walletless owners can use Hive on every platform; purchases require their own payer', () => {
  const value = { ...input(), verifiedOwnerEvm: null, verifiedOwnerSolana: null,
    choices: p.platformIds.map(platform => ({ platform, mode: 'managed', signer: platform === 'pons' ? '0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2' : s.HIVE_SOLANA_FEE_WALLET, purchase: '0' })) };
  const reviewed = s.reviewSession(value);
  assert.equal(reviewed.walletPolicy, 'payer');
  assert.equal(reviewed.targets.find(t => t.terms.platform === 'pons').terms.recipient, '0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19');
  assert.ok(reviewed.targets.filter(t => t.terms.platform !== 'pons').every(t => t.terms.recipient === s.HIVE_SOLANA_FEE_WALLET));
  for (const platform of p.platformIds) assert.throws(() => s.reviewSession({ ...value, choices: value.choices.map(c => c.platform === platform ? { ...c, purchase: '0.1' } : c) }), /own wallet/);
  const connected = s.reviewSession({ ...input(), verifiedOwnerEvm: null, verifiedOwnerSolana: null });
  assert.ok(connected.targets.every(t => t.terms.signer === t.terms.recipient));
});
test('historical reviews preserve verified-wallet policy and fixed Solana recipients', () => {
  const previous = s.reviewSession({ ...input(), walletPolicy: 'verified' });
  assert.equal(previous.walletPolicy, undefined);
  assert.ok(previous.targets.filter(t => t.terms.platform !== 'pons').every(t => t.terms.recipient === s.HIVE_SOLANA_FEE_WALLET));
  assert.throws(() => s.reviewSession({ ...input(), walletPolicy: 'verified', verifiedOwnerEvm: null }), /verified/);
  assert.notEqual(previous.digest, s.reviewSession(input()).digest);
});
