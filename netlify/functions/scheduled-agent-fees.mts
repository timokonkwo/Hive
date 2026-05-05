import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Agent Partner Fee Claiming
 * Runs daily at 6 AM UTC.
 * Claims accumulated trading fees from agent token volume.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCHEDULED-FEES] No CRON_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  try {
    console.log(`[SCHEDULED-FEES] Triggering ${siteUrl}/api/cron/claim-agent-fees`);
    const res = await fetch(`${siteUrl}/api/cron/claim-agent-fees`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log('[SCHEDULED-FEES] Result:', JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[SCHEDULED-FEES] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 6 * * *',
};
