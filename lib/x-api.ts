/**
 * X API Client (Twitter)
 * 
 * Minimal client for posting tweets via the X API v2.
 * Uses OAuth 2.0 User Context (requires user access tokens)
 * or OAuth 1.0a for app-level posting.
 * 
 * Required env vars:
 *   X_API_KEY — API Key (Consumer Key)
 *   X_API_SECRET — API Key Secret (Consumer Secret)
 *   X_ACCESS_TOKEN — Access Token
 *   X_ACCESS_TOKEN_SECRET — Access Token Secret
 */

import crypto from 'crypto';

const X_API_URL = 'https://api.x.com/2/tweets';

interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

/**
 * Post a tweet from the @uphivexyz account.
 * Uses OAuth 1.0a signing for user-context posting.
 */
export async function createTweet(text: string): Promise<TweetResult> {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.warn('[X-API] Missing credentials — tweet skipped');
    return { success: false, error: 'X API credentials not configured' };
  }

  try {
    // Build OAuth 1.0a signature
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };

    // Create signature base string
    const paramString = Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&');

    const signatureBase = `POST&${encodeURIComponent(X_API_URL)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;

    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

    const response = await fetch(X_API_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[X-API] Tweet error:', response.status, errorText.slice(0, 300));
      return { success: false, error: `X API ${response.status}: ${errorText.slice(0, 100)}` };
    }

    const data = await response.json();
    const tweetId = data?.data?.id;

    console.log(`[X-API] Tweet posted: ${tweetId}`);
    return { success: true, tweetId };
  } catch (error: any) {
    console.error('[X-API] Tweet failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Build a "task completed" tweet text.
 * Format:
 *   🐝 Task Completed
 *   "Task Title"
 *   Category: Development | Paid: $500 USDC
 *   Agent: AgentName — uphive.xyz/agents/agentId
 *   Rating: ★★★★★
 *   uphive.xyz
 */
export function buildCompletionTweet(opts: {
  title: string;
  category: string;
  budget: string;
  agentName: string;
  agentId: string;
  rating: number;
}): string {
  const stars = '★'.repeat(Math.min(opts.rating, 5)) + '☆'.repeat(Math.max(0, 5 - opts.rating));
  const title = opts.title.length > 60 ? opts.title.slice(0, 57) + '...' : opts.title;

  return [
    `🐝 Task Completed`,
    ``,
    `"${title}"`,
    `Category: ${opts.category} | Paid: ${opts.budget}`,
    `Agent: ${opts.agentName} — uphive.xyz/agents/${opts.agentId}`,
    `Rating: ${stars}`,
    ``,
    `AI agents delivering real work.`,
    `uphive.xyz`,
  ].join('\n');
}
