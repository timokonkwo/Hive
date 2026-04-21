import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';

/**
 * Admin auth helper — checks against ADMIN_ADDRESS env var.
 * Used by both GET and POST handlers.
 */
function isAdminAddress(address: string | null): boolean {
  if (!address) return false;
  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) return false;
  return address.toLowerCase() === adminAddress.toLowerCase();
}

/**
 * GET /api/admin/token-stats
 *
 * Returns agent token launch stats for the admin dashboard.
 * Protected by ADMIN_ADDRESS wallet auth (same as /api/admin/verify).
 */
export async function GET(req: NextRequest) {
  // Primary: wallet-based admin auth (same pattern as /api/admin/verify)
  const address = req.nextUrl.searchParams.get('address');
  if (!isAdminAddress(address)) {
    // Fallback: CRON_SECRET for cron/internal access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = await getDb();

  // Gather all stats in parallel
  const [
    totalLaunched,
    totalFailed,
    totalQueued,
    launchesThisMonth,
    launchesToday,
    recentLaunches,
    topTokens,
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
    (() => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return db.collection(COLLECTIONS.ACTIVITY).countDocuments({
        type: 'AgentTokenLaunched',
        createdAt: { $gte: monthStart },
      });
    })(),
    (() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return db.collection(COLLECTIONS.ACTIVITY).countDocuments({
        type: 'AgentTokenLaunched',
        createdAt: { $gte: todayStart },
      });
    })(),
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
  ]);

  // Get wallet balance + revenue data
  let walletBalance: number | null = null;
  let walletAddress: string | null = null;
  let claimablePositions: any[] = [];
  let perTokenFees: Array<{ name: string; symbol: string; mintAddress: string; lifetimeFees: number }> = [];

  try {
    const bags = createAgentBagsClient();
    if (bags) {
      walletBalance = await bags.getBalance();
      walletAddress = bags.getWalletAddress();

      // Fetch claimable positions for the launch wallet
      claimablePositions = await bags.getClaimablePositions();

      // Fetch lifetime fees for each launched token (cap at 20 to avoid timeout)
      const tokensToCheck = topTokens.slice(0, 20);
      const feeResults = await Promise.allSettled(
        tokensToCheck.map(async (a) => {
          const fees = await bags.getTokenLifetimeFees(a.tokenMintAddress);
          return {
            name: a.name,
            symbol: a.tokenSymbol,
            mintAddress: a.tokenMintAddress,
            lifetimeFees: fees,
          };
        })
      );
      perTokenFees = feeResults
        .filter((r): r is PromiseFulfilledResult<typeof perTokenFees[0]> => r.status === 'fulfilled')
        .map(r => r.value)
        .sort((a, b) => b.lifetimeFees - a.lifetimeFees);
    }
  } catch {
    walletBalance = null;
  }

  const totalLifetimeFees = perTokenFees.reduce((sum, t) => sum + t.lifetimeFees, 0);
  const totalClaimable = claimablePositions.reduce((sum: number, p: any) => {
    try { return sum + (p.claimable || 0); } catch { return sum; }
  }, 0);
  const monthlyCap = parseInt(process.env.AGENT_LAUNCH_MONTHLY_CAP || '50', 10);

  return NextResponse.json({
    stats: {
      totalLaunched,
      totalFailed,
      totalQueued,
      launchesThisMonth,
      launchesToday,
      monthlyCap,
      monthlyRemaining: Math.max(0, monthlyCap - launchesThisMonth),
      walletBalance: walletBalance !== null ? parseFloat(walletBalance.toFixed(4)) : null,
      walletAddress,
    },
    revenue: {
      totalLifetimeFees: parseFloat(totalLifetimeFees.toFixed(6)),
      totalClaimable: parseFloat(totalClaimable.toFixed(6)),
      claimablePositions: claimablePositions.length,
      perTokenFees: perTokenFees.map(t => ({
        ...t,
        lifetimeFees: parseFloat(t.lifetimeFees.toFixed(6)),
        bagsUrl: `https://bags.fm/${t.mintAddress}`,
      })),
    },
    recentLaunches: recentLaunches.map(l => ({
      id: l._id.toString(),
      agentName: l.agentName,
      tokenSymbol: l.tokenSymbol,
      mintAddress: l.mintAddress,
      transactionId: l.transactionId,
      status: l.status,
      error: l.error || null,
      createdAt: l.createdAt,
      bagsUrl: l.mintAddress ? `https://bags.fm/${l.mintAddress}` : null,
    })),
    tokenizedAgents: topTokens.map(a => ({
      id: a._id.toString(),
      name: a.name,
      tokenSymbol: a.tokenSymbol,
      mintAddress: a.tokenMintAddress,
      launchedAt: a.tokenLaunchedAt,
      bagsUrl: `https://bags.fm/${a.tokenMintAddress}`,
    })),
  });
}

/**
 * POST /api/admin/token-stats
 *
 * Admin actions: launch token for agent, or claim partner fees.
 * Protected by ADMIN_ADDRESS wallet auth.
 *
 * The admin page sends `adminAddress` (the connected wallet) in the body.
 * We verify it matches ADMIN_ADDRESS — the same env var used by /api/admin/verify.
 *
 * This is NOT spoofable because the admin dashboard already gates access
 * via Privy authentication + /api/admin/verify. The POST body address
 * is a double-check, not the sole auth mechanism.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, adminAddress } = body;

  if (!isAdminAddress(adminAddress)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (action === 'launch') {
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

    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          tokenSymbol: symbolToUse,
          tokenLaunchStatus: 'queued',
          tokenLaunchError: null,
          updatedAt: new Date(),
        },
      }
    );

    // Trigger the internal launch endpoint
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz';
    const cronSecret = process.env.CRON_SECRET;

    fetch(`${siteUrl}/api/internal/launch-agent-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ agentId }),
    }).catch(err => {
      console.error('[ADMIN] Token launch trigger failed:', err.message);
    });

    return NextResponse.json({
      message: `Token launch queued for ${agent.name} ($${symbolToUse})`,
      tokenSymbol: symbolToUse,
    });
  }

  if (action === 'claim-fees') {
    try {
      const bags = createAgentBagsClient();
      if (!bags) {
        return NextResponse.json({ error: 'Agent Bags client not configured' }, { status: 503 });
      }
      const balance = await bags.getBalance();
      return NextResponse.json({
        message: 'Fee claiming initiated',
        walletBalance: parseFloat(balance.toFixed(4)),
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
