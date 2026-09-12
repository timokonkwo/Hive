import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../components/redesign/agents/model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readFilters, pageUrl, agentsUrl, readAgentResponse, profileUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const agent = { id: '0123456789abcdef01234567', name: 'C++ / ETH & Research', completedTasks: 0, reputation: 0, reviewCount: 0, avgSatisfaction: 0 };
const parse = patch => readAgentResponse({ agents: [{ ...agent, ...patch }], total: 1 }).agents[0];

test('search, supported sort and page survive URL encoding and reload', () => {
 const filters = { search: 'C++ & [fees].*', sort: 'completed', page: 4 };
 assert.deepEqual(readFilters(new URL(pageUrl(filters), 'https://hive.example').searchParams), filters);
 const query = new URL(agentsUrl(filters), 'https://hive.example').searchParams;
 assert.equal(query.get('search'), filters.search); assert.equal(query.get('sort'), 'completed'); assert.equal(query.get('limit'), '12');
 assert.equal(pageUrl(readFilters(new URLSearchParams())), '/agents');
 for (const page of ['-1', 'NaN', 'Infinity', '0', '1.5', '100001']) assert.equal(readFilters(new URLSearchParams({ page })).page, 1);
 assert.equal(readFilters(new URLSearchParams('sort=earnings')).sort, 'reputation');
});
test('profile names remain a single encoded path segment', () => {
 const path = profileUrl(agent.name); assert.equal(path.split('/').length, 3); assert.equal(decodeURIComponent(path.split('/')[2]), agent.name);
});
test('missing counts differ from zero and unreviewed agents have no fabricated rating', () => {
 const empty = parse({}); assert.equal(empty.completed, 0); assert.equal(empty.reputation, 0); assert.equal(empty.reviews, 0); assert.equal(empty.rating, null);
 const missing = parse({ completedTasks: null, reputation: undefined, reviewCount: undefined, avgSatisfaction: 4.5 });
 assert.equal(missing.completed, null); assert.equal(missing.reputation, null); assert.equal(missing.reviews, null); assert.equal(missing.rating, null);
 assert.equal(parse({ reviewCount: 2, avgSatisfaction: 4.5 }).rating, 4.5);
});
test('invalid metrics cannot become reputation or rating claims', () => {
 for (const value of [-1, NaN, Infinity, '12']) { const row = parse({ completedTasks: value, reputation: value, reviewCount: value }); assert.equal(row.completed, null); assert.equal(row.reputation, null); assert.equal(row.reviews, null); }
 assert.equal(parse({ reputation: 101 }).reputation, null);
 assert.equal(parse({ reviewCount: 3, avgSatisfaction: 5.1 }).rating, null);
 assert.equal(parse({ reviewCount: 3, avgSatisfaction: 0 }).rating, null);
});
test('malformed or duplicate responses cannot masquerade as a directory', () => {
 for (const payload of [null, {}, { agents: [], total: '1' }, { agents: [], total: -1 }, { agents: [agent], total: 0 }, { agents: [agent, agent], total: 2 }, { agents: [{ ...agent, id: '../../x' }], total: 1 }, { agents: [{ ...agent, name: '' }], total: 1 }]) assert.throws(() => readAgentResponse(payload));
});
test('capabilities contain only supplied unique text; optional malformed values are omitted', () => {
 assert.deepEqual(parse({ capabilities: ['code-review', 'code-review', null, '', 4, ' research '] }).capabilities, ['code-review', 'research']);
 assert.deepEqual(parse({ capabilities: 'Research' }).capabilities, []);
 assert.equal(parse({ bio: null }).bio, '');
});
