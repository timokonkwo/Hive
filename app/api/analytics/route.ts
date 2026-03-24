import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const HIVE_TOKEN_CA = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const LAMPORTS_PER_SOL = 1_000_000_000;
const FEES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for lifetime fees (persists across warm function invocations)
let feesCache: { sol: number; usd: number | null; fetchedAt: number } | null = null;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * GET /api/analytics
 * Public analytics dashboard — platform metrics + fee revenue via Bags SDK.
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const tasksCol = db.collection('tasks');
    const agentsCol = db.collection('agents');
    const bidsCol = db.collection('bids');

    // Platform metrics from DB
    const [
      totalTasks,
      openTasks,
      completedTasks,
      inProgressTasks,
      totalAgents,
      totalBids,
    ] = await Promise.all([
      tasksCol.countDocuments(),
      tasksCol.countDocuments({ status: 'Open' }),
      tasksCol.countDocuments({ status: { $in: ['Completed', 'completed'] } }),
      tasksCol.countDocuments({ status: { $in: ['In Progress', 'in_progress'] } }),
      agentsCol.countDocuments(),
      bidsCol.countDocuments(),
    ]);

    // Total platform earnings from completed tasks
    const completedTaskDocs = await tasksCol
      .find({ status: { $in: ['Completed', 'completed'] } }, { projection: { budget: 1 } })
      .toArray();

    let totalEarnings = 0;
    for (const task of completedTaskDocs) {
      if (task.budget) {
        const parsed = parseFloat(String(task.budget).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed)) totalEarnings += parsed;
      }
    }



    // Bags SDK: on-chain lifetime fees (with cache + timeout)
    let lifetimeFees: { sol: number; usd: number | null } | null = null;
    const bagsApiKey = (process.env.BAGS_API_KEY || '').trim();
    const rpcUrl = (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com').trim();

    // Return cached value if still fresh
    if (feesCache && Date.now() - feesCache.fetchedAt < FEES_CACHE_TTL) {
      lifetimeFees = { sol: feesCache.sol, usd: feesCache.usd };
    } else if (bagsApiKey) {
      try {
        const bagsMod = await import('@bagsfm/bags-sdk');
        const solanaMod = await import('@solana/web3.js');
        const BagsSDK = bagsMod.BagsSDK || bagsMod.default?.BagsSDK || bagsMod.default;
        const Connection = solanaMod.Connection;
        const PublicKey = solanaMod.PublicKey;

        const connection = new Connection(rpcUrl);
        const sdk = new BagsSDK(bagsApiKey, connection, 'processed');

        // 8s timeout — Netlify functions have 10s default
        const feesLamports = await withTimeout(
          sdk.state.getTokenLifetimeFees(new PublicKey(HIVE_TOKEN_CA)),
          8000
        );
        const feesSol = feesLamports / LAMPORTS_PER_SOL;

        // SOL → USD (with own 3s timeout)
        let solPrice: number | null = null;
        try {
          const priceRes = await withTimeout(
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'),
            3000
          );
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            solPrice = priceData?.solana?.usd || null;
          }
        } catch {
          // Non-fatal — USD will be null
        }

        lifetimeFees = { sol: feesSol, usd: solPrice ? feesSol * solPrice : null };
        feesCache = { sol: feesSol, usd: lifetimeFees.usd, fetchedAt: Date.now() };
      } catch (e: any) {
        console.error('[REVENUE] Bags SDK error:', e.message);
        // Return stale cache if available
        if (feesCache) {
          lifetimeFees = { sol: feesCache.sol, usd: feesCache.usd };
        }
      }
    }

    // Bags SDK: also fetch claim stats + creators
    let claimStats: any[] = [];
    let tokenCreators: any[] = [];

    if (bagsApiKey && lifetimeFees) {
      try {
        const [claimRes, creatorsRes] = await Promise.allSettled([
          withTimeout(
            fetch(`${BAGS_API_BASE}/token-launch/claim-stats?tokenMint=${HIVE_TOKEN_CA}`, {
              headers: { 'x-api-key': bagsApiKey },
            }),
            5000
          ),
          withTimeout(
            fetch(`${BAGS_API_BASE}/token-launch/creator/v3?tokenMint=${HIVE_TOKEN_CA}`, {
              headers: { 'x-api-key': bagsApiKey },
            }),
            5000
          ),
        ]);

        if (claimRes.status === 'fulfilled' && claimRes.value.ok) {
          const data = await claimRes.value.json();
          claimStats = (data.response || []).map((c: any) => ({
            wallet: c.wallet,
            totalClaimed: c.totalClaimed,
            username: c.providerUsername || c.bagsUsername || c.username,
            pfp: c.pfp,
            isCreator: c.isCreator,
          }));
        }

        if (creatorsRes.status === 'fulfilled' && creatorsRes.value.ok) {
          const data = await creatorsRes.value.json();
          tokenCreators = (data.response || []).map((c: any) => ({
            wallet: c.wallet,
            username: c.providerUsername || c.bagsUsername || c.username,
            pfp: c.pfp,
            royaltyBps: c.royaltyBps,
            twitter: c.twitterUsername,
            isCreator: c.isCreator,
          }));
        }
      } catch (e: any) {
        console.error('[REVENUE] Bags additional data error:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      platform: {
        totalTasks,
        openTasks,
        completedTasks,
        inProgressTasks,
        totalAgents,
        totalBids,
        totalEarnings,
      },
      lifetimeFees,
      claimStats,
      tokenCreators,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[REVENUE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
