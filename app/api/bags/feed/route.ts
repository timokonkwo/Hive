import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let feedCache: { data: any; fetchedAt: number } | null = null;

/**
 * GET /api/bags/feed
 * Returns token launches for the homepage. Sources:
 *   1. Bags public feed API (global trending)
 *   2. Fallback: tokens launched through Hive tasks (from our DB)
 *
 * Cached for 5 minutes to avoid rate limits.
 */
export async function GET(req: NextRequest) {
  try {
    // Return cached data if fresh
    if (feedCache && Date.now() - feedCache.fetchedAt < FEED_CACHE_TTL) {
      return NextResponse.json({ success: true, ...feedCache.data, cached: true });
    }

    const apiKey = process.env.BAGS_API_KEY;
    let launches: any[] = [];

    // Try the Bags API first
    if (apiKey) {
      try {
        const res = await fetch(`${BAGS_API_BASE}/token-launch/feed`, {
          headers: { 'x-api-key': apiKey },
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const json = await res.json();
          const items = json.response || json.data || [];
          if (Array.isArray(items)) {
            launches = items.slice(0, 8).map((launch: any) => ({
              name: launch.name || 'Unknown',
              symbol: launch.symbol || '???',
              description: (launch.description || '').slice(0, 120),
              image: launch.image || null,
              tokenMint: launch.tokenMint || '',
              status: launch.status || 'UNKNOWN',
              bagsUrl: launch.tokenMint ? `https://bags.fm/${launch.tokenMint}` : null,
            }));
          }
        } else {
          console.warn(`[BAGS] Feed API returned ${res.status}`);
        }
      } catch (bagErr: any) {
        console.warn('[BAGS] Feed API error:', bagErr.message);
      }
    }

    // Fallback: fetch tokens launched through Hive from our own DB
    if (launches.length === 0) {
      try {
        const db = await getDb();
        const hiveLaunches = await db.collection(COLLECTIONS.TASKS)
          .find({
            category: 'Token Launch',
            'tokenLaunch.tokenMint': { $exists: true, $ne: null },
          })
          .sort({ updatedAt: -1 })
          .limit(8)
          .toArray();

        launches = hiveLaunches
          .filter((t: any) => t.tokenLaunch?.tokenMint)
          .map((t: any) => ({
            name: t.tokenLaunch.tokenName || t.tokenConfig?.name || t.title,
            symbol: t.tokenLaunch.tokenSymbol || t.tokenConfig?.symbol || '???',
            description: (t.description || '').slice(0, 120),
            image: t.tokenLaunch.image || null,
            tokenMint: t.tokenLaunch.tokenMint,
            status: 'LAUNCHED',
            bagsUrl: t.tokenLaunch.tokenMint ? `https://bags.fm/${t.tokenLaunch.tokenMint}` : null,
          }));
      } catch (dbErr: any) {
        console.warn('[BAGS] DB fallback error:', dbErr.message);
      }
    }

    const data = { launches, total: launches.length };
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
