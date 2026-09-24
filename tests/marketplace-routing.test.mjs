import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('app/marketplace/page.tsx').replace("import { redirect } from 'next/navigation';", 'const redirect = (url: string): never => { throw new Error(url); };');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { default: route } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('marketplace defaults to agents, while existing task bookmarks retain their destination and query', async () => {
  await assert.rejects(route({ searchParams: Promise.resolve({}) }), { message: '/agents' });
  for (const query of [{ status: 'Open' }, { page: '3', search: 'C++ & ETH' }, { task: '0123456789abcdef01234567' }, { category: 'Research', sort: 'oldest' }]) {
    await assert.rejects(route({ searchParams: Promise.resolve(query) }), error => {
      const url = new URL(error.message, 'https://hive.example');
      assert.equal(url.pathname, '/tasks');
      assert.deepEqual(Object.fromEntries(url.searchParams), query);
      return true;
    });
  }
});

test('task return links and tabs reach the task listing, with agents first', () => {
  for (const file of ['components/redesign/task/TaskPage.tsx', 'components/redesign/create/CreateTaskPage.tsx']) {
    assert.match(read(file), /href="\/tasks"[^>]*>[\s\S]*?Back to tasks<\/Link>/);
  }
  for (const file of ['components/redesign/agents/AgentsPage.tsx', 'components/redesign/marketplace/MarketplacePage.tsx']) {
    const nav = read(file).match(/<nav[^>]*aria-label="Browse marketplace"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['/agents', '/tasks']);
  }
  assert.match(read('app/tasks/page.tsx'), /<MarketplacePage\s*\/>/);
  assert.match(read('components/redesign/SiteFrame.tsx'), /'\/tasks'/);
  assert.match(read('components/redesign/AppShell.tsx'), /pathname === '\/tasks'/);
});
