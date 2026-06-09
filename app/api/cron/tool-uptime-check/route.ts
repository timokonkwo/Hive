import { NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { awardPoints } from '@/lib/points';
import { validateOutboundUrl } from '@/lib/ssrf';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/tool-uptime-check
 * 
 * Daily cron job that pings all registered agent tool endpoints,
 * logs the results, and awards +20 Hive Points to providers
 * maintaining 99.9%+ uptime over the last 24 hours.
 * 
 * Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = process.env.STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (stealthSecret && authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    startedAt: string;
    agentsChecked: number;
    agentsPassed: number;
    pointsAwarded: number;
    errors: string[];
  } = {
    startedAt: new Date().toISOString(),
    agentsChecked: 0,
    agentsPassed: 0,
    pointsAwarded: 0,
    errors: [],
  };

  try {
    const db = await getDb();

    // Fetch all registered agents with tool endpoints
    const agents = await db.collection(COLLECTIONS.AGENTS)
      .find({
        status: { $ne: 'suspended' },
        $or: [
          { 'registeredTools.endpoint': { $exists: true } },
          { mcpEndpoint: { $exists: true } },
        ],
      })
      .toArray();

    results.agentsChecked = agents.length;

    if (agents.length === 0) {
      return NextResponse.json({
        cron: 'tool-uptime-check',
        message: 'No registered tool endpoints found.',
        ...results,
      });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const agent of agents) {
      const agentId = agent._id.toString();
      const ownerAddress = agent.ownerAddress || agentId;
      const endpointUrl = agent.mcpEndpoint ||
        agent.registeredTools?.[0]?.endpoint;

      if (!endpointUrl) continue;

      // ─── Ping the endpoint ───
      let pingSuccess = false;
      let latencyMs = 0;
      let pingError = '';

      try {
        const safeEndpointUrl = await validateOutboundUrl(endpointUrl, { purpose: 'Tool endpoint' });
        const pingStart = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(safeEndpointUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        clearTimeout(timeoutId);
        latencyMs = Date.now() - pingStart;

        // 2xx or 405 (Method Not Allowed, but server is responding) = success
        pingSuccess = response.ok || response.status === 405;
      } catch (err: any) {
        pingError = err.name === 'AbortError' ? 'Timeout (10s)' : (err.message || 'Unknown error');
      }

      // ─── Log the ping result ───
      await db.collection('tool_uptime_logs').insertOne({
        agentId,
        agentName: agent.name,
        endpoint: endpointUrl,
        success: pingSuccess,
        latencyMs,
        error: pingError || undefined,
        checkedAt: now,
      });

      // ─── Calculate 24h uptime ───
      const recentPings = await db.collection('tool_uptime_logs')
        .find({ agentId, checkedAt: { $gte: twentyFourHoursAgo } })
        .toArray();

      if (recentPings.length === 0) continue;

      const successCount = recentPings.filter((p: any) => p.success).length;
      const uptimePercentage = (successCount / recentPings.length) * 100;

      // ─── Award points for 99.9%+ uptime ───
      if (uptimePercentage >= 99.9) {
        // Check if we already awarded uptime points today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const alreadyAwarded = await db.collection(COLLECTIONS.USER_POINTS).findOne({
          userId: ownerAddress,
          'history.action': 'tool_uptime',
          'history.timestamp': { $gte: todayStart },
        });

        if (!alreadyAwarded) {
          await awardPoints(ownerAddress, 'tool_uptime', 20, {
            agentId,
            agentName: agent.name,
            uptimePercentage: uptimePercentage.toFixed(2),
            pingsInWindow: recentPings.length,
          });
          results.pointsAwarded += 20;
        }

        results.agentsPassed++;
      }
    }

    // ─── Log cron activity ───
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'ToolUptimeCheck',
      metadata: {
        agentsChecked: results.agentsChecked,
        agentsPassed: results.agentsPassed,
        pointsAwarded: results.pointsAwarded,
      },
      createdAt: now,
    });

  } catch (error: any) {
    logger.error('[CRON-UPTIME] Error:', error);
    results.errors.push(error.message || 'Uptime check failed');
  }

  return NextResponse.json({
    cron: 'tool-uptime-check',
    timestamp: new Date().toISOString(),
    ...results,
  });
}
