import { catalog } from '../scripts/tokenization/modules.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTypeScript } from './helpers/load-typescript.mjs';
const policy = loadTypeScript(new URL('../lib/agent-tokenization/policy.ts', import.meta.url));
const association = loadTypeScript(new URL('../lib/agent-tokenization/association.ts', import.meta.url), { './policy': policy });

// Exercise the actual route without a database connection or database writes.
const source = readFileSync(new URL('../app/api/agents/by-name/[name]/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const agentId = '0123456789abcdef01234567';
async function routeFor(agent) {
 const reads = [];
 const collection = {
  findOne: async query => { reads.push(query); return agent; },
  countDocuments: async query => { reads.push(query); return 3; },
  find: () => { const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => [] }; return cursor; },
 };
 const module = { exports: {} };
 const imports = {
  'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
  '@/lib/db': { getDb: async () => ({ collection: () => collection }), COLLECTIONS: {} },
  mongodb: { ObjectId: class { static isValid() { return false; } } },
  '@/lib/logger': { logger: { error() {} } },
  '@/lib/agent-tokenization/catalog': catalog, '@/lib/agent-tokenization/association': association,
 };
 new Function('require', 'module', 'exports', compiled)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, module, module.exports);
 const response = await module.exports.GET(new Request('http://localhost/api/agents/by-name/100%25%20done'), { params: Promise.resolve({ name: '100% done' }) });
 return { response, reads };
}
test('literal percent names reach lookup and stored zero reputation is preserved', async () => {
 const { response, reads } = await routeFor({ _id: { toString: () => agentId }, name: '100% done', reputation: 0, status: 'pending' });
 assert.equal(response.status, 200); assert.ok(reads[0].$or[0].name.$regex.test('100% done'));
 const data = await response.json(); assert.equal(data.agent.reputation, 0); assert.equal(data.agent.status, 'pending'); assert.equal(data.stats.tasksCompleted, 3);
});
test('an absent percent-name agent is a real not-found response, not a decoding failure', async () => {
 const { response } = await routeFor(null); assert.equal(response.status, 404);
});
test('renamed profiles retain task history assigned by either legacy name field', async () => {
 const { response, reads } = await routeFor({ _id: { toString: () => agentId }, name: 'New agent', profileNames: ['old (agent)', 'new agent'] });
 assert.equal(response.status, 200);
 const clauses = reads[1].$or;
 for (const name of ['New agent', 'old (agent)']) {
  assert.ok(clauses.some(row => row.assignedAgent?.$regex?.test(name)));
  assert.ok(clauses.some(row => row.assignedAgentName?.$regex?.test(name)));
 }
 assert.equal(clauses.some(row => row.assignedAgent?.$regex?.test('old agent')), false);
});
test('public profile exposes only a valid Pons association and no launch internals', async () => {
 const token = { chainId: 4663, address: '0x' + '1'.repeat(40), symbol: 'RESEARCH', transactionHash: '0x' + 'a'.repeat(64) };
 const agent = { _id: { toString: () => agentId }, name: '100% done', ponsToken: { ...token, internalIntent: 'private', url: 'https://untrusted.example' } };
 const { response } = await routeFor(agent);
 assert.deepEqual((await response.json()).agent.ponsToken, token);
 for (const value of [undefined, { ...token, status: 'pending' }, { ...token, chainId: 1 }, { ...token, transactionHash: '' }]) {
  const result = await routeFor({ ...agent, ponsToken: value });
  assert.equal(result.response.status, 200);
  assert.equal((await result.response.json()).agent.ponsToken, null);
 }
});
