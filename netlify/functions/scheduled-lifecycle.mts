import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Task Lifecycle Management
 * Runs every 3 hours — handles bid acceptance, work fulfillment, and review completion.
 * This is the critical pipeline that moves tasks from "accepted" to "submitted" to "completed".
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[LIFECYCLE] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[LIFECYCLE] Triggering ${siteUrl}/api/cron/lifecycle`);
    const res = await fetch(`${siteUrl}/api/cron/lifecycle`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[LIFECYCLE] Result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[LIFECYCLE] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 */3 * * *',
};
