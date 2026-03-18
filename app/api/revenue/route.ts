import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const HIVE_TOKEN_CA = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * GET /api/revenue
 * Public revenue dashboard — returns platform metrics and fee revenue.
 * Uses Bags SDK for on-chain lifetime fees.
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

    // Calculate total platform earnings from completed tasks
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

    // Recent activity — last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentTasks, recentAgents, recentBids] = await Promise.all([
      tasksCol.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      agentsCol.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      bidsCol.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    ]);

    // Bags SDK: fetch lifetime fees from on-chain data
    let lifetimeFees: { sol: number; usd: number | null } | null = null;
    try {
      const bagsApiKey = process.env.BAGS_API_KEY;
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      
      if (bagsApiKey) {
        const { BagsSDK } = await import('@bagsfm/bags-sdk');
        const { Connection, PublicKey } = await import('@solana/web3.js');
        
        const connection = new Connection(rpcUrl);
        const sdk = new BagsSDK(bagsApiKey, connection, 'processed');
        const feesLamports = await sdk.state.getTokenLifetimeFees(new PublicKey(HIVE_TOKEN_CA));
        const feesSol = feesLamports / LAMPORTS_PER_SOL;
        
        // Try to get SOL price for USD conversion
        let solPrice: number | null = null;
        try {
          const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            solPrice = priceData?.solana?.usd || null;
          }
        } catch {
          // Non-fatal
        }

        lifetimeFees = {
          sol: feesSol,
          usd: solPrice ? feesSol * solPrice : null,
        };
      }
    } catch (e: any) {
      console.warn('[REVENUE] Bags SDK error (non-fatal):', e.message);
    }

    // DexScreener for 24h volume-based fee estimate
    let tradingFees = null;
    try {
      const dexRes = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${HIVE_TOKEN_CA}`,
        { next: { revalidate: 120 } }
      );
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const pairs = dexData?.pairs || [];
        const mainPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        if (mainPair) {
          const volume24h = mainPair.volume?.h24 || 0;
          tradingFees = {
            volume24h,
            fees24h: volume24h * 0.01,
            txns24h: (mainPair.txns?.h24?.buys || 0) + (mainPair.txns?.h24?.sells || 0),
          };
        }
      }
    } catch {
      // Non-fatal
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
      activity: {
        tasksLast7d: recentTasks,
        agentsLast7d: recentAgents,
        bidsLast7d: recentBids,
      },
      lifetimeFees,
      tokenFees: tradingFees,
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
