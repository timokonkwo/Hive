import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import ts from 'typescript';
const tid = '0123456789abcdef01234567', aid = '1123456789abcdef01234567';
function route(path, imports) {
 const source = readFileSync(new URL(path, import.meta.url), 'utf8');
 const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const module = { exports: {} };
 new Function('require', 'module', 'exports', code)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, module, module.exports);
 return module.exports;
}
const common = {
 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
 'mongodb': { ObjectId }, 'node:crypto': { createHash },
 '@/lib/rate-limit': { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'test', RATE_LIMITS: {} },
 '@/lib/client-auth': { authenticateClient: async () => ({ userId: 'did:privy:test' }) },
 '@/lib/logger': { logger: { error() {}, info() {} } },
};
function assignment({ task = {}, status = 'active', owns = true, race = false, failBid = false } = {}) {
 const saved = { _id: new ObjectId(tid), status: 'Open', clientAddress: 'owner', budget: '$25 USDC', ...task };
 const bids = new Map(), activity = new Map(), claims = [];
 const db = { collection: name => name === 'tasks' ? {
  findOne: async () => ({ ...saved }),
  updateOne: async (query, update) => { claims.push(query); if (race || saved.status !== 'Open') return { modifiedCount: 0 }; Object.assign(saved, update.$set); saved.proposalsCount = (saved.proposalsCount || 0) + update.$inc.proposalsCount; return { modifiedCount: 1 }; },
 } : name === 'agents' ? { findOne: async () => ({ _id: new ObjectId(aid), name: 'Sage', status }) } : {
  updateOne: async (query, update) => { if (name === 'bids' && failBid) { failBid = false; throw Error('Interrupted'); } (name === 'bids' ? bids : activity).set(String(query._id), update.$setOnInsert); },
 } };
 const handler = route('../app/api/tasks/[id]/assign/route.ts', { ...common,
  '@/lib/db': { getDb: async () => db, COLLECTIONS: { TASKS: 'tasks', AGENTS: 'agents', BIDS: 'bids', ACTIVITY: 'activity' } },
  '@/lib/client-ownership': { verifiedClientOwnsResource: () => owns, getClientActorAddress: () => 'owner' },
 });
 const run = () => handler.POST(new Request('http://localhost/assign', { method: 'POST', body: JSON.stringify({ agentId: aid }) }), { params: Promise.resolve({ id: tid }) });
 return { run, saved, claims, bids, activity };
}
test('assignment retains ownership and agent availability checks', async () => {
 for (const [options, status] of [[{ owns: false }, 403], [{ status: 'pending' }, 409], [{ task: { assignmentMode: 'direct', requestedAgentId: tid } }, 409]]) {
  const fixture = assignment(options); assert.equal((await fixture.run()).status, status); assert.equal(fixture.claims.length, 0); assert.equal(fixture.bids.size, 0);
 }
});
test('assignment claims only Open tasks and cannot add a bid after losing the race', async () => {
 const fixture = assignment({ race: true }); assert.equal((await fixture.run()).status, 409); assert.equal(fixture.claims[0].status, 'Open'); assert.equal(fixture.bids.size, 0);
});
test('same-agent retry repairs interrupted bid insert without another claim or duplicate records', async () => {
 const fixture = assignment({ failBid: true });
 assert.equal((await fixture.run()).status, 500); assert.equal(fixture.saved.assignedAgentId, aid);
 assert.equal((await fixture.run()).status, 200); assert.equal((await fixture.run()).status, 200);
 assert.equal(fixture.claims.length, 1); assert.equal(fixture.saved.proposalsCount, 1); assert.equal(fixture.bids.size, 1); assert.equal(fixture.activity.size, 1);
});
function creation() {
 const calls = { rank: 0, notify: 0, runner: 0, tasks: [] };
 const db = { collection: name => ({
  findOne: async () => ({ _id: new ObjectId(aid), name: 'Sage', status: 'active' }),
  insertOne: async doc => { if (name === 'tasks') calls.tasks.push(doc); return { insertedId: new ObjectId(tid) }; },
  updateOne: async () => ({ modifiedCount: 1 }),
 }) };
 const handler = route('../app/api/tasks/route.ts', { ...common,
  '@/lib/db': { getDb: async () => db, COLLECTIONS: { TASKS: 'tasks', AGENTS: 'agents' } },
  '@/lib/submission-validator': { validateTokenConfig: () => ({ valid: true }), validateDeliverableSpecs: () => ({ valid: true }) },
  '@/lib/agent-notifications': { notifyMatchingAgents: async () => { calls.notify++; } },
  '@/lib/webhooks': { enqueueWebhookEvent: async () => {} },
  '@/lib/task-builder': { validateAcceptanceRubric: () => ({ valid: true, rubric: [] }) },
  '@/lib/points': { awardPoints: async () => {} },
  '@/lib/smart-matching': { rankAgentsForTask: async () => { calls.rank++; return []; } },
  '@/lib/human-verification': { requireHumanVerification: async () => ({ ok: true }) },
  '@/lib/task-security': { taskBodyTooLarge: () => false, validateHumanTaskInput: input => ({ valid: true, value: input }) },
  '@/lib/public-redaction': {},
  '@/lib/stealth-agents/runner': { handleNewTask: async () => { calls.runner++; } },
 });
 return { calls, run: body => handler.POST(new Request('http://localhost/tasks', { method: 'POST', body: JSON.stringify(body) })) };
}
test('explicit direct creation reserves identity and skips automatic assignment and broadcast', async () => {
 const f = creation(); const res = await f.run({ assignmentMode: 'direct', requestedAgentId: aid });
 assert.equal(res.status, 201); assert.equal(f.calls.rank, 0); assert.equal(f.calls.notify, 0); assert.equal(f.calls.runner, 0);
 assert.equal(f.calls.tasks[0].status, 'Open'); assert.equal(f.calls.tasks[0].requestedAgentId, aid);
});
test('proposal choice stays Open while legacy callers retain automatic matching', async () => {
 const f = creation(); await f.run({ assignmentMode: 'proposals' }); await new Promise(r => setImmediate(r));
 assert.equal(f.calls.rank, 0); assert.equal(f.calls.tasks[0].status, 'Open'); assert.equal(f.calls.notify, 1);
 await f.run({}); assert.equal(f.calls.rank, 1);
});
test('invalid selection modes and direct IDs fail before creation', async () => {
 const f = creation();
 assert.equal((await f.run({ assignmentMode: 'bad' })).status, 400);
 assert.equal((await f.run({ assignmentMode: 'direct', requestedAgentId: '../other' })).status, 400);
 assert.equal(f.calls.tasks.length, 0);
});
