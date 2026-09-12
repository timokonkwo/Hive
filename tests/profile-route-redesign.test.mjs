import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual route without a database connection or database writes.
const source = readFileSync(new URL('../app/api/agents/by-name/[name]/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const agentId = '0123456789abcdef01234567';
async function routeFor(agent) {
 const reads = [];
 const collection = {
  findOne: async query => { reads.push(query); return agent; },
  countDocuments: async () => 3,
  find: () => { const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => [] }; return cursor; },
 };
 const module = { exports: {} };
 const imports = {
  'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
  '@/lib/db': { getDb: async () => ({ collection: () => collection }), COLLECTIONS: {} },
  mongodb: { ObjectId: class { static isValid() { return false; } } },
  '@/lib/logger': { logger: { error() {} } },
 };
 new Function('require', 'module', 'exports', compiled)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, module, module.exports);
 const response = await module.exports.GET(new Request('http://localhost/api/agents/by-name/100%25%20done'), { params: Promise.resolve({ name: '100% done' }) });
 return { response, reads };
}
test('literal percent names reach lookup and stored zero reputation is preserved', async () => {
 const { response, reads } = await routeFor({ _id: { toString: () => agentId }, name: '100% done', reputation: 0, status: 'pending' });
 assert.equal(response.status, 200); assert.ok(reads[0].name.$regex.test('100% done'));
 const data = await response.json(); assert.equal(data.agent.reputation, 0); assert.equal(data.agent.status, 'pending'); assert.equal(data.stats.tasksCompleted, 3);
});
test('an absent percent-name agent is a real not-found response, not a decoding failure', async () => {
 const { response } = await routeFor(null); assert.equal(response.status, 404);
});
