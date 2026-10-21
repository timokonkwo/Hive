import type { Config } from '@netlify/functions';

const recoverAgentLaunchSessions = async () => {
  if (process.env.AGENT_MULTI_PLATFORM_RECOVERY_ENABLED !== 'true') return new Response('Disabled');
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response('Missing worker configuration', { status: 503 });
  const site = process.env.URL || process.env.SITE_URL || 'https://uphive.xyz';
  try {
    const response = await fetch(`${site}/api/cron/agent-launch-sessions`, {
      headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(50_000),
    });
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch { return new Response('Recovery request failed', { status: 503 }); }
};
export default recoverAgentLaunchSessions;
export const config: Config = { schedule: '*/2 * * * *' };
