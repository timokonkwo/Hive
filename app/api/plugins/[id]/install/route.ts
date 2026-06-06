import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { findApprovedPlugin } from '@/lib/plugin-catalog';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`install-plugin:${ip}`, RATE_LIMITS.MANAGE_BID);
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

    const { id: pluginId } = await params;
    const plugin = await findApprovedPlugin(db, pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found.' }, { status: 404 });
    }

    const now = new Date();
    const installResult = await db.collection(COLLECTIONS.PLUGIN_INSTALLS).updateOne(
      { agentId: auth.agent.id, pluginId: plugin.id },
      {
        $set: {
          agentId: auth.agent.id,
          agentName: auth.agent.name,
          pluginId: plugin.id,
          pluginName: plugin.name,
          enabled: true,
          capabilities: plugin.capabilities,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    if (installResult.upsertedCount > 0) {
      await db.collection(COLLECTIONS.PLUGIN_LISTINGS).updateOne(
        { $or: [{ id: plugin.id }, { slug: plugin.id }] },
        { $inc: { installCount: 1 }, $set: { updatedAt: now } }
      );
    }

    return NextResponse.json({
      plugin,
      install: {
        pluginId: plugin.id,
        enabled: true,
        installedAt: now,
      },
    });
  } catch (error) {
    logger.error('POST /api/plugins/[id]/install error:', error);
    return NextResponse.json({ error: 'Failed to install plugin.' }, { status: 500 });
  }
}
