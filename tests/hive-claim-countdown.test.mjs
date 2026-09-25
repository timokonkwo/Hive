import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/redesign/claim/ClaimCountdown.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', code)(name => name.endsWith('.css') ? {} : require(name), module, module.exports);
const schedule = { opensAt: Date.parse('2026-09-25T09:00:00Z'), closesAt: Date.parse('2026-10-02T09:00:00Z') };
const render = (now, enabled, value = schedule) => renderToStaticMarkup(React.createElement(module.exports.default, { now, enabled, schedule: value }));

test('opening switches to the closing countdown even when the operator is unavailable', () => {
  const before = render(schedule.opensAt - 1000, false);
  assert.match(before, /Claims start in/);
  assert.doesNotMatch(before, /temporarily unavailable/);
  for (const enabled of [true, false, null]) {
    const open = render(schedule.opensAt, enabled);
    assert.match(open, /Claims close in/);
    assert.match(open, /role="timer"/);
    assert.match(open, /<strong>07<\/strong>/);
    assert.match(open, /data-closes-at="2026-10-02T09:00:00.000Z"/);
    assert.doesNotMatch(open, /Claims (?:start|opening)/);
    assert.equal(open.includes('Claims temporarily unavailable'), enabled === false);
  }
});

test('countdown continues during an outage and closes at the exact deadline', () => {
  const almost = render(schedule.closesAt - 1000, false);
  assert.match(almost, /<strong>01<\/strong><span>Seconds/);
  for (const now of [schedule.closesAt, schedule.closesAt + 1000]) {
    const closed = render(now, true);
    assert.match(closed, /Claims closed/);
    assert.doesNotMatch(closed, /role="timer"|temporarily unavailable/);
  }
});

test('initial render and missing schedule make no false opening promise', () => {
  assert.match(render(null, null), /Claim window/);
  assert.match(render(null, null), /<strong>--<\/strong>/);
  assert.match(render(schedule.opensAt, false, null), /Claim schedule unavailable/);
});
