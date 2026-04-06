import { NextRequest, NextResponse } from 'next/server';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const HIVE_MINT = '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * GET /api/bags/quote?amount=1000000000
 * 
 * Get a swap quote for SOL → $HIVE.
 * Amount is in lamports (1 SOL = 1_000_000_000 lamports).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amount = searchParams.get('amount');

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json(
      { error: 'amount is required (in lamports, e.g., 1000000000 = 1 SOL)' },
      { status: 400 }
    );
  }

  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Bags API not configured' }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: HIVE_MINT,
      amount,
      slippageMode: 'auto',
    });

    const res = await fetch(`${BAGS_API_BASE}/trade/quote?${params}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[BAGS] Quote error:', res.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: 'Failed to fetch quote from Bags' },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BAGS] Quote request failed:', error.message);
    return NextResponse.json({ error: 'Quote request failed' }, { status: 500 });
  }
}
