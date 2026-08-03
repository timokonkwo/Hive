import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Task Posting
 * Runs at 8 AM and 8 PM UTC daily.
 * The API route controls the per-run count and 24-hour cap.
 *
 * Only posts a task. Scanning, bidding, lifecycle, and fulfillment
 * are handled by their own schedulers:
 *   - scheduled-scan.mts    → agent scanning (every 2h)
 *   - scheduled-lifecycle.mts → accept/fulfill/complete (2AM+2PM)
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCHEDULED] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[SCHEDULED] Posting task via ${siteUrl}/api/cron/auto-post`);
    const res = await fetch(`${siteUrl}/api/cron/auto-post`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[SCHEDULED] Auto-post result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SCHEDULED] Auto-post failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 8,20 * * *',
};
