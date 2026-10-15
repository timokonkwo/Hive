import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { loadTypeScript } from './helpers/load-typescript.mjs';
import { agentId, intentFixture, hash } from './helpers/tokenization-fixture.mjs';
const load = (path, imports) => loadTypeScript(new URL(path, import.meta.url), imports);
const next = { NextResponse: { json: (body, options) => Response.json(body, options) } };
const params = address => ({ params: Promise.resolve({ address }) });
const request = (role, authorization = '') => ({ nextUrl: new URL(`https://hive.test/api?role=${role}`), headers: new Headers({ authorization }) });

test('status authenticates both roles and returns only safe recovery fields', async () => {
  let authenticated = false, admin = false, reads = 0, allowed = true, intent = { ...intentFixture(), leaseId: 'secret-lock', lastError: 'internal', transactionHash: hash };
  const access = load('../lib/agent-tokenization/access.ts', {
    'next/server': next,
    '@/lib/api-key': { authenticateRequest: async () => authenticated ? { agent: { id: agentId } } : null },
    '@/lib/admin-auth': { verifyAdmin: async () => admin ? {} : { error: Response.json({}, { status: 403 }) } },
  });
  const route = load('../app/api/agents/[address]/tokenization/status/route.ts', {
    'next/server': next, '@/lib/db': { getDb: async () => ({}) }, '@/lib/agent-tokenization/access': access,
    '@/lib/agent-tokenization/store': { LaunchStore: class { async current() { reads++; return intent; } } },
    '@/lib/agent-tokenization/release': { launchesEnabled: () => false },
    '@/lib/rate-limit': { checkRateLimit: () => ({ allowed }), getClientIp: () => 'fixture', RATE_LIMITS: { READ: {} } },
  });
  assert.equal((await route.GET(request('owner'), params(agentId))).status, 401);
  assert.equal((await route.GET(request('admin'), params(agentId))).status, 403);
  assert.equal((await route.GET(request('wrong'), params(agentId))).status, 400);
  authenticated = true;
  assert.equal((await route.GET(request('owner'), params('a'.repeat(24)))).status, 403);
  assert.equal(reads, 0);
  const response = await route.GET(request('owner'), params(agentId));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.signingEnabled, false);
  assert.deepEqual(Object.keys(body.launch).sort(), ['id','mode','phase','signer','role','transactionHash','cancellationHash','token','canRetry','canCancel','updatedAt'].sort());
  assert.equal(body.launch.canRetry, false); assert.equal(body.launch.canCancel, false); assert.equal(body.launch.token, null);
  intent = { ...intent, phase: 'cancelled' }; admin = true;
  assert.equal((await (await route.GET(request('admin'), params(agentId))).json()).launch.canRetry, true);
  intent = null;
  assert.equal((await (await route.GET(request('owner'), params(agentId))).json()).launch, null);
  allowed = false;
  assert.equal((await route.GET(request('owner'), params(agentId))).status, 429);
  assert.equal(route.POST, undefined);
});

test('cron requires authentication, stays disabled by default and never creates a wallet client', async t => {
  const before = { secret: process.env.CRON_SECRET, enabled: process.env.PONS_RECONCILIATION_ENABLED };
  t.after(() => {
    for (const [key, value] of [['CRON_SECRET', before.secret], ['PONS_RECONCILIATION_ENABLED', before.enabled]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.CRON_SECRET = 'test-only-secret'; delete process.env.PONS_RECONCILIATION_ENABLED;
  let dbCalls = 0, rpcCalls = 0, runs = 0, signerChecks = 0;
  const managedStatus = { available: true, address: '0x' + '1'.repeat(40) };
  const route = load('../app/api/cron/pons-launches/route.ts', {
    'node:crypto': crypto, 'next/server': next,
    viem: { http: () => 'fixture', createPublicClient: () => { rpcCalls++; return { readOnly: true }; } },
    '@/lib/db': { getDb: async () => { dbCalls++; return {}; } },
    '@/lib/agent-tokenization/managed': { retryManagedSubmissions: async () => {} },
    '@/lib/agent-tokenization/managed-signer': { managedDeployerStatus: () => { signerChecks++; return managedStatus; } },
    '@/lib/agent-tokenization/worker': { runLaunchRecovery: async (_db, client) => {
      assert.equal(client.readOnly, true); runs++; return { checked: 0, confirmed: 0, published: 0, errors: 0 };
    } },
  });
  for (const header of ['', 'Bearer bad', 'Bearer test-only-secreu']) assert.equal((await route.GET(request('', header))).status, 401);
  const valid = request('', 'Bearer test-only-secret');
  assert.deepEqual(await (await route.GET(valid)).json(), { enabled: false });
  assert.deepEqual([dbCalls, rpcCalls, runs, signerChecks], [0, 0, 0, 0]);
  process.env.PONS_RECONCILIATION_ENABLED = 'true';
  const result = await route.GET(valid);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { enabled: true, checked: 0, confirmed: 0, published: 0, errors: 0, managedDeployer: managedStatus });
  assert.deepEqual([dbCalls, rpcCalls, runs, signerChecks], [1, 1, 1, 1]);
  delete process.env.CRON_SECRET;
  assert.equal((await route.GET(request('', 'Bearer '))).status, 401);
});

function mutationHttp({ reviewed = null, denied = null } = {}) {
  const counters = { reads: 0, operations: 0 };
  const loaded = load('../lib/agent-tokenization/http.ts', {
    'next/server': next, mongodb: { ObjectId: class {} },
    '@/lib/db': { getDb: async () => ({ collection: () => ({ findOne: async () => { counters.reads++; return {}; } }) }) },
    '@/lib/rate-limit': { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'test' },
    './access': { authorizeTokenization: async () => denied },
    './metadata': { profilePreview: () => intentFixture().preview },
    './authorization': { LaunchAuthorizationError: class extends Error {} },
    './store': { LaunchConflict: class extends Error {} }, './release': { reviewedLaunchRelease: reviewed, launchesEnabled: () => process.env.PONS_LAUNCH_ENABLED === 'true' && reviewed?.reviewed === true },
  });
  return { ...loaded, counters };
}
const mutationRequest = (body, origin = 'https://uphive.xyz') => Object.assign(new Request('https://uphive.xyz/api?role=owner', {
  method: 'POST', headers: { 'content-type':'application/json', origin }, body: typeof body === 'string' ? body : JSON.stringify(body),
}), { nextUrl: new URL('https://uphive.xyz/api?role=owner') });

test('launch mutations reject unauthorized and foreign-origin calls before reading agent data', async () => {
  const denied = mutationHttp({ denied: Response.json({}, {status:401}) });
  const operation = async () => { throw Error('Must not run'); };
  assert.equal((await denied.withLaunchAccess(mutationRequest({}), params(agentId).params, operation)).status,401);
  assert.equal(denied.counters.reads,0);
  const http = mutationHttp();
  assert.equal((await http.withLaunchAccess(mutationRequest({},'https://evil.test'),params(agentId).params,operation)).status,403);
  assert.equal(http.counters.reads,0);
});

test('launch body parser bounds actual bytes and rejects caller overrides and malformed payloads', async () => {
  const http = mutationHttp();
  assert.deepEqual(await http.readLaunchBody(mutationRequest({signature:'fixture'}),['signature']),{signature:'fixture'});
  for (const body of [{recipient:'override'},[],null,'{broken',JSON.stringify({signature:'x'.repeat(9000)})]) {
    await assert.rejects(http.readLaunchBody(mutationRequest(body),['signature']));
  }
});

test('a server flag alone cannot unlock an unreviewed launch release', t => {
  const before = process.env.PONS_LAUNCH_ENABLED;
  t.after(() => { if (before === undefined) delete process.env.PONS_LAUNCH_ENABLED; else process.env.PONS_LAUNCH_ENABLED = before; });
  process.env.PONS_LAUNCH_ENABLED = 'true';
  assert.throws(() => mutationHttp().requireLaunchRelease(), /not available/);
  assert.throws(() => mutationHttp({reviewed:{reviewed:false}}).requireLaunchRelease(), /not available/);
  assert.deepEqual(mutationHttp({reviewed:{reviewed:true}}).requireLaunchRelease(),{reviewed:true});
  delete process.env.PONS_LAUNCH_ENABLED;
  assert.throws(() => mutationHttp({reviewed:{reviewed:true}}).requireLaunchRelease(), /not available/);
});

test('preparation route returns exact wallet fields and never leaks internal journal data', async () => {
  const { journal } = await import('../scripts/tokenization/modules.mjs');
  const http = mutationHttp();
  let intent = intentFixture();
  const route = load('../app/api/agents/[address]/tokenization/prepare/route.ts', {
    'next/server': next, viem: { createPublicClient:()=>({}),http:()=>'',toHex:value=>'0x'+BigInt(value).toString(16) },
    '@/lib/agent-tokenization/avatar': { persistTokenAvatar:async()=>'' },
    '@/lib/agent-tokenization/preparation': { prepareAuthorizedLaunch:async()=>intent },
    '@/lib/agent-tokenization/journal': journal,
    '@/lib/agent-tokenization/http': { ...http, requireLaunchRelease:()=>({reviewed:true}) },
  });
  const req=()=>mutationRequest({challengeId:'fixture',signature:'fixture'});
  let response = await route.POST(req(),params(agentId));
  const data=await response.json();
  assert.equal(data.transaction.chainId,'0x1237'); assert.equal(data.transaction.nonce,'0x4');
  assert.equal(data.transaction.value,'0x1c6bf52634000');
  assert.equal(data.maximumTotal,journal.unpackPrepared(intent.prepared).maximumTotal.toString());
  assert.equal(data.prepared,undefined); assert.equal(data.preview,undefined); assert.equal(data.salt,undefined);
  intent={...intent,phase:'submitted',transactionHash:hash};
  response=await route.POST(req(),params(agentId));
  assert.equal((await response.json()).transaction,null);
  assert.equal((await route.POST(mutationRequest({challengeId:'fixture',signature:'fixture',recipient:'override'}),params(agentId))).status,400);
});

test('draft cancellation remains available when launches are paused and rejects stale IDs', async () => {
  const http=mutationHttp();
  let cancelled=0, intent={...intentFixture(),phase:'draft'};
  const route=load('../app/api/agents/[address]/tokenization/cancel/route.ts',{
    'next/server':next,
    '@/lib/agent-tokenization/http':{...http,requireLaunchRelease:()=>{throw Error('Must not require an active release');}},
    '@/lib/agent-tokenization/store':{LaunchStore:class {
      async current(){return intent;}
      async cancelDraft(value){assert.equal(value.phase,'draft');cancelled++;intent={...intent,phase:'cancelled'};}
    }},
  });
  assert.equal((await route.POST(mutationRequest({id:'stale'}),params(agentId))).status,409);
  assert.equal(cancelled,0);
  assert.equal((await route.POST(mutationRequest({id:intent._id}),params(agentId))).status,200);
  assert.equal((await route.POST(mutationRequest({id:intent._id}),params(agentId))).status,200);
  assert.equal(cancelled,1);
});

test('broadcast recording requires the saved launch and verifies the hash before storing it', async () => {
  const http=mutationHttp();
  let verifications=0,intent=intentFixture();
  const route=load('../app/api/agents/[address]/tokenization/broadcast/route.ts',{
    'next/server':next,viem:{createPublicClient:()=>({}),http:()=>''},
    '@/lib/agent-tokenization/http':http,
    '@/lib/agent-tokenization/store':{LaunchStore:class {async current(){return intent;}}},
    '@/lib/agent-tokenization/policy':{validHash:value=>typeof value==='string'&&/^0x[a-f0-9]{64}$/.test(value)},
    '@/lib/agent-tokenization/worker':{acceptBroadcast:async(_client,_store,saved,value)=>{
      verifications++;assert.equal(value,hash);return {...saved,phase:'submitted'};
    }},
  });
  assert.equal((await route.POST(mutationRequest({id:'stale',transactionHash:hash}),params(agentId))).status,409);
  assert.equal(verifications,0);
  assert.equal((await route.POST(mutationRequest({id:intent._id,transactionHash:'bad'}),params(agentId))).status,400);
  assert.equal((await (await route.POST(mutationRequest({id:intent._id,transactionHash:hash}),params(agentId))).json()).phase,'submitted');
  assert.equal(verifications,1);
  intent={...intent,phase:'confirmed',transactionHash:hash};
  assert.equal((await route.POST(mutationRequest({id:intent._id,transactionHash:hash}),params(agentId))).status,200);
  assert.equal(verifications,1);
});

test('launch capability requires reviewed code, recovery and image storage configuration together',t=>{
  const keys=['PONS_LAUNCH_ENABLED','PONS_RECONCILIATION_ENABLED','CRON_SECRET','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'];
  const before=keys.map(key=>[key,process.env[key]]);
  t.after(()=>{for(const [key,value]of before){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  for(const key of keys)process.env[key]=key.endsWith('_ENABLED')?'true':'test-only';
  const release=load('../lib/agent-tokenization/release.ts',{});
  const reviewed=release.reviewedLaunchRelease;
  assert.equal(reviewed.reviewed,true);
  assert.equal(Object.keys(reviewed.contracts).length,5);
  release.reviewedLaunchRelease=null;assert.equal(release.launchesEnabled(),false);
  // The tooling loader uses CommonJS exports: substitute a reviewed manifest only inside this test.
  release.reviewedLaunchRelease={reviewed:true};assert.equal(release.launchesEnabled(),true);
  for(const key of keys){const value=process.env[key];delete process.env[key];assert.equal(release.launchesEnabled(),false,key);process.env[key]=value;}
});
