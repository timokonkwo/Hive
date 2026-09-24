import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://localhost:3000';
const expectedImage = 'https://uphive.xyz/og/hive-lime-2026-09.png';
const paths = ['/', '/agents', '/marketplace', '/docs', '/token', '/token?view=stake', '/token/claim', '/roadmap', '/registry', '/create', '/feedback', '/dao', '/dashboard', '/agent/register', '/agent/recover', '/agent/dashboard', '/analytics', '/admin', '/agent/brand-preview-check', '/marketplace/not-a-task', '/leaderboard', '/overview', '/feed'];
const results = [];
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");
async function checkPage(path) {
  const response = await fetch(base + path, { headers: { 'User-Agent': 'Twitterbot/1.0' }, signal: AbortSignal.timeout(45000) });
  assert.ok([200, 404].includes(response.status), `${path}: HTTP ${response.status}`);
  const html = await response.text();
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)])));
  const values = name => tags.filter(tag => (tag.property || tag.name) === name).map(tag => tag.content);
  assert.deepEqual(values('og:image'), [expectedImage], `${path}: OG image`);
  assert.deepEqual(values('twitter:image'), [expectedImage], `${path}: Twitter image`);
  assert.deepEqual(values('og:image:width'), ['1200'], `${path}: image width`);
  assert.deepEqual(values('og:image:height'), ['630'], `${path}: image height`);
  assert.deepEqual(values('twitter:card'), ['summary_large_image'], `${path}: Twitter card`);
  assert.deepEqual(values('twitter:title'), values('og:title'), `${path}: page-specific Twitter title`);
  results.push({ path, status: response.status, image: values('og:image')[0] });
}
for (let index = 0; index < paths.length; index += 4) {
  const batch = await Promise.allSettled(paths.slice(index, index + 4).map(checkPage));
  for (const result of batch) if (result.status === 'rejected') throw result.reason;
}
const asset = await fetch(base + '/og/hive-lime-2026-09.png');
assert.equal(asset.status, 200);
assert.match(asset.headers.get('content-type') || '', /image\/png/);
const bytes = Buffer.from(await asset.arrayBuffer());
assert.deepEqual(bytes, await readFile(new URL('../public/og/hive-lime-2026-09.png', import.meta.url)));
assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
for (const [type, query] of [['default', ''], ['agent', '&name=Research%20Agent&bio=Research%20and%20reports&tasks=12&rating=4.8&reviews=6'], ['task', '&title=Review%20a%20smart%20contract&desc=Independent%20security%20review&budget=500&category=Security']]) {
  const response = await fetch(base + '/api/og?type=' + type + query, { redirect: 'manual', signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${type}: renderer must work, not redirect`);
  assert.match(response.headers.get('content-type') || '', /image\/png/);
  const image = Buffer.from(await response.arrayBuffer());
  assert.equal(image.readUInt32BE(16), 1200); assert.equal(image.readUInt32BE(20), 630);
  await writeFile('/private/tmp/hive-og-' + type + '.png', image);
}
await writeFile('/private/tmp/hive-social-metadata-report.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), pages: results, generatedImages: 3 }, null, 2));
console.log(JSON.stringify({ base, pagesPassed: results.length, image: expectedImage, generatedImages: 3 }));
