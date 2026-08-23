import type { Config } from '@netlify/functions';

export default async () => {
  const siteUrl = process.env.SITE_URL || process.env.URL || 'https://bnb.uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[BNB_AGENT_CACHE] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  const url = `${siteUrl}/api/cron/bnb-agent-cache?mode=all&pages=2&pageSize=50&batch=6`;
  try {
    console.log(`[BNB_AGENT_CACHE] Triggering ${url}`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await response.text();
    console.log('[BNB_AGENT_CACHE] Result:', text.slice(0, 2000));
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cache refresh failed';
    console.error('[BNB_AGENT_CACHE] Failed:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '*/30 * * * *',
};
