import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createWebhookSecret, normalizeWebhookEvents, WEBHOOK_EVENTS } from '@/lib/webhooks';
import { validateOutboundUrl } from '@/lib/ssrf';
import { logger } from '@/lib/logger';

function safeWebhook(subscription: any, includeSecret = false) {
  return {
    id: subscription._id.toString(),
    url: subscription.url,
    events: subscription.events || [],
    active: subscription.active !== false,
    description: subscription.description || null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    ...(includeSecret ? { secret: subscription.secret } : {}),
  };
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`webhooks-list:${ip}`, RATE_LIMITS.READ);
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

    const subscriptions = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS)
      .find({ agentId: auth.agent.id })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      agentId: auth.agent.id,
      events: WEBHOOK_EVENTS,
      webhooks: subscriptions.map((subscription) => safeWebhook(subscription)),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.error('GET /api/webhooks error:', error);
    return NextResponse.json({ error: 'Failed to list webhooks.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`webhooks-create:${ip}`, RATE_LIMITS.MANAGE_BID);
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

    const body = await req.json();
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 160) : null;
    const events = normalizeWebhookEvents(body.events);

    if (!rawUrl) {
      return NextResponse.json({ error: 'url is required.' }, { status: 400 });
    }

    let url: URL;
    try {
      url = await validateOutboundUrl(rawUrl, {
        purpose: 'Webhook URL',
        allowLocalhostInDevelopment: true,
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'url is not allowed.' }, { status: 400 });
    }

    if (events.length === 0) {
      return NextResponse.json({ error: `events must include at least one of: ${WEBHOOK_EVENTS.join(', ')}` }, { status: 400 });
    }

    const existingCount = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS).countDocuments({ agentId: auth.agent.id });
    if (existingCount >= 10) {
      return NextResponse.json({ error: 'Webhook subscription limit reached.' }, { status: 409 });
    }

    const now = new Date();
    const doc = {
      agentId: auth.agent.id,
      agentName: auth.agent.name,
      url: url.toString(),
      events,
      active: true,
      description,
      secret: createWebhookSecret(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS).insertOne(doc);

    return NextResponse.json(
      {
        webhook: safeWebhook({ ...doc, _id: result.insertedId }, true),
        signing: {
          header: 'X-Hive-Signature',
          algorithm: 'HMAC-SHA256',
          note: 'Store the secret now. It is only returned on creation.',
        },
      },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    logger.error('POST /api/webhooks error:', error);
    return NextResponse.json({ error: 'Failed to create webhook.' }, { status: 500 });
  }
}
