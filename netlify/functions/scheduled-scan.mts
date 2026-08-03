import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Agent Scanning
 * Runs every 2 hours — agents independently check for open tasks
 * and submit bids. Operates independently of task posting.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCAN] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[SCAN] Triggering ${siteUrl}/api/cron/scan`);
    const res = await fetch(`${siteUrl}/api/cron/scan`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[SCAN] Result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SCAN] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 */2 * * *',
};
