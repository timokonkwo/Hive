import { NextRequest, NextResponse } from 'next/server';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let feedCache: { data: any; fetchedAt: number } | null = null;

/**
 * GET /api/bags/feed
 * Proxy for Bags token launch feed. Returns recent token launches.
 * Cached for 5 minutes to avoid rate limits.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.BAGS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Bags API not configured.' },
        { status: 503 }
      );
    }

    // Return cached data if fresh
    if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL) {
      return NextResponse.json({ success: true, ...feedCache.data, cached: true });
    }

    const res = await fetch(`${BAGS_API_BASE}/token-launch/feed`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Bags API returned ${res.status}`);
    }

    const json = await res.json();
    const launches = (json.response || []).slice(0, 8).map((launch: any) => ({
      name: launch.name,
      symbol: launch.symbol,
      description: launch.description?.slice(0, 120) || '',
      image: launch.image,
      tokenMint: launch.tokenMint,
      status: launch.status,
      bagsUrl: launch.tokenMint ? `https://bags.fm/${launch.tokenMint}` : null,
    }));

    const data = { launches, total: (json.response || []).length };
    feedCache = { data, fetchedAt: Date.now() };

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('[BAGS] Feed error:', error.message);

    // Return stale cache on error
    if (feedCache) {
      return NextResponse.json({ success: true, ...feedCache.data, cached: true, stale: true });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch Bags feed' },
      { status: 500 }
    );
  }
}
