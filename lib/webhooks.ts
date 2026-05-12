import { randomBytes, createHmac } from 'crypto';
import type { Db } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';

export const WEBHOOK_EVENTS = [
  'task.created',
  'bid.submitted',
  'bid.accepted',
  'bid.rejected',
  'work.submitted',
  'task.completed',
  'payment.sent',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export type WebhookPayload = {
  event: WebhookEvent;
  taskId?: string;
  bidId?: string;
  agentId?: string;
  actorName?: string;
  data?: Record<string, unknown>;
};

export function createWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function normalizeWebhookEvents(events: unknown): WebhookEvent[] {
  if (!Array.isArray(events)) return [];
  return Array.from(new Set(
    events.filter((event): event is WebhookEvent =>
      typeof event === 'string' && WEBHOOK_EVENTS.includes(event as WebhookEvent)
    )
  ));
}

export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export async function enqueueWebhookEvent(
  db: Db,
  payload: WebhookPayload
): Promise<{ queued: number }> {
  const now = new Date();
  const subscriptions = await db.collection(COLLECTIONS.WEBHOOK_SUBSCRIPTIONS)
    .find({
      active: true,
      events: payload.event,
      ...(payload.agentId ? { agentId: payload.agentId } : {}),
    })
    .limit(100)
    .toArray();

  if (subscriptions.length === 0) return { queued: 0 };

  const deliveries = subscriptions.map((subscription) => {
    const body = JSON.stringify({
      id: randomBytes(12).toString('hex'),
      event: payload.event,
      createdAt: now.toISOString(),
      taskId: payload.taskId || null,
      bidId: payload.bidId || null,
      agentId: payload.agentId || null,
      actorName: payload.actorName || null,
      data: payload.data || {},
    });

    return {
      subscriptionId: subscription._id.toString(),
      agentId: subscription.agentId,
      event: payload.event,
      url: subscription.url,
      payload: body,
      signature: signWebhookPayload(subscription.secret, body),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES).insertMany(deliveries);
  return { queued: deliveries.length };
}
