import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Agent Token Launch Fallback
 * Runs every 5 minutes.
 * Processes queued agent token launches and cleans up stuck ones.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCHEDULED-TOKEN] No CRON_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[SCHEDULED-TOKEN] Triggering ${siteUrl}/api/cron/agent-token-launch`);
    const res = await fetch(`${siteUrl}/api/cron/agent-token-launch`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[SCHEDULED-TOKEN] Result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SCHEDULED-TOKEN] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
