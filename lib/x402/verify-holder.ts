/**
 * x402 Holder Verification
 *
 * Verifies that a wallet holds $HIVE tokens on Solana.
 * Any balance > 0 grants access to premium API endpoints.
 */

import { getHiveBalance, getHolderTier, getStakingTierInfo, getTierInfo } from '@/lib/token-utils';
import { PublicKey } from '@solana/web3.js';
import { getDb, COLLECTIONS } from '@/lib/db';
import { verifyAndConsumeSolanaMessageSignature } from '@/lib/solana-signature';

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
export async function verifyHolderAccess(
  walletAddress: string,
  options: { message?: string | null; signature?: string | null; requireSignature?: boolean } = {}
): Promise<HolderVerificationResult> {
  if (!walletAddress) {
    return { allowed: false, tier: 'none', balance: 0, error: 'Wallet address required' };
  }

  // Validate Solana address
  try {
    new PublicKey(walletAddress);
  } catch {
    return { allowed: false, tier: 'none', balance: 0, error: 'Invalid Solana wallet address' };
  }

  const normalizedWallet = new PublicKey(walletAddress).toBase58();
  if (options.requireSignature) {
    if (!options.message || !options.signature) {
      return { allowed: false, tier: 'none', balance: 0, error: 'Wallet signature required for premium access' };
    }
    const db = await getDb();
    const proof = await verifyAndConsumeSolanaMessageSignature(db, {
      address: normalizedWallet,
      action: 'premium_api',
      message: options.message,
      signature: options.signature,
    });
    if (!proof.verified) {
      return { allowed: false, tier: 'none', balance: 0, error: proof.error || 'Wallet signature could not be verified' };
    }
  }

  // Check cache
  const cached = cache.get(normalizedWallet);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.result;
  }

  try {
    const balance = await getHiveBalance(normalizedWallet);
    const tier = getHolderTier(balance);
    const tierInfo = getTierInfo(balance);
    const db = await getDb();
    const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: normalizedWallet });
    const activeStake = stake?.activeAmount || 0;
    const stakingTierInfo = getStakingTierInfo(activeStake);

    const result: HolderVerificationResult = {
      allowed: balance > 0 || activeStake > 0,
      tier: stakingTierInfo?.id || tier,
      balance,
      tierInfo: stakingTierInfo || tierInfo,
    };

    // Cache result
    if (cache.size >= 500) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(normalizedWallet, { result, fetchedAt: Date.now() });

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
