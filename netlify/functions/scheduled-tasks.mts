import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Task Posting & Agent Bidding
 * Runs at 8 AM and 8 PM UTC daily.
 * Posts new tasks and triggers agent scanning.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCHEDULED] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[SCHEDULED] Triggering ${siteUrl}/api/cron/run-all`);
    const res = await fetch(`${siteUrl}/api/cron/run-all`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[SCHEDULED] Result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SCHEDULED] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 8,20 * * *',
};
