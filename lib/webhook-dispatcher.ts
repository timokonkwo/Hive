import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';
import { validateOutboundUrl } from '@/lib/ssrf';

const MAX_ATTEMPTS = 8;

function nextAttemptDate(attempts: number): Date {
  const delaySeconds = Math.min(60 * 60, Math.pow(2, attempts) * 30);
  return new Date(Date.now() + delaySeconds * 1000);
}

export async function dispatchQueuedWebhooks(
  db: Db,
  options: { limit?: number; timeoutMs?: number } = {}
): Promise<{ attempted: number; delivered: number; failed: number; deferred: number; errors: string[] }> {
  const limit = Math.min(Math.max(options.limit || 25, 1), 100);
  const timeoutMs = Math.min(Math.max(options.timeoutMs || 8000, 1000), 20000);
  const now = new Date();
  const errors: string[] = [];
  let attempted = 0;
  let delivered = 0;
  let failed = 0;
  let deferred = 0;

  const deliveries = await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES)
    .find({
      status: 'pending',
      nextAttemptAt: { $lte: now },
      attempts: { $lt: MAX_ATTEMPTS },
    })
    .sort({ nextAttemptAt: 1, createdAt: 1 })
    .limit(limit)
    .toArray();

  for (const delivery of deliveries) {
    attempted++;
    const deliveryId = delivery._id.toString();

    try {
      const claim = await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES).updateOne(
        { _id: new ObjectId(deliveryId), status: 'pending', attempts: delivery.attempts || 0 },
        {
          $set: { status: 'sending', updatedAt: new Date() },
          $inc: { attempts: 1 },
        }
      );

      if (claim.matchedCount === 0) {
        deferred++;
        continue;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        const url = await validateOutboundUrl(delivery.url, { purpose: 'Webhook URL' });
        response = await fetch(url, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Hive-Webhooks/1.0',
            'X-Hive-Event': delivery.event,
            'X-Hive-Delivery': deliveryId,
            'X-Hive-Signature': delivery.signature,
          },
          body: delivery.payload,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) {
        delivered++;
        await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES).updateOne(
          { _id: new ObjectId(deliveryId) },
          {
            $set: {
              status: 'delivered',
              deliveredAt: new Date(),
              lastStatusCode: response.status,
              lastError: null,
              updatedAt: new Date(),
            },
          }
        );
        continue;
      }

      const attempts = (delivery.attempts || 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      if (terminal) failed++;
      else deferred++;

      await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES).updateOne(
        { _id: new ObjectId(deliveryId) },
        {
          $set: {
            status: terminal ? 'failed' : 'pending',
            lastStatusCode: response.status,
            lastError: `HTTP ${response.status}`,
            nextAttemptAt: terminal ? null : nextAttemptDate(attempts),
            updatedAt: new Date(),
          },
        }
      );
    } catch (error: any) {
      const attempts = (delivery.attempts || 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      if (terminal) failed++;
      else deferred++;
      errors.push(`${deliveryId}: ${error.message || 'unknown error'}`);

      await db.collection(COLLECTIONS.WEBHOOK_DELIVERIES).updateOne(
        { _id: new ObjectId(deliveryId) },
        {
          $set: {
            status: terminal ? 'failed' : 'pending',
            lastError: error.message || 'Delivery failed',
            nextAttemptAt: terminal ? null : nextAttemptDate(attempts),
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  return { attempted, delivered, failed, deferred, errors };
}
