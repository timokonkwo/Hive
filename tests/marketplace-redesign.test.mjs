import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../components/redesign/marketplace/model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readFilters, pageUrl, tasksUrl, readTaskResponse, dateLabel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const task = { id: '0123456789abcdef01234567', title: 'Review the protocol documentation', category: 'Research', status: 'Open', budget: '$15 USDC', proposalsCount: 0 };

test('URL state rejects malformed pages, filters and unsafe task identifiers', () => {
  const filters = readFilters(new URLSearchParams('page=-1&category=invalid&status=invalid&sort=budget&task=../../create'));
  assert.equal(filters.page, 1);
  assert.equal(filters.category, 'All');
  assert.equal(filters.status, 'All');
  assert.equal(filters.sort, 'newest');
  assert.equal(filters.task, '');
  for (const page of ['NaN', 'Infinity', '1.5', '100001', '0']) assert.equal(readFilters(new URLSearchParams({ page })).page, 1);
});

test('search and discrete filters survive encoding, bookmarking and reload', () => {
  const filters = { search: 'C++ / ETH & [fees].*', category: 'Token Launch', status: 'In Review', sort: 'proposals', page: 4, task: task.id };
  const url = new URL(pageUrl(filters), 'https://hive.example');
  assert.deepEqual(readFilters(url.searchParams), filters);
  const api = new URL(tasksUrl(filters), 'https://hive.example');
  assert.equal(api.searchParams.get('search'), filters.search);
  assert.equal(api.searchParams.get('sort'), 'proposalsCount');
  assert.equal(api.searchParams.get('order'), 'desc');
  assert.equal(api.searchParams.get('limit'), '12');
  assert.equal(api.searchParams.has('task'), false);
});

test('default tasks include all statuses and explicit Open survives URLs', () => {
  const defaults = readFilters(new URLSearchParams());
  assert.equal(pageUrl(defaults), '/marketplace');
  assert.equal(new URL(tasksUrl(defaults), 'https://hive.example').searchParams.has('status'), false);
  const open = { ...defaults, status: 'Open' };
  assert.equal(readFilters(new URL(pageUrl(open), 'https://hive.example').searchParams).status, 'Open');
  assert.equal(new URL(tasksUrl(open), 'https://hive.example').searchParams.get('status'), 'Open');
  assert.equal(new URL(tasksUrl({ ...defaults, status: 'All' }), 'https://hive.example').searchParams.has('status'), false);
});

test('missing budgets and proposal counts remain missing, while zero is preserved', () => {
  const data = readTaskResponse({ tasks: [{ ...task, budget: null, proposalsCount: undefined }], total: 1 });
  assert.equal(data.tasks[0].budget, 'Not listed');
  assert.equal(data.tasks[0].proposals, null);
  assert.equal(readTaskResponse({ tasks: [task], total: 1 }).tasks[0].proposals, 0);
  assert.equal(readTaskResponse({ tasks: [{ ...task, budget: 'Negotiable' }], total: 1 }).tasks[0].budget, 'Negotiable');
  assert.equal(readTaskResponse({ tasks: [{ ...task, budget: '1.5–3 ETH' }], total: 1 }).tasks[0].budget, '1.5–3 ETH');
});

test('invalid payloads cannot masquerade as an empty marketplace', () => {
  for (const payload of [null, {}, { error: 'failure' }, { tasks: [], total: -1 }, { tasks: [], total: '3' }, { tasks: [task], total: 0 }, { tasks: [task, task], total: 2 }, { tasks: [{ ...task, id: '../../create' }], total: 1 }]) {
    assert.throws(() => readTaskResponse(payload));
  }
});

test('invalid dates, absent status and unknown counts are never displayed as facts', () => {
  const item = readTaskResponse({ tasks: [{ ...task, createdAt: 'invalid', deadline: null, status: null, proposalsCount: -1 }], total: 1 }).tasks[0];
  assert.equal(item.createdAt, null);
  assert.equal(item.deadline, null);
  assert.equal(item.status, 'Status not listed');
  assert.equal(item.proposals, null);
  assert.equal(dateLabel(null), 'Not listed');
});
