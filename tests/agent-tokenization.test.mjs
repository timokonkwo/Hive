import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as viem from 'viem';

function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in imports)) throw Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}
const policy = load('../lib/agent-tokenization/policy.ts');
const association = load('../lib/agent-tokenization/association.ts', { './policy': policy });
const metadata = load('../lib/agent-tokenization/metadata.ts', { './policy': policy, './association': association, viem, './profile-fields': load('../lib/agent-tokenization/profile-fields.ts') });
const quotes = load('../lib/agent-tokenization/quote.ts', { './policy': policy });
const client = load('../components/redesign/tokenization/model.ts', { '@/lib/agent-tokenization/policy': policy });
const id = '0123456789abcdef01234567';
const wallet = '0x1111111111111111111111111111111111111111';
const agent = { name: 'Research agent', bio: 'Research with verifiable sources.', status: 'active', walletAddress: wallet, walletAddressVerifiedAt: new Date(), avatarSeed: 'robot-1' };
const config = { supply: 10n ** 27n, phantomQuote: 168n * 10n ** 16n, graduationThreshold: 420n * 10n ** 16n, curveFeeBps: 100n, hookFeeBps: 100n, poolFee: 0, enabled: true };

test('owner and admin fee recipients are server policy, not arbitrary profile overrides', () => {
  const poisoned = { ...agent, creatorFeeWallet: '0x2222222222222222222222222222222222222222', recipient: 'bad' };
  assert.equal(metadata.profilePreview(id, poisoned, 'owner').recipient, wallet);
  const admin = metadata.profilePreview(id, poisoned, 'admin');
  assert.equal(admin.recipient, policy.HIVE_CREATOR_FEE_WALLET);
  assert.equal(admin.requiredSigner, null);
});

test('owner requires a verified primary EVM wallet; admin does not', () => {
  for (const patch of [{ walletAddressVerifiedAt: null }, { walletAddressVerifiedAt: 'invalid' }, { walletAddressVerifiedAt: new Date(NaN) }, { walletAddress: 'CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF' }, { walletAddress: '0x' + '0'.repeat(40) }]) {
    const preview = metadata.profilePreview(id, { ...agent, ...patch }, 'owner');
    assert.equal(preview.recipient, null); assert.ok(preview.issues.length);
  }
  assert.equal(metadata.profilePreview(id, { ...agent, walletAddress: null }, 'admin').issues.length, 0);
});

test('profile metadata preserves the bio and appends Hive attribution without hidden truncation', () => {
  const source = { ...agent, bio: 'x'.repeat(1001), name: 'Long '.repeat(20), website: 'javascript:alert(1)', ownerTwitter: '@hive' };
  const before = JSON.stringify(source);
  const preview = metadata.profilePreview(id, source, 'owner');
  assert.equal(preview.metadata.description, `${source.bio}\n\n${metadata.HIVE_AGENT_ATTRIBUTION}`);
  assert.equal(preview.metadata.name, source.name.trim());
  assert.equal(preview.metadata.socials.website, `https://uphive.xyz/agent/${encodeURIComponent(source.name.trim())}`);
  assert.equal(preview.metadata.socials.twitter, '');
  assert.equal(preview.metadata.socials.telegram, '');
  assert.ok(preview.issues.length >= 2);
  assert.equal(JSON.stringify(source), before);
});

test('both launch roles use only the Hive profile link even when external socials exist', () => {
  const source = { ...agent, name: 'Research & AI', website: 'https://example.com', twitter: 'https://x.com/example', ownerTwitter: '@example', telegram: 'https://t.me/example' };
  for (const role of ['owner', 'admin']) {
    const preview = metadata.profilePreview(id, source, role);
    assert.deepEqual(preview.metadata.socials, { website: 'https://uphive.xyz/agent/Research%20%26%20AI', twitter: '', telegram: '' });
    assert.equal(preview.metadata.description, `${source.bio}\n\n${metadata.HIVE_AGENT_ATTRIBUTION}`);
    assert.deepEqual(client.readPreview(preview, id, role), preview);
    for (const patch of [{ website: 'https://example.com' }, { twitter: 'https://x.com/example' }, { telegram: 'https://t.me/example' }]) {
      assert.throws(() => client.readPreview({ ...preview, metadata: { ...preview.metadata, socials: { ...preview.metadata.socials, ...patch } } }, id, role));
    }
  }
});

test('description limits include Hive attribution without allowing it to replace a missing bio', () => {
  const limit = 1000 - metadata.HIVE_AGENT_ATTRIBUTION.length - 2;
  assert.equal(metadata.profilePreview(id, { ...agent, bio: 'x'.repeat(limit) }, 'owner').issues.length, 0);
  for (const bio of ['', 'short', 'x'.repeat(limit + 1)]) {
    assert.match(metadata.profilePreview(id, { ...agent, bio }, 'owner').issues.join(' '), /profile bio/);
  }
});

test('Solana token neither blocks a Pons preview nor becomes its token address', () => {
  const preview = metadata.profilePreview(id, { ...agent, isTokenized: true, tokenLaunchStatus: 'launched', tokenMintAddress: 'a'.repeat(44), tokenSymbol: 'SOLAGENT' }, 'owner');
  assert.equal(preview.existingToken, null);
  assert.equal(preview.metadata.symbol, 'SOLAGENT');
  assert.equal(preview.issues.length, 0);
});

test('existing Pons association requires the correct chain, address and transaction hash', () => {
  const token = { chainId: 4663, address: wallet, symbol: 'RESEARCH', transactionHash: '0x' + 'a'.repeat(64) };
  assert.deepEqual(association.readAssociation(token), token);
  for (const patch of [{ chainId: 1 }, { address: 'not-an-address' }, { transactionHash: '' }, { status: 'pending' }, { status: 'reverted' }]) assert.equal(association.readAssociation({ ...token, ...patch }), null);
  assert.match(metadata.profilePreview(id, { ...agent, ponsToken: {} }, 'owner').issues.join(' '), /existing Robinhood token needs review/);
});

test('ETH parsing preserves wei precision and rejects ambiguous values', () => {
  assert.equal(policy.purchaseWei(''), 0n);
  assert.equal(policy.purchaseWei('0.000000000000000001'), 1n);
  assert.equal(policy.purchaseWei('1.507505338430267'), 1507505338430267000n);
  for (const value of ['-1', 'NaN', 'Infinity', '1e3', '1,000', '.1', '00.1', '1.0000000000000000001', '1.']) assert.throws(() => policy.purchaseWei(value));
});

test('ticker suggestions preserve existing valid ticker and validate user edits', () => {
  assert.equal(policy.suggestSymbol('Research & analysis'), 'RESEARCHAN');
  assert.equal(policy.suggestSymbol('Research', 'AGENT'), 'AGENT');
  assert.equal(policy.normalizeSymbol(' ai '), 'AI');
  for (const s of ['', '$AI', 'AI TOKEN', 'a'.repeat(11), '<script>']) assert.throws(() => policy.normalizeSymbol(s));
});

test('opening quote validates curve AND post-graduation fees before quoting', () => {
  for (const patch of [{ curveFeeBps: 200n }, { hookFeeBps: 200n }, { poolFee: 100 }, { enabled: false }, { supply: 0n }, { phantomQuote: 0n }]) {
    assert.throws(() => quotes.quoteOpeningBuy({ ...config, ...patch }, 10n ** 18n));
  }
});

test('zero opening purchase does not invent an allocation', () => {
  assert.deepEqual(quotes.quoteOpeningBuy(config, 0n), { tokens: 0n, minimumTokens: 0n, spent: 0n, refund: 0n });
});

test('ordinary opening purchase uses integer fees and a bounded minimum', () => {
  const budget = 10n ** 17n;
  const quote = quotes.quoteOpeningBuy(config, budget);
  const afterFees = budget * 97n / 100n;
  assert.equal(quote.tokens, afterFees * config.supply / (config.phantomQuote + afterFees));
  assert.equal(quote.minimumTokens, quote.tokens * 99n / 100n);
  assert.equal(quote.spent, budget); assert.equal(quote.refund, 0n);
});

test('large purchase is clamped at graduation and accounts for the refund', () => {
  const budget = 100n * 10n ** 18n;
  const quote = quotes.quoteOpeningBuy(config, budget);
  const reserved = config.supply * config.phantomQuote / (config.phantomQuote + config.graduationThreshold);
  assert.equal(quote.tokens, config.supply - reserved);
  assert.equal(quote.refund + quote.spent, budget);
  assert.ok(quote.refund > 0n); assert.ok(quote.spent < budget);
});

test('preview decoder rejects cross-agent, cross-role and malformed signing responses', () => {
  const preview = metadata.profilePreview(id, agent, 'owner');
  assert.deepEqual(client.readPreview(preview, id, 'owner'), preview);
  assert.equal(client.readPreview({...preview,signingEnabled:true},id,'owner').signingEnabled,true);
  for (const patch of [{ agentId: 'other' }, { role: 'admin' }, { signingEnabled: 'true' }, { recipient: 'bad' }, { existingToken: {} }, { issues: [7] }, { metadata: null }]) {
    assert.throws(() => client.readPreview({ ...preview, ...patch }, id, 'owner'));
  }
});

test('external links cannot be built from arbitrary user input', () => {
  assert.equal(policy.ponsTokenUrl(wallet), `https://www.ponsfamily.com/launchpad/${wallet}`);
  for (const input of ['javascript:bad', 'https://example.com', '../tokens', '']) assert.throws(() => policy.ponsTokenUrl(input));
  assert.throws(() => policy.explorerTransactionUrl('bad'));
});

test('preview endpoint denies unauthorized roles and keys without returning agent data', async () => {
  let reads = 0, authenticated = false, adminAllowed = false;
  const access = load('../lib/agent-tokenization/access.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/api-key': { authenticateRequest: async () => authenticated ? { agent: { id } } : null },
    '@/lib/admin-auth': { verifyAdmin: async () => adminAllowed ? {} : { error: Response.json({}, { status: 403 }) } },
  });
  const route = load('../app/api/agents/[address]/tokenization/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    mongodb: { ObjectId: class { constructor(value) { this.value = value; } } },
    '@/lib/db': { getDb: async () => ({ collection: () => ({ findOne: async () => { reads++; return agent; } }) }) },
    '@/lib/api-key': { authenticateRequest: async () => authenticated ? { agent: { id } } : null },
    '@/lib/admin-auth': { verifyAdmin: async () => adminAllowed ? {} : { error: Response.json({}, { status: 403 }) } },
    '@/lib/agent-tokenization/session-access': { sessionPonsPreview: async (_db, preview) => preview },
    '@/lib/agent-tokenization/metadata': metadata,
    '@/lib/agent-tokenization/release': { launchesEnabled: () => false },
    '@/lib/agent-tokenization/managed-signer': { managedDeployerStatus: () => ({available:false}) },
    '@/lib/agent-tokenization/access': access,
    '@/lib/rate-limit': { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'test', RATE_LIMITS: { READ: {} } },
    '@/lib/logger': { logger: { error() {} } },
  });
  const request = role => ({ nextUrl: new URL(`https://hive.test/api?role=${role}`), headers: new Headers() });
  const params = address => ({ params: Promise.resolve({ address }) });
  assert.equal((await route.GET(request('owner'), params(id))).status, 401);
  assert.equal((await route.GET(request('admin'), params(id))).status, 403);
  assert.equal((await route.GET(request('invalid'), params(id))).status, 400);
  authenticated = true;
  assert.equal((await route.GET(request('owner'), params('a'.repeat(24)))).status, 403);
  assert.equal(reads, 0);
  const response = await route.GET(request('owner'), params(id));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await response.json()).recipient, wallet);
  adminAllowed = true;
  assert.equal((await (await route.GET(request('admin'), params(id))).json()).recipient, policy.HIVE_CREATOR_FEE_WALLET);
  assert.equal(route.POST, undefined, 'preview milestone exposes no launch mutation');
});
