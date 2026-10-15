// Operates only on Hive's existing production site. Never prints credential values.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
export const siteId = '0f6ae960-8594-44a2-a892-84c18fdb3b64';
const accountId = '68762b6ff4d952f16d11229e';
const config = JSON.parse(readFileSync(homedir() + '/Library/Preferences/netlify/config.json', 'utf8'));
const token = config.users?.[config.userId]?.auth?.token;
if (!token) throw Error('Netlify login is required.');
export async function request(path, method = 'GET', body) {
  const response = await fetch('https://api.netlify.com/api/v1' + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`Netlify ${method} failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
const productionValue = row => row?.values?.find(v => v.context === 'production') || row?.values?.find(v => v.context === 'all');
async function inspect() {
  const site = await request(`/sites/${siteId}`);
  if (site.custom_domain !== 'uphive.xyz' || site.name !== 'hive-protocol') throw Error('Unexpected target site.');
  const rows = await request(`/accounts/${accountId}/env?site_id=${siteId}`);
  const key = rows.find(r => r.key === 'PONS_MANAGED_PRIVATE_KEY');
  const keyReady = !!key?.is_secret && key.scopes?.length === 1 && key.scopes[0] === 'functions'
    && key.values?.some(v => v.context === 'production') && !key.values?.some(v => v.context !== 'production');
  return { site, rows, keyReady };
}
async function main() {
  const mode = process.argv[2] || 'status';
  if (!['status', 'configure', 'health', 'deploy'].includes(mode)) throw Error('Use status, configure, health, or deploy.');
  const { site, rows, keyReady } = await inspect();
  if (mode === 'status') {
    console.log(JSON.stringify({ site: site.name, domain: site.custom_domain, publishedDeploy: site.published_deploy?.id,
      managedKeyConfigured: keyReady, settings: rows.filter(r => r.key.startsWith('PONS_') || r.key === 'CRON_SECRET').map(r => ({ key:r.key, scopes:r.scopes, contexts:r.values?.map(v=>v.context) })) }, null, 2));
    return;
  }
  if (mode === 'health' || mode === 'deploy') {
    let secret = productionValue(rows.find(r => r.key === 'CRON_SECRET'))?.value;
    if (mode === 'deploy') {
      const cwd = process.argv[3];
      if (!cwd || JSON.parse(readFileSync(`${cwd}/.netlify/state.json`, 'utf8')).siteId !== siteId) throw Error('Provide a build checkout linked to Hive production.');
      if (lstatSync(`${cwd}/node_modules`).isSymbolicLink()) throw Error('Build dependencies must be installed inside the checkout.');
      if (['.env', '.env.local', '.env.production', '.env.production.local'].some(name => existsSync(`${cwd}/${name}`))) throw Error('Production builds must use Netlify settings, without local environment files.');
      if (!keyReady) throw Error('Configure the production signer before deploying.');
      // Netlify masks secret values after saving. Retain a fresh worker credential
      // only in this process so the deployed runtime can be verified securely.
      secret = randomBytes(32).toString('hex');
      await request(`/accounts/${accountId}/env/CRON_SECRET?site_id=${siteId}`, 'PATCH', { context:'production', value:secret });
      const result = spawnSync(`${cwd}/node_modules/.bin/netlify`, ['deploy', '--prod', '--context', 'production', '--site', siteId,
        '--message', 'Hosted Hive deployer with verified production recovery'], { cwd, stdio:'inherit' });
      if (result.status !== 0) throw Error('Deployment failed; no runtime health verification was performed.');
    }
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw Error('Netlify masks saved recovery secrets. Use deploy to verify a fresh credential in memory.');
    const response = await fetch('https://uphive.xyz/api/cron/pons-launches', { headers:{Authorization:`Bearer ${secret}`}, signal:AbortSignal.timeout(55000) });
    const data = await response.json();
    console.log(JSON.stringify({ status: response.status, enabled:data.enabled, checked:data.checked, confirmed:data.confirmed, published:data.published, errors:data.errors,
      managedDeployer: data.managedDeployer ? { available:data.managedDeployer.available, address:data.managedDeployer.address } : undefined }));
    if (!response.ok || !data.enabled || data.errors || !data.managedDeployer?.available) process.exitCode = 1;
    return;
  }
  if (!keyReady) {
    const row = await request(`/accounts/${accountId}/env/PONS_MANAGED_PRIVATE_KEY?site_id=${siteId}`);
    const savedValue = productionValue(row)?.value;
    const trimmedValue = typeof savedValue === 'string' ? savedValue.trim() : '';
    const value = /^[a-fA-F0-9]{64}$/.test(trimmedValue) ? `0x${trimmedValue}` : trimmedValue;
    let matches = false;
    try { matches = privateKeyToAccount(value).address.toLowerCase() === '0x31a9fb923f1bcb2ceb1221dbdc06b94a6a749de2'; } catch { /* Never expose key/parser errors. */ }
    if (!matches) throw Error('The configured signer does not match Hive deployer, or its value is unavailable for verification.');
    await request(`/accounts/${accountId}/env/PONS_MANAGED_PRIVATE_KEY?site_id=${siteId}`, 'PUT', {
      key:'PONS_MANAGED_PRIVATE_KEY', is_secret:true, scopes:['functions'], values:[{context:'production',value}],
    });
    console.log('Verified Hive signer and restricted its secret to production functions.');
  }
  const values = {
    PONS_APP_ORIGIN:'https://uphive.xyz', PONS_LAUNCH_ENABLED:'true',
    PONS_RECONCILIATION_ENABLED:'true', PONS_MANAGED_LAUNCH_ENABLED:'true',
  };
  if (!productionValue(rows.find(r => r.key === 'CRON_SECRET'))) values.CRON_SECRET = randomBytes(32).toString('hex');
  for (const [key,value] of Object.entries(values)) {
    const row = rows.find(r => r.key === key);
    if (row) {
      if (!row.scopes.includes('functions')) throw Error(`${key} must include Functions scope.`);
      if (productionValue(row)?.value === value) continue;
      await request(`/accounts/${accountId}/env/${key}?site_id=${siteId}`, 'PATCH', { context:'production', value });
    } else {
      await request(`/accounts/${accountId}/env?site_id=${siteId}`, 'POST', [{ key, is_secret:key==='CRON_SECRET', scopes:['functions'], values:[{ context:'production', value }] }]);
    }
    console.log(`Configured ${key} for production functions.`);
  }
  console.log('Production settings prepared. A deployment is required to apply them.');
}
if (process.argv[1]?.endsWith('/hosting.mjs')) main().catch(error => { console.error(error.message); process.exitCode = 1; });
