export const feeToken = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const base = 'https://public-api-v2.bags.fm/api/v1/token-launch/';
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function lamports(v: unknown) { if (typeof v !== 'string' || !/^\d{1,40}$/.test(v)) throw Error('Invalid fee amount'); return BigInt(v).toString(); }
export function people(v: unknown) {
  if (!Array.isArray(v) || v.length > 1000) throw Error('Invalid recipient data');
  return v.map(value => { const r = obj(value); if (typeof r.wallet !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.wallet)) throw Error('Invalid recipient'); return { wallet: r.wallet, name: [r.providerUsername, r.bagsUsername, r.username].find(n => typeof n === 'string' && n.trim()) as string || '', shareBps: typeof r.royaltyBps === 'number' && Number.isFinite(r.royaltyBps) && r.royaltyBps >= 0 && r.royaltyBps <= 10000 ? r.royaltyBps : null }; });
}
type Part<T> = { data: T; asOf: string; stale: boolean };
export function createFeeReader(request: typeof fetch, key: () => string, now = () => Date.now()) {
  let cache: { fees: Part<string> | null; recipients: Part<ReturnType<typeof people>> | null; creators: Part<ReturnType<typeof people>> | null; usd: Part<number> | null } = { fees: null, recipients: null, creators: null, usd: null };
  let checked = 0, pending: Promise<ReturnType<typeof result>> | null = null;
  function result() { return { token: feeToken, chain: 'solana', ...cache }; }
  async function update() {
    if (!key()) return result();
    async function read(path: string) { const r = await request(base + path + '?tokenMint=' + feeToken, { headers: { 'x-api-key': key() }, signal: AbortSignal.timeout(4500), cache: 'no-store', redirect: 'error' }); if (!r.ok) throw Error('Unavailable'); const d = obj(await r.json()); if (d.success !== true) throw Error('Unavailable'); return d.response; }
    const responses = await Promise.allSettled([read('lifetime-fees').then(lamports), read('claim-stats').then(people), read('creator/v3').then(people), (async () => { const r = await request('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(3500), cache: 'no-store' }); if (!r.ok) throw Error('Unavailable'); const price = obj(obj(await r.json()).solana).usd; if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw Error('Invalid price'); return price; })()]);
    const stamp = new Date(now()).toISOString();
    function part<T>(r: PromiseSettledResult<T>, old: Part<T> | null): Part<T> | null { return r.status === 'fulfilled' ? { data: r.value, asOf: stamp, stale: false } : old ? { ...old, stale: true } : null; }
    cache = { fees: part(responses[0], cache.fees), recipients: part(responses[1], cache.recipients), creators: part(responses[2], cache.creators), usd: part(responses[3], cache.usd) };
    checked = now(); return result();
  }
  return async () => { if (checked && now() - checked < 300000) return result(); if (pending) return pending; pending = update(); try { return await pending; } finally { pending = null; } };
}
