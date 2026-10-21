import { ponsAdminStats, solanaSessionStats } from '@/lib/agent-tokenization/admin-stats';
import { claimableLamports } from '@/lib/agent-fees';
import { feeClaimStatus, runFeeClaim } from '@/lib/agent-fee-claims';
import { legacyAgentLaunchesEnabled, legacyLaunchMessage } from '@/lib/agent-tokenization/legacy';
import { verifyAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';
import { additionalFeeBalances, feeClient, type FeeSource } from '@/lib/agent-tokenization/fee-sources';
import { launchConnection } from '@/lib/agent-tokenization/solana-runtime';
import { HIVE_SOLANA_FEE_WALLET } from '@/lib/agent-tokenization/session';



export const maxDuration = 60;

/**
 * GET /api/admin/token-stats
 *
 * Returns agent token launch stats for the admin dashboard.
 * Protected by shared admin auth (ADMIN_API_KEY or ADMIN_PRIVY_DID).
 */
export async function GET(req: NextRequest) {
  // Admin auth
  const admin = await verifyAdmin(req);
  if (admin.error) {
    // Fallback: CRON_SECRET for cron/internal access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return admin.error;
    }
  }

  const db = await getDb();
  if (new URL(req.url).searchParams.get('claimStatus') === '1') {
    try {
      return NextResponse.json({ claim: await feeClaimStatus(db, { connection: launchConnection(), getWalletAddress: () => HIVE_SOLANA_FEE_WALLET }) }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch { return NextResponse.json({ error: 'Claim status is unavailable. Try again.' }, { status: 503 }); }
  }
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

  // Gather all stats in parallel
  const [
    totalLaunched,
    totalFailed,
    totalQueued,
    launchesThisMonth,
    launchesToday,
    recentLaunches,
    topTokens,
    pons,
    solanaSessions,
  ] = await Promise.all([
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      isTokenized: true,
      tokenLaunchStatus: 'launched',
    }),
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      tokenLaunchStatus: 'failed',
    }),
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      tokenLaunchStatus: { $in: ['queued', 'launching'] },
    }),
    db.collection(COLLECTIONS.ACTIVITY).countDocuments({
      type: 'AgentTokenLaunched',
      createdAt: { $gte: monthStart },
    }),
    db.collection(COLLECTIONS.ACTIVITY).countDocuments({
      type: 'AgentTokenLaunched',
      createdAt: { $gte: todayStart },
    }),
    db.collection(COLLECTIONS.TOKEN_LAUNCHES)
      .find({ launchType: 'agent-token' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
    db.collection(COLLECTIONS.AGENTS)
      .find({ isTokenized: true, tokenMintAddress: { $ne: null } })
      .project({ name: 1, tokenSymbol: 1, tokenMintAddress: 1, tokenLaunchedAt: 1 })
      .sort({ tokenLaunchedAt: -1 })
      .limit(50)
      .toArray(),
    ponsAdminStats(db, monthStart, todayStart),
    solanaSessionStats(db, monthStart, todayStart),
  ]);

  const feeTokens = [...topTokens];
  for (const token of solanaSessions.recentLaunches.filter(t => t.platform === 'Bags')) {
    if (!feeTokens.some(t => t.tokenMintAddress === token.mintAddress)) feeTokens.push({ _id: new (await import('mongodb')).ObjectId(token.agentId), name: token.agentName, tokenSymbol: token.tokenSymbol, tokenMintAddress: token.mintAddress, tokenLaunchedAt: token.createdAt });
  }

  // Get wallet balance + revenue data
  let walletBalance: number | null = null;
  let walletAddress: string | null = null;
  let claimablePositions: any[] = [];
  let perTokenFees: Array<{ name: string; symbol: string; mintAddress: string; lifetimeFees: number | null }> = [];

  let revenueError: string | null = null;
  let totalClaimable: number | null = null;
  let lifetimeComplete = false;
  const additionalFees = additionalFeeBalances(db);
  try {
    const bags = createAgentBagsClient();
    if (bags) {
      walletBalance = await bags.getBalance();
      walletAddress = bags.getWalletAddress();

      // Fetch claimable positions for the launch wallet
      claimablePositions = await bags.getClaimablePositions();
      totalClaimable = Number(claimablePositions.reduce((sum, p) => sum + claimableLamports(p), 0n)) / 1e9;

      // Fetch lifetime fees for each launched token (cap at 20 to avoid timeout)
      const tokensToCheck = feeTokens.slice(0, 20);
      const feeResults = await Promise.allSettled(
        tokensToCheck.map(async (a) => {
          const feesLamports = await bags.getTokenLifetimeFees(a.tokenMintAddress);
          return {
            name: a.name,
            symbol: a.tokenSymbol,
            mintAddress: a.tokenMintAddress,
            lifetimeFees: feesLamports / 1e9, // lamports -> SOL
          };
        })
      );
      lifetimeComplete = feeTokens.length <= 20 && feeResults.every(r => r.status === 'fulfilled');
      perTokenFees = feeResults.map((r, index) => r.status === 'fulfilled' ? r.value : {
        name: tokensToCheck[index].name, symbol: tokensToCheck[index].tokenSymbol,
        mintAddress: tokensToCheck[index].tokenMintAddress, lifetimeFees: null,
      }).sort((a, b) => (b.lifetimeFees ?? -1) - (a.lifetimeFees ?? -1));
    }
    else { revenueError = 'Solana fee wallet is not configured.'; }
  } catch {
    revenueError = 'Solana fee data is unavailable. Try again.';
  }

  const totalLifetimeFees = perTokenFees.reduce((sum, t) => sum + (t.lifetimeFees ?? 0), 0);
  const monthlyCap = parseInt(process.env.AGENT_LAUNCH_MONTHLY_CAP || '50', 10);

  return NextResponse.json({
    feeSources: [{ source: 'bags-creator', totalClaimable, error: revenueError }, ...await additionalFees],
    stats: {
      totalLaunched: totalLaunched + pons.totalLaunched + solanaSessions.totalLaunched,
      totalFailed: totalFailed + pons.totalFailed + solanaSessions.totalFailed,
      totalQueued: totalQueued + pons.totalQueued + solanaSessions.totalQueued,
      launchesThisMonth: launchesThisMonth + pons.launchesThisMonth + solanaSessions.launchesThisMonth,
      launchesToday: launchesToday + pons.launchesToday + solanaSessions.launchesToday,
      byChain: { solana: totalLaunched + solanaSessions.totalLaunched, robinhood: pons.totalLaunched },
      byPlatform: { pons: pons.totalLaunched, bags: totalLaunched + solanaSessions.bags, pump: solanaSessions.pump },
      monthlyCap,
      monthlyRemaining: Math.max(0, monthlyCap - launchesThisMonth),
      walletBalance: walletBalance !== null ? parseFloat(walletBalance.toFixed(4)) : null,
      walletAddress,
    },
    revenue: {
      error: revenueError,
      feesTruncated: feeTokens.length > 20,
      totalLifetimeFees: lifetimeComplete ? parseFloat(totalLifetimeFees.toFixed(6)) : null,
      totalClaimable: totalClaimable === null ? null : parseFloat(totalClaimable.toFixed(9)),
      claimablePositions: totalClaimable === null ? null : claimablePositions.length,
      perTokenFees: perTokenFees.map(t => ({
        ...t,
        bagsUrl: `https://bags.fm/${t.mintAddress}`,
      })),
    },
    recentLaunches: [...pons.recentLaunches, ...solanaSessions.recentLaunches, ...recentLaunches.map(l => ({
      chain: 'Solana',
      tradeUrl: l.mintAddress ? `https://bags.fm/${l.mintAddress}` : null,
      id: l._id.toString(),
      agentName: l.agentName,
      tokenSymbol: l.tokenSymbol,
      mintAddress: l.mintAddress,
      transactionId: l.transactionId,
      status: l.status,
      error: l.error || null,
      createdAt: l.createdAt,
      bagsUrl: l.mintAddress ? `https://bags.fm/${l.mintAddress}` : null,
    }))].sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)).slice(0, 20),
    tokenizedAgents: [...solanaSessions.recentLaunches.map(l => ({ id: l.agentId, name: l.agentName, tokenSymbol: l.tokenSymbol, mintAddress: l.mintAddress, launchedAt: l.createdAt, chain: l.chain, platform: l.platform, tradeUrl: l.tradeUrl })), ...pons.recentLaunches.map(l => ({ id: l.agentId, name: l.agentName, tokenSymbol: l.tokenSymbol, mintAddress: l.mintAddress, launchedAt: l.createdAt, chain: l.chain, tradeUrl: l.tradeUrl })), ...topTokens.map(a => ({
      chain: 'Solana',
      tradeUrl: `https://bags.fm/${a.tokenMintAddress}`,
      id: a._id.toString(),
      name: a.name,
      tokenSymbol: a.tokenSymbol,
      mintAddress: a.tokenMintAddress,
      launchedAt: a.tokenLaunchedAt,
      bagsUrl: `https://bags.fm/${a.tokenMintAddress}`,
    }))],
  });
}

/**
 * POST /api/admin/token-stats
 *
 * Admin actions: launch token for agent, or claim partner fees.
 * Protected by shared admin auth (ADMIN_API_KEY or ADMIN_PRIVY_DID).
 */
export async function POST(req: NextRequest) {
  // Admin auth
  const admin = await verifyAdmin(req);
  if (admin.error) return admin.error;
  const origin = req.headers.get('origin');
  if (origin && origin !== (process.env.PONS_APP_ORIGIN || 'https://uphive.xyz')) return NextResponse.json({ error: 'Open Hive to continue.' }, { status: 403 });
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return NextResponse.json({ error: 'Send a JSON request.' }, { status: 415 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { action } = body;

  if (action === 'launch') {
    if (!legacyAgentLaunchesEnabled()) return NextResponse.json({ error:legacyLaunchMessage }, { status:410 });
    const { agentId } = body;
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    
    if (!ObjectId.isValid(agentId)) {
      return NextResponse.json({ error: 'Invalid agentId format' }, { status: 400 });
    }

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      _id: new ObjectId(agentId),
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.isTokenized && agent.tokenLaunchStatus === 'launched') {
      return NextResponse.json({ error: 'Agent already has a launched token' }, { status: 409 });
    }

    const symbolToUse = agent.tokenSymbol || agent.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'AGENT';

    // Set to launching atomically
    const lockResult = await db.collection(COLLECTIONS.AGENTS).findOneAndUpdate(
      { _id: new ObjectId(agentId), tokenLaunchStatus: { $nin: ['launched', 'launching'] } },
      {
        $set: {
          tokenSymbol: symbolToUse,
          tokenLaunchStatus: 'launching',
          tokenLaunchError: null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!lockResult) {
      return NextResponse.json({ error: 'Agent is already launching or launched' }, { status: 409 });
    }

    // Execute launch inline (fire-and-forget dies on serverless)
    const bags = createAgentBagsClient();
    if (!bags) {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agentId) },
        { $set: { tokenLaunchStatus: 'failed', tokenLaunchError: 'Bags client not configured', updatedAt: new Date() } }
      );
      return NextResponse.json({ error: 'Agent Bags client not configured' }, { status: 503 });
    }

    const launchResult = await bags.launchAgentToken({
      agentName: agent.name,
      tokenSymbol: symbolToUse,
      bio: agent.bio || `${agent.name} - AI agent on Hive Protocol`,
      website: agent.website || undefined,
      tokenImageUrl: agent.tokenImageUrl || undefined,
    });

    if (launchResult.success && launchResult.mintAddress) {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agentId) },
        {
          $set: {
            isTokenized: true,
            tokenMintAddress: launchResult.mintAddress,
            tokenLaunchStatus: 'launched',
            tokenLaunchedAt: new Date(),
            tokenLaunchError: null,
            updatedAt: new Date(),
          },
        }
      );

      // Record launch
      await db.collection(COLLECTIONS.TOKEN_LAUNCHES).insertOne({
        taskId: null,
        agentId,
        agentName: agent.name,
        tokenName: agent.name,
        tokenSymbol: symbolToUse,
        mintAddress: launchResult.mintAddress,
        transactionId: launchResult.transactionId,
        feeSharing: [{ walletAddress: 'agent-launch-wallet', bps: 10000, label: 'Hive Agent Pool' }],
        partnerKey: 'agent-partner',
        refCode: 'hive-agent',
        launchType: 'agent-token',
        launchKeypair: 'agent',
        bagsConfigType: '48e26d2f-0a9d-4625-a3cc-c3987d874b9e',
        status: 'launched',
        createdAt: new Date(),
      });

      // Log activity
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'AgentTokenLaunched',
        agentId,
        actorName: agent.name,
        metadata: { tokenSymbol: symbolToUse, mintAddress: launchResult.mintAddress, transactionId: launchResult.transactionId },
        createdAt: new Date(),
      });

      return NextResponse.json({
        message: `Token launched for ${agent.name} ($${symbolToUse})`,
        tokenSymbol: symbolToUse,
        mintAddress: launchResult.mintAddress,
        transactionId: launchResult.transactionId,
        bagsUrl: `https://bags.fm/${launchResult.mintAddress}`,
      });
    } else {
      await db.collection(COLLECTIONS.AGENTS).updateOne(
        { _id: new ObjectId(agentId) },
        { $set: { tokenLaunchStatus: 'failed', tokenLaunchError: launchResult.error || 'Unknown error', updatedAt: new Date() } }
      );
      return NextResponse.json({ error: launchResult.error || 'Token launch failed' }, { status: 500 });
    }
  }

  if (action === 'claim-fees') {
    const source = body.source ?? 'bags-creator';
    if (!['bags-creator', 'bags-deployer', 'pump'].includes(source)) return NextResponse.json({ error: 'Unknown fee source.' }, { status: 400 });
    try {
      if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return NextResponse.json({ error: 'Invalid fee claim request.' }, { status: 400 });
      const db = await getDb();
      const result = await runFeeClaim(db, feeClient(db, source as FeeSource), body.requestId);
      return NextResponse.json({ claim: result }, { status: result?.pending ? 202 : 200, headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
      return NextResponse.json({ error: 'Solana fee claims are unavailable. Refresh balances and try again.' }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
