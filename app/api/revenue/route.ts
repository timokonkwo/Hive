import { NextRequest, NextResponse } from 'next/server';

const HIVE_TOKEN_CA = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';

/**
 * GET /api/revenue
 * Public endpoint for the HIVE token revenue dashboard.
 * Fetches data from DexScreener (public, no auth needed) and Bags API analytics.
 */
export async function GET(req: NextRequest) {
  try {
    // Fetch from DexScreener (public, reliable, no API key needed)
    const dexRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${HIVE_TOKEN_CA}`,
      { next: { revalidate: 60 } } // Cache for 60s
    );

    let dexData: any = null;
    if (dexRes.ok) {
      dexData = await dexRes.json();
    }

    // Extract the most liquid pair
    const pairs = dexData?.pairs || [];
    const mainPair = pairs.length > 0
      ? pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
      : null;

    // Try Bags API for fee-specific analytics (requires BAGS_API_KEY)
    let bagsAnalytics: any = null;
    const bagsApiKey = process.env.BAGS_API_KEY;
    if (bagsApiKey) {
      try {
        const bagsRes = await fetch(
          `https://public-api-v2.bags.fm/api/v1/token/${HIVE_TOKEN_CA}/analytics`,
          { headers: { 'x-api-key': bagsApiKey, 'Content-Type': 'application/json' } }
        );
        if (bagsRes.ok) {
          const bagsJson = await bagsRes.json();
          bagsAnalytics = bagsJson.response || bagsJson;
        }
      } catch (bagsErr) {
        console.warn('[REVENUE] Bags API error (non-fatal):', bagsErr);
      }
    }

    // Calculate metrics
    const priceUsd = mainPair?.priceUsd ? parseFloat(mainPair.priceUsd) : 0;
    const marketCap = mainPair?.marketCap || mainPair?.fdv || 0;
    const volume24h = mainPair?.volume?.h24 || 0;
    const volume6h = mainPair?.volume?.h6 || 0;
    const volume1h = mainPair?.volume?.h1 || 0;
    const liquidity = mainPair?.liquidity?.usd || 0;
    const priceChange24h = mainPair?.priceChange?.h24 || 0;
    const priceChange6h = mainPair?.priceChange?.h6 || 0;
    const priceChange1h = mainPair?.priceChange?.h1 || 0;
    const txns24h = mainPair?.txns?.h24 || { buys: 0, sells: 0 };

    // Bags token fee = 1% of trading volume
    const FEE_RATE = 0.01;
    const totalFees = bagsAnalytics?.totalFees || null;
    const estimatedFees24h = volume24h * FEE_RATE;

    return NextResponse.json({
      success: true,
      token: {
        name: mainPair?.baseToken?.name || 'HIVE',
        symbol: mainPair?.baseToken?.symbol || 'HIVE',
        address: HIVE_TOKEN_CA,
        dexScreenerUrl: mainPair?.url || `https://dexscreener.com/solana/${HIVE_TOKEN_CA}`,
        bagsUrl: `https://bags.fm/token/${HIVE_TOKEN_CA}`,
      },
      price: {
        usd: priceUsd,
        change1h: priceChange1h,
        change6h: priceChange6h,
        change24h: priceChange24h,
      },
      market: {
        marketCap,
        liquidity,
        volume1h,
        volume6h,
        volume24h,
      },
      txns24h,
      fees: {
        feeRate: `${FEE_RATE * 100}%`,
        totalLifetime: totalFees,
        estimated24h: estimatedFees24h,
        estimated6h: volume6h * FEE_RATE,
        estimated1h: volume1h * FEE_RATE,
      },
      feeDistribution: {
        treasury: '40%',
        agentPool: '30%',
        creatorPool: '20%',
        referrals: '10%',
      },
      source: {
        dexScreener: !!mainPair,
        bags: !!bagsAnalytics,
      },
      pairsCount: pairs.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[REVENUE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
