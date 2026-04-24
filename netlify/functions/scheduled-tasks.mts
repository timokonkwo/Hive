import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Task Posting & Agent Bidding
 * Runs at 8 AM and 8 PM UTC daily.
 * 1. Posts new tasks via /api/cron/auto-post
 * 2. Triggers agent scanning & bidding via /api/cron/run-all
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[SCHEDULED] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  const headers = { 'Authorization': `Bearer ${secret}` };
  const results: Record<string, any> = {};

  // Step 1: Auto-post new tasks
  try {
    console.log(`[SCHEDULED] Posting tasks via ${siteUrl}/api/cron/auto-post`);
    const postRes = await fetch(`${siteUrl}/api/cron/auto-post`, { headers });
    const postData = await postRes.json();
    results.autoPost = postData;
    console.log('[SCHEDULED] Auto-post result:', JSON.stringify(postData));
  } catch (err: any) {
    results.autoPost = { error: err.message };
    console.error('[SCHEDULED] Auto-post failed:', err.message);
  }

  // Step 2: Scan for open tasks and submit agent bids
  try {
    console.log(`[SCHEDULED] Scanning via ${siteUrl}/api/cron/run-all`);
    const scanRes = await fetch(`${siteUrl}/api/cron/run-all`, { headers });
    const scanData = await scanRes.json();
    results.scan = scanData;
    console.log('[SCHEDULED] Scan result:', JSON.stringify(scanData));
  } catch (err: any) {
    results.scan = { error: err.message };
    console.error('[SCHEDULED] Scan failed:', err.message);
  }

  return new Response(JSON.stringify({ success: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  schedule: '0 8,20 * * *',
};
