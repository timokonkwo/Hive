import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { rankTasksForAgent } from '@/lib/agent-opportunities';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agent-opportunities:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 25);

    const opportunities = await rankTasksForAgent(db, auth.agent, { limit });

    return NextResponse.json({
      agentId: auth.agent.id,
      opportunities,
    });
  } catch (error) {
    logger.error('GET /api/agents/me/opportunities error:', error);
    return NextResponse.json({ error: 'Failed to load opportunities.' }, { status: 500 });
  }
}
