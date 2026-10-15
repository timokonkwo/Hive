import { NextResponse } from 'next/server';
import { hiveLaunch } from '@/lib/hive-launch';

export const dynamic = 'force-dynamic';

const address = hiveLaunch.tokenAddress;
const validAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
const text = (v: unknown) => typeof v === 'string' ? v : '';

async function json(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Market source returned ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function GET() {
  if (!validAddress(address)) return NextResponse.json({ error: 'Robinhood HIVE contract is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const [portal, ponsapi] = await Promise.allSettled([
      json(`https://api.ponsportal.fun/token/${address}/price`),
      json(`https://api.ponsapi.dev/v1/tokens/${address}/price`),
    ]);
    if (portal.status !== 'fulfilled' || portal.value.ok !== true) throw new Error('Robinhood market data is unavailable.');
    const api = ponsapi.status === 'fulfilled' ? ponsapi.value : {};
    const priceUsd = num(api.priceUsd);
    const mcapUsd = num(api.mcapUsd);
    const fdvUsd = num(api.fdvUsd);
    const updatedAt = text(api.updatedAt) || new Date().toISOString();
    return NextResponse.json({
      token: address,
      source: 'Pons Portal',
      chain: 'Robinhood Chain',
      chainId: 4663,
      phase: text(portal.value.phaseLabel) || 'Unknown',
      graduated: portal.value.graduated === true,
      pair: text(portal.value.pairTokenLabel) || 'ETH',
      poolId: text(portal.value.poolId),
      progressPercent: num(portal.value.progressPercent),
      priceEth: num(portal.value.priceEth),
      tokenPerEth: num(portal.value.tokenPerEth),
      priceUsd: priceUsd && priceUsd > 0 ? priceUsd : null,
      marketCapUsd: mcapUsd && mcapUsd > 0 ? mcapUsd : null,
      fdvUsd: fdvUsd && fdvUsd > 0 ? fdvUsd : null,
      updatedAt,
    }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Robinhood market data is unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
