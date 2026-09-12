import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const source = readFileSync(new URL(path, import.meta.url), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const m = await load('../components/redesign/create/model.ts');
const { submitTask, assignCreatedTask } = await load('../components/redesign/create/submission.ts');
const id = '0123456789abcdef01234567', agentId = '1123456789abcdef01234567';
const draft = { ...m.emptyDraft, title: 'Compare source data', category: 'Research', description: 'Compare the supplied source data and include links in the final report.', budget: '25.50' };
const response = (data, status = 200) => Response.json(data, { status });
test('brief validates server limits and exact decimal budgets', () => {
 assert.deepEqual(m.validateDraft(draft), {});
 for (const budget of ['', '0', '-1', '0.001', '100000.01', '1e3', '12abc', '1,000']) assert.ok(m.validateDraft({ ...draft, budget }).budget, budget);
 assert.deepEqual(m.validateDraft({ ...draft, budget: '100000' }), {});
 assert.deepEqual(m.validateDraft({ ...draft, budget: '', price: 'negotiable' }), {});
 assert.ok(m.validateDraft({ ...draft, title: 'x', description: 'short', category: 'fake' }).description);
 assert.ok(m.validateDraft({ ...draft, checklist: Array(9).fill('Done').join('\n') }).checklist);
 assert.ok(m.validateDraft({ ...draft, tags: 'bad@tag' }).tags);
});
test('token fields are conditional and require a complete bounded group', () => {
 assert.deepEqual(m.validateDraft({ ...draft, category: 'Token Launch' }), {});
 const errors = m.validateDraft({ ...draft, category: 'Token Launch', tokenName: 'Hive' });
 assert.ok(errors.tokenSymbol); assert.ok(errors.tokenDescription);
 assert.equal(m.taskPayload({ ...draft, tokenName: 'Hidden' }, null, '').tokenConfig, undefined);
});
test('draft migration preserves prior brief and rejects malformed structures', () => {
 const legacy = m.restoreDraft(JSON.stringify({ formData: { ...draft, tags: ['C++', 'Research'], acceptanceRubric: ['Include links'] } }));
 assert.equal(legacy.draft.tags, 'C++, Research'); assert.equal(legacy.draft.checklist, 'Include links');
 const restored = m.restoreDraft(JSON.stringify({ version: 2, draft: { ...draft, method: 'match', tokenName: 'Token' }, agentId }));
 assert.equal(restored.agentId, agentId); assert.equal(restored.draft.method, 'match'); assert.equal(restored.draft.tokenName, 'Token');
 for (const raw of [null, '{', '{}', '{"formData":[]}']) assert.equal(m.restoreDraft(raw), null);
});
test('direct selection must match the requested ID and expose inactive state', () => {
 assert.throws(() => m.readSelectedAgent({ agent: { id, name: 'Wrong' } }, agentId));
 assert.equal(m.readSelectedAgent({ agent: { id: agentId, name: 'Agent', status: 'pending' } }, agentId).available, false);
 assert.equal(m.readSelectedAgent({ agent: { id: agentId, name: 'Agent' } }, agentId).available, true);
});
test('suggestions preserve deliberately set budget and selection method', () => {
 const result = m.applySuggestedDraft({ title: 'Suggested task', description: 'A proposed description', budget: '$999 USDC', tags: ['Research'], acceptanceRubric: ['Cite sources'] }, draft);
 assert.equal(result.budget, draft.budget); assert.equal(result.method, draft.method); assert.equal(result.checklist, 'Cite sources');
 assert.throws(() => m.applySuggestedDraft({}, draft));
});
test('payload carries explicit choice and never invents payment', () => {
 const payload = m.taskPayload(draft, agentId, 'challenge');
 assert.equal(payload.assignmentMode, 'direct'); assert.equal(payload.requestedAgentId, agentId); assert.equal(payload.budget, '$25.50 USDC');
 assert.equal(m.taskPayload(draft, null, '').assignmentMode, 'proposals');
 assert.equal(m.taskPayload({ ...draft, price: 'negotiable' }, null, '').budget, 'Negotiable');
});
test('direct hire persists created ID before assignment and reports partial success', async () => {
 const calls = [], receipts = [];
 const result = await submitTask(async (url) => { calls.push(url); if (calls.length === 1) return response({ id }, 201); assert.equal(receipts[0].id, id); return response({ error: 'Failed' }, 500); }, {}, true, agentId, r => receipts.push(r));
 assert.deepEqual(calls, ['/api/tasks', `/api/tasks/${id}/assign`]); assert.equal(result.kind, 'assignment-failed'); assert.equal(result.id, id);
});
test('assignment retry uses only the existing task and verifies exact response identity', async () => {
 const calls = [];
 const result = await assignCreatedTask(async url => { calls.push(url); return response({ success: true, agent_id: agentId, task_id: id, agent_name: 'Sage' }); }, id, agentId);
 assert.equal(result.kind, 'assigned'); assert.deepEqual(calls, [`/api/tasks/${id}/assign`]);
 assert.equal((await assignCreatedTask(async () => response({ success: true, agent_id: id, task_id: id }), id, agentId)).kind, 'assignment-failed');
});
test('unknown server, network and malformed success outcomes never claim success or retry', async () => {
 for (const transport of [async () => response({ error: 'Failure' }, 500), async () => { throw Error('network'); }, async () => response({ id: 'bad' }, 201)]) {
  let count = 0;
  const result = await submitTask(async (...args) => { count++; return transport(...args); }, {}, false, null, () => {});
  assert.equal(result.kind, 'unknown'); assert.equal(count, 1);
 }
});
test('explicit rejection preserves retry and match uses its own endpoint', async () => {
 assert.equal((await submitTask(async () => response({ error: 'Sign in' }, 401), {}, false, null, () => {})).kind, 'rejected');
 let requested;
 const result = await submitTask(async url => { requested = url; return response({ id, status: 'In Progress', assignedAgentId: agentId, assignedAgentName: 'Sage' }, 201); }, {}, true, null, () => {});
 assert.equal(requested, '/api/tasks/instant-match'); assert.equal(result.kind, 'assigned');
});
