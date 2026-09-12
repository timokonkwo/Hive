import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/solana/rpc
 *
 * Server-side proxy for Solana RPC calls. Keeps the Helius API key
 * on the server instead of exposing it in the browser bundle.
 *
 * Only allows a narrow whitelist of RPC methods needed by the app.
 */

const ALLOWED_METHODS = new Set([
  'getBalance',
  'getGenesisHash',
  'getTokenAccountBalance',
  'getFeeForMessage',
  'getMinimumBalanceForRentExemption',
  'getTokenAccountsByOwner',
  'getAccountInfo',
  'getLatestBlockhash',
  'getBlockHeight',
  'isBlockhashValid',
  'getSignatureStatuses',
  'getTransaction',
  'getRecentBlockhash',
  'sendTransaction',
]);

const MAX_RPC_BODY_BYTES = 96 * 1024;
const MAX_SIGNED_TRANSACTION_CHARS = 32 * 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function normalizeRpcBody(body: any) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new Error('RPC body must be a JSON object');
  }

  const method = body.method;
  if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
    throw new Error(`RPC method "${method}" is not allowed. Allowed: ${[...ALLOWED_METHODS].join(', ')}`);
  }

  if (body.params !== undefined && !Array.isArray(body.params)) {
    throw new Error('RPC params must be an array');
  }

  if (method === 'sendTransaction') {
    const signedTransaction = body.params?.[0];
    if (typeof signedTransaction !== 'string' || signedTransaction.length === 0) {
      throw new Error('sendTransaction requires a signed transaction string');
    }
    if (signedTransaction.length > MAX_SIGNED_TRANSACTION_CHARS) {
      throw new Error('Signed transaction is too large');
    }
    if (!BASE64_PATTERN.test(signedTransaction)) {
      throw new Error('sendTransaction requires base64 transaction encoding');
    }

    const options = body.params?.[1] && typeof body.params[1] === 'object' ? body.params[1] : {};
    const maxRetries = Number.isFinite(Number(options.maxRetries))
      ? Math.min(Math.max(Number(options.maxRetries), 0), 5)
      : 3;
    body.params = [
      signedTransaction,
      {
        ...options,
        encoding: 'base64',
        maxRetries,
      },
    ];
  }

  return {
    jsonrpc: body.jsonrpc || '2.0',
    id: body.id ?? crypto.randomUUID(),
    method,
    params: body.params || [],
  };
}

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
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_RPC_BODY_BYTES) {
      return NextResponse.json(
        { error: 'RPC request body is too large' },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let rpcBody: any;
    try {
      rpcBody = normalizeRpcBody(body);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Invalid RPC request' }, { status: 400 });
    }

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcBody),
    });

    const data = await rpcRes.json().catch(() => null);
    if (data?.error) {
      const message = data.error.message || 'Solana RPC returned an error';
      logger.warn('[RPC-PROXY] Upstream RPC error:', { method: rpcBody.method, status: rpcRes.status, message });
      return NextResponse.json(data);
    }

    if (!rpcRes.ok || !data) {
      const message = data?.error?.message || `Solana RPC returned ${rpcRes.status}`;
      logger.warn('[RPC-PROXY] Upstream RPC error:', { method: rpcBody.method, status: rpcRes.status, message });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('[RPC-PROXY] Error:', error.message);
    return NextResponse.json({ error: 'RPC request failed' }, { status: 500 });
  }
}
