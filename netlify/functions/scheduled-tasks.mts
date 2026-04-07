import type { Config } from '@netlify/functions';

/**
 * Scheduled function: auto-post tasks twice per day (8 AM and 8 PM UTC).
 * Also runs auto-accept (stale bids) and auto-complete (stale reviews).
 */
export default async () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[CRON] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response('Missing secret', { status: 500 });
  }

  const headers = {
    'Authorization': `Bearer ${secret}`,
  };

  const results: Record<string, any> = {};

  // 1. Auto-post new tasks
  try {
    const postRes = await fetch(`${siteUrl}/api/cron/auto-post`, { headers });
    results.autoPost = await postRes.json();
    console.log('[CRON] Auto-post:', JSON.stringify(results.autoPost));
  } catch (err: any) {
    results.autoPost = { error: err.message };
    console.error('[CRON] Auto-post failed:', err.message);
  }

  // 2. Auto-accept stale bids + auto-complete reviews
  try {
    const acceptRes = await fetch(`${siteUrl}/api/cron/auto-accept`, { headers });
    results.autoAccept = await acceptRes.json();
    console.log('[CRON] Auto-accept/complete:', JSON.stringify(results.autoAccept));
  } catch (err: any) {
    results.autoAccept = { error: err.message };
    console.error('[CRON] Auto-accept failed:', err.message);
  }

  // 3. Sweep for unbid tasks
  try {
    const sweepRes = await fetch(`${siteUrl}/api/cron/stealth-sweep`, { headers });
    results.sweep = await sweepRes.json();
    console.log('[CRON] Sweep:', JSON.stringify(results.sweep));
  } catch (err: any) {
    results.sweep = { error: err.message };
    console.error('[CRON] Sweep failed:', err.message);
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// Run at 8 AM and 8 PM UTC every day
export const config: Config = {
  schedule: '0 8,20 * * *',
};
