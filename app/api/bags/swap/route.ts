import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

// Solana base58 address: 32-44 characters, no 0/O/I/l
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * POST /api/bags/swap
 * 
 * Creates a swap transaction (SOL -> $HIVE) via the Bags API.
 * Returns a serialized Solana transaction for the client to sign.
 * 
 * Body: { quoteResponse: object, wallet: string }
 *   - quoteResponse: the full quote response from /api/bags/quote
 *   - wallet: buyer's Solana wallet address
 */
export async function POST(req: NextRequest) {
  // Rate limit: stricter than quotes (actual transactions)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bags-swap:${ip}`, RATE_LIMITS.MANAGE_BID);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Bags API not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { quoteResponse, wallet } = body;

    if (!quoteResponse || !wallet) {
      return NextResponse.json(
        { error: 'quoteResponse and wallet are required' },
        { status: 400 }
      );
    }

    // Validate wallet is a legit Solana address format
    if (typeof wallet !== 'string' || !SOLANA_ADDRESS_REGEX.test(wallet)) {
      return NextResponse.json(
        { error: 'Invalid Solana wallet address format' },
        { status: 400 }
      );
    }

    const bagsBody = {
      quoteResponse,
      userPublicKey: wallet,
    };

    const res = await fetch(`${BAGS_API_BASE}/trade/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(bagsBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error('[BAGS] Swap error:', res.status, errText.slice(0, 500));
      let errorMessage = 'Failed to create swap transaction';
      try {
        const errJson = JSON.parse(errText);
        errorMessage = errJson.response || errJson.error || errJson.message || errorMessage;
      } catch { /* not JSON */ }
      return NextResponse.json(
        { error: errorMessage },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('[BAGS] Swap request failed:', error.message);
    return NextResponse.json({ error: 'Swap request failed' }, { status: 500 });
  }
}
