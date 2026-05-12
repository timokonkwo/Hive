import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Webhook Dispatch
 * Runs every 5 minutes and drains queued webhook deliveries.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[WEBHOOKS] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    const res = await fetch(`${siteUrl}/api/cron/webhooks`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err: any) {
    console.error('[WEBHOOKS] Dispatch failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
