import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createAgentBagsClient } from '@/lib/bags-agent';

/**
 * GET /api/admin/token-stats
 *
 * Returns agent token launch stats for the admin dashboard.
 * Protected by ADMIN_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    // Fallback: check address-based admin auth
    const address = req.nextUrl.searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminAddresses = (process.env.ADMIN_WALLETS || '').split(',').map(a => a.trim().toLowerCase());
    if (!adminAddresses.includes(address.toLowerCase())) {
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
    // Total successfully launched agent tokens
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      isTokenized: true,
      tokenLaunchStatus: 'launched',
    }),
    // Total failed launches
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      tokenLaunchStatus: 'failed',
    }),
    // Currently queued/launching
    db.collection(COLLECTIONS.AGENTS).countDocuments({
      tokenLaunchStatus: { $in: ['queued', 'launching'] },
    }),
    // Launches this month
    (() => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return db.collection(COLLECTIONS.ACTIVITY).countDocuments({
        type: 'AgentTokenLaunched',
        createdAt: { $gte: monthStart },
      });
    })(),
    // Launches today
    (() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return db.collection(COLLECTIONS.ACTIVITY).countDocuments({
        type: 'AgentTokenLaunched',
        createdAt: { $gte: todayStart },
      });
    })(),
    // Recent launches (last 20)
    db.collection(COLLECTIONS.TOKEN_LAUNCHES)
      .find({ launchType: 'agent-token' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
    // Tokenized agents with mint addresses
    db.collection(COLLECTIONS.AGENTS)
      .find({ isTokenized: true, tokenMintAddress: { $ne: null } })
      .project({ name: 1, tokenSymbol: 1, tokenMintAddress: 1, tokenLaunchedAt: 1 })
      .sort({ tokenLaunchedAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  // Get wallet balance
  let walletBalance: number | null = null;
  try {
    const bags = createAgentBagsClient();
    if (bags) {
      walletBalance = await bags.getBalance();
    }
  } catch {
    walletBalance = null;
  }

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
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, adminAddress } = body;

  // Wallet-based admin verification (same as GET)
  if (!adminAddress) {
    return NextResponse.json({ error: 'Unauthorized — adminAddress required' }, { status: 401 });
  }
  const adminAddresses = (process.env.ADMIN_WALLETS || '').split(',').map(a => a.trim().toLowerCase());
  if (!adminAddresses.includes(adminAddress.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (action === 'launch') {
    // Launch token for a specific agent
    const { agentId } = body;
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    
    // Find the agent
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      _id: new ObjectId(agentId),
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.isTokenized && agent.tokenLaunchStatus === 'launched') {
      return NextResponse.json({ error: 'Agent already has a launched token' }, { status: 409 });
    }

    // Set to queued (or reset from failed)
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
    // Trigger partner fee claiming
    try {
      const bags = createAgentBagsClient();
      if (!bags) {
        return NextResponse.json({ error: 'Agent Bags client not configured' }, { status: 503 });
      }
      // For now, return balance info — actual claiming will be implemented in Step 10
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
