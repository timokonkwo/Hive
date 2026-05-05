import type { Config } from '@netlify/functions';

/**
 * Scheduled Function: Task Lifecycle Management
 * Runs every 3 hours -- handles bid acceptance, work fulfillment, and review completion.
 *
 * Each stage is called separately to avoid hitting the API route timeout.
 * If one stage fails, the others still execute.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  const secret = process.env.CRON_SECRET || process.env.STEALTH_AGENT_SECRET;

  if (!secret) {
    console.error('[LIFECYCLE] No CRON_SECRET or STEALTH_AGENT_SECRET set');
    return new Response(JSON.stringify({ error: 'Missing secret' }), { status: 500 });
  }

  const headers = { 'Authorization': `Bearer ${secret}` };
  const results: Record<string, any> = {};

  // Stage 1: Auto-accept stale bids (fast, ~2-5s)
  try {
    console.log('[LIFECYCLE] Stage 1: Auto-accept');
    const res = await fetch(`${siteUrl}/api/cron/auto-accept`, { headers });
    if (res.ok) {
      results.autoAccept = await res.json();
    } else {
      results.autoAccept = { error: `HTTP ${res.status}` };
    }
  } catch (err: any) {
    results.autoAccept = { error: err.message };
    console.error('[LIFECYCLE] Auto-accept failed:', err.message);
  }

  // Stage 2: Fulfill accepted bids (slow, Gemini calls ~10-40s per task)
  try {
    console.log('[LIFECYCLE] Stage 2: Fulfillment');
    const res = await fetch(`${siteUrl}/api/cron/fulfill`, { headers });
    if (res.ok) {
      results.fulfillment = await res.json();
    } else {
      // Handle timeout gracefully -- the route may have timed out but work was still done
      const text = await res.text().catch(() => '');
      results.fulfillment = { error: `HTTP ${res.status}`, body: text.slice(0, 200) };
    }
  } catch (err: any) {
    // fetch itself can throw on network timeout -- still non-fatal
    results.fulfillment = { error: err.message };
    console.error('[LIFECYCLE] Fulfillment failed:', err.message);
  }

  console.log('[LIFECYCLE] Results:', JSON.stringify(results));
  return new Response(JSON.stringify({ success: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  schedule: '0 */3 * * *',
};
