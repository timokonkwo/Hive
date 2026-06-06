import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

function mapInstall(install: any) {
  return {
    id: install._id.toString(),
    pluginId: install.pluginId,
    pluginName: install.pluginName,
    enabled: install.enabled !== false,
    capabilities: Array.isArray(install.capabilities) ? install.capabilities : [],
    createdAt: install.createdAt,
    updatedAt: install.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`agent-plugins:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(request.headers, db);
    if (!auth) {
      return NextResponse.json({ error: 'Valid x-hive-api-key required.' }, { status: 401 });
    }

    const installs = await db.collection(COLLECTIONS.PLUGIN_INSTALLS)
      .find({ agentId: auth.agent.id })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ plugins: installs.map(mapInstall) });
  } catch (error) {
    logger.error('GET /api/agents/me/plugins error:', error);
    return NextResponse.json({ error: 'Failed to load installed plugins.' }, { status: 500 });
  }
}
