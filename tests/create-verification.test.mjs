import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function widget() {
 const source = readFileSync(new URL('../components/security/Turnstile.tsx', import.meta.url), 'utf8');
 const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
 const effects = [], scripts = [], removed = [], window = {};
 const document = { createElement: () => ({ remove() { removed.push(this); } }), head: { appendChild: script => scripts.push(script) } };
 const imports = { react: { useEffect: effect => effects.push(effect), useRef: current => ({ current }) }, 'react/jsx-runtime': { jsx: (_, props) => props } };
 const module = { exports: {} };
 new Function('require', 'module', 'exports', 'window', 'document', code)(name => imports[name], module, module.exports, window, document);
 function mount(props) { const rendered = module.exports.Turnstile(props); if (rendered) rendered.ref.current = {}; return effects.pop()(); }
 return { mount, window, scripts, removed };
}
test('verification uses requested theme and compact size, returns token and cleans up', () => {
 const f = widget(); let options, token, removed;
 f.window.turnstile = { render: (_, value) => { options = value; return 'widget'; }, remove: value => { removed = value; } };
 const cleanup = f.mount({ siteKey: 'public-test-key', theme: 'light', size: 'compact', onVerify: value => { token = value; } });
 assert.equal(options.theme, 'light'); assert.equal(options.size, 'compact'); options.callback('verified-token'); assert.equal(token, 'verified-token'); cleanup(); assert.equal(removed, 'widget');
});
test('failed verification script can be loaded again after explicit retry', () => {
 const f = widget(); let expired = 0;
 const props = { siteKey: 'public-test-key', onVerify() {}, onExpire: () => { expired++; } };
 f.mount(props); assert.equal(f.scripts.length, 1); f.scripts[0].onerror(); assert.equal(f.removed.length, 1); assert.equal(expired, 1);
 f.mount(props); assert.equal(f.scripts.length, 2);
});
