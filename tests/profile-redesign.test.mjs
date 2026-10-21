import { catalog } from '../scripts/tokenization/modules.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './helpers/load-typescript.mjs';
const policy = loadTypeScript(new URL('../lib/agent-tokenization/policy.ts', import.meta.url));
const association = loadTypeScript(new URL('../lib/agent-tokenization/association.ts', import.meta.url), { './policy': policy });
const { readProfile, readReviews, profileApi, taskEntry, safeWebsite, canStartTask, reviewPage, decodePageName } = loadTypeScript(new URL('../components/redesign/profile/model.ts', import.meta.url), { '@/lib/agent-tokenization/catalog': catalog, '@/lib/agent-tokenization/association': association });
const id = '0123456789abcdef01234567';
const base = { agent: { id, name: '100% / C++', reputation: 0, reviewCount: 0, avgSatisfaction: 0 }, stats: { tasksCompleted: 0 }, recentBids: [], taskHistory: [], tokenLaunches: [] };
const parse = patch => readProfile({ ...base, agent: { ...base.agent, ...patch } });

test('profile names are encoded once; task entry requires an actual ID', () => {
 assert.equal(profileApi('100% / C++'), '/api/agents/by-name/100%25%20%2F%20C%2B%2B');
 assert.equal(new URL(taskEntry(id), 'https://hive.example').searchParams.get('agent'), id);
 assert.equal(taskEntry('../../create'), null);
});
test('zero evidence remains zero, missing evidence is not replaced by zero', () => {
 const a = parse({}); assert.equal(a.reputation, 0); assert.equal(a.completed, 0); assert.equal(a.rating, null);
 const b = parse({ reputation: undefined, reviewCount: undefined, avgSatisfaction: 5 }); assert.equal(b.reputation, null); assert.equal(b.reviews, null); assert.equal(b.rating, null);
 assert.equal(parse({ reviewCount: 2, avgSatisfaction: 4.5 }).rating, 4.5);
 for (const value of [101, -1, NaN, Infinity, '99']) assert.equal(parse({ reputation: value }).reputation, null);
});
test('unsafe external URLs and unconfirmed token links are omitted', () => {
 for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:pass@example.com']) assert.equal(safeWebsite(value), null);
 assert.equal(safeWebsite('https://example.com/agent'), 'https://example.com/agent');
 assert.equal(parse({ tokenMintAddress: 'x'.repeat(32), tokenLaunchStatus: 'pending' }).ownToken, null);
 assert.equal(parse({ tokenMintAddress: '../create', tokenLaunchStatus: 'launched' }).ownToken, null);
});
test('Pons token coexists with the Solana token and uses only the validated association', () => {
 const token = { chainId: 4663, address: '0x' + '1'.repeat(40), symbol: 'RESEARCH', transactionHash: '0x' + 'a'.repeat(64) };
 const profile = parse({ ponsToken: { ...token, url: 'https://untrusted.example' }, tokenMintAddress: '7'.repeat(44), tokenSymbol: 'SOLAGENT', tokenLaunchStatus: 'launched' });
 assert.deepEqual(profile.ponsToken, token);
 assert.equal(profile.ownToken.symbol, 'SOLAGENT');
 assert.equal(parse({}).ponsToken, null);
 for (const patch of [{ chainId: 1 }, { address: 'javascript:bad' }, { transactionHash: null }, { status: 'pending' }, { status: 'reverted' }]) {
  const result = parse({ ponsToken: { ...token, ...patch } });
  assert.equal(result.ponsToken, null);
  assert.equal(result.name, base.agent.name, 'bad token data must not break the rest of the profile');
 }
});
test('task/proposal history preserves supplied price strings and rejects unsafe links', () => {
 const p = readProfile({ ...base, taskHistory: [{ id, title: 'Review', budget: 'Negotiable', status: 'Completed' }], recentBids: [{ id, taskId: '../../create', amount: 12 }] });
 assert.equal(p.tasks[0].budget, 'Negotiable'); assert.equal(p.proposals[0].taskId, ''); assert.equal(p.proposals[0].budget, 'Not listed');
 assert.throws(() => readProfile({ ...base, taskHistory: [{ id: 'invalid' }] }));
});
test('malformed profile and duplicate histories fail explicitly', () => {
 for (const value of [null, {}, { ...base, stats: null }, { ...base, agent: {} }, { ...base, tokenLaunches: null }, { ...base, taskHistory: [{ id }, { id }] }]) assert.throws(() => readProfile(value));
});
test('only active and legacy status-less entries retain task entry', () => {
 assert.equal(canStartTask('active'), true); assert.equal(canStartTask(null), true);
 for (const status of ['pending', 'suspended', 'inactive', 'unknown', '']) assert.equal(canStartTask(status), false);
 assert.equal(canStartTask(parse({ status: 123 }).status), false);
});
test('reviews preserve actual comments without inventing identity or rating', () => {
 const { reviews } = readReviews({ reviews: [{ id, taskId: id, satisfaction: 5, comment: 'Works.', createdAt: 'invalid' }], total: 1 });
 assert.equal(reviews[0].comment, 'Works.'); assert.equal(reviews[0].rating, 5); assert.equal(reviews[0].createdAt, null);
 assert.equal(readReviews({ reviews: [{ id, satisfaction: 0 }], total: 1 }).reviews[0].rating, null);
 for (const value of [{}, { reviews: [], total: '0' }, { reviews: [{ id }, { id }], total: 2 }, { reviews: [{ id }], total: 0 }]) assert.throws(() => readReviews(value));
});
test('review pagination rejects malformed page numbers', () => {
 for (const value of ['-1', '0', '1.5', 'Infinity', '100001', 'NaN']) assert.equal(reviewPage(new URLSearchParams({ reviewPage: value })), 1);
 assert.equal(reviewPage(new URLSearchParams('reviewPage=2')), 2);
});

test("page parameter decoding preserves literal percent sequences", () => {
 for (const name of ["100% / C++", "Agent%20Name", "正常", "Alice & Bob"]) assert.equal(decodePageName(encodeURIComponent(name)), name);
});
