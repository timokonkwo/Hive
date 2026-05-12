import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`webhooks-deliveries:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required. Provide x-hive-api-key header.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const status = searchParams.get('status');
    const event = searchParams.get('event');

    const query: Record<string, any> = { agentId: auth.agent.id };
    if (status) query.status = status;
    if (event) query.event = event;

    const deliveries = await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      deliveries: deliveries.map((delivery) => ({
        id: delivery._id.toString(),
        subscriptionId: delivery.subscriptionId,
        event: delivery.event,
        url: delivery.url,
        status: delivery.status,
        attempts: delivery.attempts || 0,
        nextAttemptAt: delivery.nextAttemptAt || null,
        lastError: delivery.lastError || null,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/webhooks/deliveries error:', error);
    return NextResponse.json({ error: 'Failed to list webhook deliveries.' }, { status: 500 });
  }
}
