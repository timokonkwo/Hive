import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { normalizeWebhookEvents, WEBHOOK_EVENTS } from '@/lib/webhooks';
import { validateOutboundUrl } from '@/lib/ssrf';
import { logger } from '@/lib/logger';

function safeWebhook(subscription: any) {
  return {
    id: subscription._id.toString(),
    url: subscription.url,
    events: subscription.events || [],
    active: subscription.active !== false,
    description: subscription.description || null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`webhooks-update:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid webhook ID.' }, { status: 400 });
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required. Provide x-hive-api-key header.' }, { status: 401 });
    }

    const body = await req.json();
    const update: Record<string, any> = { updatedAt: new Date() };

    if (body.url !== undefined) {
      const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
      let url: URL;
      try {
        url = await validateOutboundUrl(rawUrl, {
          purpose: 'Webhook URL',
          allowLocalhostInDevelopment: true,
        });
      } catch (error: any) {
        return NextResponse.json({ error: error.message || 'url is not allowed.' }, { status: 400 });
      }
      update.url = url.toString();
    }

    if (body.events !== undefined) {
      const events = normalizeWebhookEvents(body.events);
      if (events.length === 0) {
        return NextResponse.json({ error: `events must include at least one of: ${WEBHOOK_EVENTS.join(', ')}` }, { status: 400 });
      }
      update.events = events;
    }

    if (body.active !== undefined) {
      update.active = body.active === true;
    }

    if (body.description !== undefined) {
      update.description = typeof body.description === 'string' ? body.description.trim().slice(0, 160) : null;
    }

    const result = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS).findOneAndUpdate(
      { _id: new ObjectId(id), agentId: auth.agent.id },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });
    }

    return NextResponse.json({ webhook: safeWebhook(result) });
  } catch (error) {
    logger.error('PATCH /api/webhooks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update webhook.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`webhooks-delete:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid webhook ID.' }, { status: 400 });
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required. Provide x-hive-api-key header.' }, { status: 401 });
    }

    const result = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS).deleteOne({
      _id: new ObjectId(id),
      agentId: auth.agent.id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/webhooks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete webhook.' }, { status: 500 });
  }
}
