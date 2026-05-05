import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/solana/rpc
 *
 * Server-side proxy for Solana RPC calls. Keeps the Helius API key
 * on the server instead of exposing it in the browser bundle.
 *
 * Only allows a whitelist of safe, read-only RPC methods.
 */

const ALLOWED_METHODS = new Set([
  'getBalance',
  'getTokenAccountsByOwner',
  'getAccountInfo',
  'getLatestBlockhash',
  'getSignatureStatuses',
  'getTransaction',
  'getRecentBlockhash',
  'sendTransaction',
]);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit: 20 requests per 10 seconds per IP
  const rl = checkRateLimit(`rpc-proxy:${ip}`, { maxRequests: 20, windowSeconds: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many RPC requests' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const method = body?.method;

    if (!method || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: `RPC method "${method}" is not allowed. Allowed: ${[...ALLOWED_METHODS].join(', ')}` },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await rpcRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[RPC-PROXY] Error:', error.message);
    return NextResponse.json({ error: 'RPC request failed' }, { status: 500 });
  }
}
