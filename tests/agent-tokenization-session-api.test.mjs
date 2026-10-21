import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as mongodb from 'mongodb';
import * as crypto from 'node:crypto';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { sessions, metadata, platforms, sessionPreview } from '../scripts/tokenization/modules.mjs';
import { agent, agentId } from './helpers/tokenization-fixture.mjs';
const load = (path, imports) => loadTypeScript(new URL(path, import.meta.url), imports);
const next = { NextResponse: { json: (body, options) => Response.json(body, options) } };
const params = { params: Promise.resolve({ address: agentId }) };
function harness() {
  const state = { authorized: true, reads: 0, creations: 0, actions: 0, session: null, agent: { ...agent, status: 'active' } };
  const db = { collection: () => ({ findOne: async () => { state.reads++; return state.agent; } }) };
  const http = load('../lib/agent-tokenization/http.ts', {
    'next/server': next, mongodb, '@/lib/db': { getDb: async () => db },
    '@/lib/rate-limit': { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'fixture' },
    './session': sessions, './session-access': { sessionPonsPreview: async () => { throw Error('Session API must not enter standalone Pons.'); } },
    './access': { authorizeTokenization: async () => state.authorized ? null : Response.json({}, { status: 401 }) },
    './metadata': metadata, './authorization': { LaunchAuthorizationError: class extends Error {} },
    './store': { LaunchConflict: class extends Error {} }, './release': {},
  });
  const wallets = { evm: '0x' + '1'.repeat(40), solana: sessions.HIVE_SOLANA_FEE_WALLET };
  const preview = async (_db, value, p) => ({ preview: p, profileRevision: metadata.profileRevision(value), wallets,
    session: state.session, tokens: [], options: platforms.platformIds.map(platform => ({ platform, available: true })) });
  const route = load('../app/api/agents/[address]/tokenization/session/route.ts', {
    'next/server': next, mongodb, '@/lib/agent-tokenization/http': http,
    '@/lib/agent-tokenization/session': sessions, '@/lib/agent-tokenization/metadata': metadata,
    '@/lib/agent-tokenization/platforms': platforms,
    '@/lib/agent-tokenization/profile-lease': { withAgentProfileLease: async (_db, _id, fn) => fn(async () => {}) },
    '@/lib/agent-tokenization/session-edit': { reviseSession: async () => { throw Error('Unexpected edit'); } },
    '@/lib/agent-tokenization/session-preview': { sessionPreview: preview, verifiedLaunchWallets: () => wallets },
    '@/lib/agent-tokenization/session-store': { SessionStore: class {
      async current() { return state.session ? { session: state.session } : null; }
      async create(session) { state.creations++; state.session = session; return session; }
    } },
    '@/lib/agent-tokenization/session-runtime': { SessionRuntime: class {
      async response(session) { return { session, review: null }; }
      async act(p, body) {
        state.actions++;
        if (state.session?.role !== p.role || state.session?.id !== body.id) throw new sessions.SessionConflict('The launch session changed.');
        return { session: state.session, review: null };
      }
    } },
  });
  function request(body, role = 'admin', origin = 'https://uphive.xyz') {
    const url = new URL(`https://uphive.xyz/api/agents/${agentId}/tokenization/session?role=${role}`);
    return Object.assign(new Request(url, { ...(body ? { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin } } : {}) }), { nextUrl: url });
  }
  const create = () => ({ action: 'create', id: randomUUID(), revision: metadata.profileRevision(state.agent), symbol: 'SAGE',
    choices: [{ platform: 'pump', mode: 'managed', signer: sessions.HIVE_SOLANA_FEE_WALLET, purchase: '0' }] });
  return { route, state, request, create };
}
test('session endpoints authorize before profile reads and reject foreign origins and caller-supplied receipt data', async () => {
  const h = harness(); h.state.authorized = false;
  assert.equal((await h.route.GET(h.request(), params)).status, 401);
  assert.equal(h.state.reads, 0); h.state.authorized = true;
  assert.equal((await h.route.POST(h.request(h.create(), 'admin', 'https://foreign.example'), params)).status, 403);
  assert.equal(h.state.reads, 0);
  for (const extra of [{ token: { address: 'fake' } }, { phase: 'confirmed' }, { recipient: 'override' }]) {
    assert.equal((await h.route.POST(h.request({ ...h.create(), ...extra }), params)).status, 400);
  }
  assert.equal(h.state.creations, 0);
});
test('lost create responses replay the same frozen session, but changed costs, roles and metadata cannot reuse its ID', async () => {
  const h = harness(), body = h.create();
  const first = await h.route.POST(h.request(body), params);
  assert.equal(first.status, 200); assert.equal(first.headers.get('cache-control'), 'private, no-store');
  const replay = await h.route.POST(h.request(body), params);
  assert.deepEqual(await replay.json(), await first.json()); assert.equal(h.state.creations, 1);
  for (const changed of [
    { ...body, symbol: 'OTHER' }, { ...body, choices: [{ ...body.choices[0], purchase: '0.1' }] },
    { ...body, revision: 'a'.repeat(64) },
  ]) assert.equal((await h.route.POST(h.request(changed), params)).status, 409);
  assert.equal((await h.route.POST(h.request(body, 'owner'), params)).status, 409);
  assert.equal((await h.route.POST(h.request({ action: 'check', id: body.id }, 'owner'), params)).status, 409);
});
test('session recovery cron is authenticated and independently disabled without invoking a signer', async t => {
  const before = { CRON_SECRET: process.env.CRON_SECRET, AGENT_MULTI_PLATFORM_RECOVERY_ENABLED: process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED };
  t.after(() => { for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  process.env.CRON_SECRET = 'fixture'; delete process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED;
  let calls = 0;
  const route = load('../app/api/cron/agent-launch-sessions/route.ts', {
    'next/server': next, 'node:crypto': crypto, '@/lib/db': { getDb: async () => ({}) },
    '@/lib/agent-tokenization/session-runtime': { recoverLaunchSessions: async () => { calls++; return { checked: 0, errors: 0 }; } },
  });
  const request = auth => new Request('https://uphive.xyz/api/cron/agent-launch-sessions', { headers: { authorization: auth } });
  assert.equal((await route.GET(request('Bearer wrong'))).status, 401);
  assert.deepEqual(await (await route.GET(request('Bearer fixture'))).json(), { enabled: false }); assert.equal(calls, 0);
  process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED = 'true';
  assert.deepEqual(await (await route.GET(request('Bearer fixture'))).json(), { enabled: true, checked: 0, errors: 0 }); assert.equal(calls, 1);
});
test('verified Solana adapters require recovery, encryption and their provider configuration', t => {
  const values = { AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED: 'true', AGENT_MULTI_PLATFORM_RECOVERY_ENABLED: 'true',
    CRON_SECRET: 'fixture', TOKENIZATION_JOURNAL_KEY: '9'.repeat(64), CLOUDINARY_CLOUD_NAME: 'fixture',
    CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'fixture', BAGS_AGENT_API_KEY: 'fixture' };
  const previous = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  assert.equal(sessionPreview.solanaLaunchesEnabled('pump'), true);
  assert.equal(sessionPreview.solanaLaunchesEnabled('bags'), true);
  delete process.env.BAGS_AGENT_API_KEY;
  assert.equal(sessionPreview.solanaLaunchesEnabled('bags'), false);
  assert.equal(sessionPreview.solanaLaunchesEnabled('pump'), true);
  process.env.BAGS_AGENT_API_KEY=values.BAGS_AGENT_API_KEY;
  for (const key of ['AGENT_MULTI_PLATFORM_RECOVERY_ENABLED', 'TOKENIZATION_JOURNAL_KEY', 'CRON_SECRET']) {
    delete process.env[key]; assert.equal(sessionPreview.solanaLaunchesEnabled('pump'), false); process.env[key] = values[key];
  }
});
