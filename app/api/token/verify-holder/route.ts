import { NextRequest, NextResponse } from 'next/server';
import { getHiveBalance, getHolderTier, getTierInfo, TIERS } from '@/lib/token-utils';
import { PublicKey } from '@solana/web3.js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// In-memory LRU cache: wallet → { balance, tier, fetchedAt }
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { balance: number; tier: string; fetchedAt: number }>();

function cacheSet(key: string, value: { balance: number; tier: string; fetchedAt: number }) {
  // Evict oldest entry if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

/**
 * GET /api/token/verify-holder?wallet=<solana-address>
 *
 * Checks on-chain $HIVE balance and returns holder tier.
 * Rate limited: 30 req/min per IP.
 */
export async function GET(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  const limit = checkRateLimit(`token-verify:${ip}`, { maxRequests: 30, windowSeconds: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a moment.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.resetInSeconds),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const wallet = req.nextUrl.searchParams.get('wallet')?.trim();

  if (!wallet) {
    return NextResponse.json(
      { error: 'Missing wallet parameter' },
      { status: 400 }
    );
  }

  // Validate Solana address
  let walletKey: PublicKey;
  try {
    walletKey = new PublicKey(wallet);
  } catch {
    return NextResponse.json(
      { error: 'Invalid Solana wallet address' },
      { status: 400 }
    );
  }

  // Normalize to canonical base58 form
  const normalizedWallet = walletKey.toBase58();

  // Check cache
  const cached = cache.get(normalizedWallet);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    const tierInfo = cached.tier !== 'none' ? TIERS[cached.tier as keyof typeof TIERS] : null;
    return NextResponse.json({
      wallet: normalizedWallet,
      balance: cached.balance,
      isHolder: cached.balance > 0,
      tier: cached.tier,
      tierInfo,
      cached: true,
    });
  }

  try {
    const balance = await getHiveBalance(normalizedWallet);
    const tier = getHolderTier(balance);
    const tierInfo = getTierInfo(balance);

    // Update cache
    cacheSet(normalizedWallet, { balance, tier, fetchedAt: Date.now() });

    return NextResponse.json({
      wallet: normalizedWallet,
      balance,
      isHolder: balance > 0,
      tier,
      tierInfo,
      cached: false,
    });
  } catch (err: any) {
    console.error('[TOKEN] verify-holder error:', err.message);
    return NextResponse.json(
      { error: 'Failed to check balance. Try again in a moment.' },
      { status: 500 }
    );
  }
}
