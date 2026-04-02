/**
 * x402 Holder Verification
 *
 * Verifies that a wallet holds $HIVE tokens on Solana.
 * Any balance > 0 grants access to premium API endpoints.
 */

import { getHiveBalance, getHolderTier, getTierInfo } from '@/lib/token-utils';
import { PublicKey } from '@solana/web3.js';

export interface HolderVerificationResult {
  allowed: boolean;
  tier: string;
  balance: number;
  tierInfo?: any;
  error?: string;
}

// In-memory cache: wallet → { result, fetchedAt }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { result: HolderVerificationResult; fetchedAt: number }>();

/**
 * Verify a wallet holds $HIVE and return access decision.
 */
export async function verifyHolderAccess(walletAddress: string): Promise<HolderVerificationResult> {
  if (!walletAddress) {
    return { allowed: false, tier: 'none', balance: 0, error: 'Wallet address required' };
  }

  // Validate Solana address
  try {
    new PublicKey(walletAddress);
  } catch {
    return { allowed: false, tier: 'none', balance: 0, error: 'Invalid Solana wallet address' };
  }

  // Check cache
  const cached = cache.get(walletAddress);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.result;
  }

  try {
    const balance = await getHiveBalance(walletAddress);
    const tier = getHolderTier(balance);
    const tierInfo = getTierInfo(balance);

    const result: HolderVerificationResult = {
      allowed: balance > 0,
      tier,
      balance,
      tierInfo,
    };

    // Cache result
    if (cache.size >= 500) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(walletAddress, { result, fetchedAt: Date.now() });

    return result;
  } catch (err: any) {
    console.error('[x402] Holder verification error:', err.message);
    return { allowed: false, tier: 'none', balance: 0, error: 'Failed to verify holdings' };
  }
}

/**
 * Generate 402 response headers for non-holders.
 */
export function getHolderRequiredHeaders(): Record<string, string> {
  return {
    'X-Payment-Required': 'Hold any amount of $HIVE tokens',
    'X-Buy-URL': 'https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',
  };
}
