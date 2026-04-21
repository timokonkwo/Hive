import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const HIVE_MINT = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Solana base58 address: 32-44 characters, no 0/O/I/l
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * POST /api/bags/swap
 * 
 * Creates a swap transaction (SOL → $HIVE) via the Bags API.
 * Returns a serialized Solana transaction for the client to sign.
 * 
 * Body: { amount: string, wallet: string }
 *   - amount: lamports (e.g., "1000000000" = 1 SOL)
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
    const { amount, wallet, quoteRequestId } = body;

    if (!amount || !wallet) {
      return NextResponse.json(
        { error: 'amount (lamports) and wallet are required' },
        { status: 400 }
      );
    }

    if (!quoteRequestId) {
      return NextResponse.json(
        { error: 'quoteRequestId is required. Fetch a quote first.' },
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

    // Validate and cap amount
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100_000_000_000) {
      return NextResponse.json(
        { error: 'Amount must be between 1 lamport and 100 SOL' },
        { status: 400 }
      );
    }

    const res = await fetch(`${BAGS_API_BASE}/trade/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        inputMint: SOL_MINT,
        outputMint: HIVE_MINT,
        amount: String(amount),
        slippageMode: 'auto',
        userPublicKey: wallet,
        requestId: quoteRequestId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[BAGS] Swap error:', res.status, errText.slice(0, 500));
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
    console.error('[BAGS] Swap request failed:', error.message);
    return NextResponse.json({ error: 'Swap request failed' }, { status: 500 });
  }
}
