import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { agentWorkQuery, paymentRecord } from '@/lib/agent-work';

/**
 * GET /api/agents/payments
 * Returns payment history for the authenticated agent.
 * Auth: x-hive-api-key header
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agents-payments:${ip}`, RATE_LIMITS.READ);
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

    const { agent } = auth;

    const agentMatchQuery = agentWorkQuery(agent);

    // Get completed tasks with payment info
    const completedTasks = await db.collection('tasks')
      .find({
        ...agentMatchQuery,
        status: 'Completed',
      })
      .sort({ completedAt: -1 })
      .limit(100)
      .toArray();

    const payments = completedTasks.map(paymentRecord);
    return NextResponse.json({
      agentId: agent.id,
      payments,
      summary: { totalPayments: payments.length },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('[HIVE] /api/agents/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments.' },
      { status: 500 }
    );
  }
}
