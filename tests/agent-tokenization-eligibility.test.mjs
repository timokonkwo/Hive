import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metadata, sessionPreview, sessionRuntime } from '../scripts/tokenization/modules.mjs';
import { agent, agentId } from './helpers/tokenization-fixture.mjs';

const enabled = {
  PONS_LAUNCH_ENABLED: 'true', PONS_RECONCILIATION_ENABLED: 'true',
  AGENT_MULTI_PLATFORM_LAUNCHES_ENABLED: 'true', AGENT_MULTI_PLATFORM_RECOVERY_ENABLED: 'true',
  CRON_SECRET: 'fixture', TOKENIZATION_JOURNAL_KEY: '9'.repeat(64), BAGS_AGENT_API_KEY: 'fixture',
  CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'fixture',
};
function launchEnvironment(t) {
  const previous = Object.fromEntries(Object.keys(enabled).map(key => [key, process.env[key]]));
  Object.assign(process.env, enabled);
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
}
const emptyDb = { collection: () => ({ findOne: async () => null }) };

test('admin can select every launch platform regardless of registration status', async t => {
  launchEnvironment(t);
  for (const status of [undefined, null, 'active', 'pending', 'inactive', 'suspended', 'legacy']) {
    const profile = { ...agent, status };
    const preview = metadata.profilePreview(agentId, profile, 'admin');
    assert.deepEqual(preview.issues, [], `admin profile status: ${status}`);
    const details = await sessionPreview.sessionPreview(emptyDb, profile, preview);
    assert.equal(details.options.length, 3);
    assert.ok(details.options.every(option => option.available), `admin platform status: ${status}`);
  }
  const incomplete = { status: 'pending', name: 'Incomplete agent' };
  const preview = metadata.profilePreview(agentId, incomplete, 'admin');
  assert.deepEqual(preview.issues, [], 'admin can launch without a completed bio');
  assert.equal(preview.metadata.description, metadata.HIVE_AGENT_ATTRIBUTION);
  const details = await sessionPreview.sessionPreview(emptyDb, incomplete, preview);
  assert.ok(details.options.every(option => option.available), 'missing bio/wallet does not prevent reaching admin review');
  assert.ok(preview.adminProfile, 'admin can supply the token details in the review editor');
});

test('legacy owners can launch; incomplete owner registration has a specific reason', async t => {
  launchEnvironment(t);
  for (const status of [undefined, null, 'active', 'pending', 'suspended']) {
    const profile = { ...agent, status }, allowed = status == null || status === 'active';
    const preview = metadata.profilePreview(agentId, profile, 'owner');
    const details = await sessionPreview.sessionPreview(emptyDb, profile, preview);
    assert.equal(details.options.every(option => option.available), allowed);
    if (!allowed) assert.ok(details.options.every(option => option.reason && option.reason !== 'Unavailable'));
  }
});

test('admin status allowance also reaches automatic and connected-wallet execution', async t => {
  launchEnvironment(t);
  for (const status of [undefined, 'pending', 'suspended']) {
    const profile = { ...agent, status }, preview = metadata.profilePreview(agentId, profile, 'admin');
    // Exercise the real runtime gates; replace persistence and external providers.
    const db = { collection: name => ({ findOne: async () => name === 'agents' ? profile : {},
      findOneAndUpdate: async () => ({}), deleteOne: async () => ({}) }) };
    const runtime = new sessionRuntime.SessionRuntime(db);
    runtime.reconcile = async session => session;
    runtime.response = async session => ({ session });
    runtime.update = async (session, platform, result) => ({ ...session,
      targets: session.targets.map(target => target.terms.platform === platform ? { ...target, ...result } : target) });
    let prepared = 0, confirmed = 0;
    runtime.solana = { prepare: async () => { prepared++; return null; },
      reconcile: async () => ({ phase: 'preparing' }), confirm: async () => { confirmed++; } };
    for (const platform of ['pons', 'bags', 'pump']) {
      const session = { id: 'test', agentId, role: 'admin', walletPolicy: 'payer', digest: 'review',
        targets: [{ phase: 'preparing', terms: { platform, mode: platform === 'pons' ? 'connected' : 'managed' } }],
        approval: { digest: 'review', expiresAt: new Date(Date.now() + 60000).toISOString() } };
      await runtime.advance(session, preview, async () => {});
      runtime.require = async () => ({ ...session, approval: undefined });
      await runtime.act(preview, { action: 'prepare', id: session.id });
      if (platform !== 'pons') await runtime.act(preview, { action: 'confirm', id: session.id, stepId: 'step', confirmation: 'digest' });
    }
    assert.equal(prepared, 4);
    assert.equal(confirmed, 2);
    const owner = { ...preview, role: 'owner' };
    runtime.require = async () => ({ id: 'test', agentId, role: 'owner', walletPolicy: 'payer',
      targets: [{ phase: 'preparing', terms: { platform: 'pons', mode: 'connected' } }] });
    if (status) await assert.rejects(runtime.act(owner, { action: 'prepare', id: 'test' }), /registering|inactive/);
  }
});
