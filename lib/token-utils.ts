import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

/**
 * $HIVE Token Utility
 *
 * On-chain balance checks and tier mapping for holder verification.
 */

export const HIVE_MINT = new PublicKey('6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS');

// Token has 6 decimals (standard for Bags launches)
export const HIVE_DECIMALS = 6;

export type HiveTier = 'none' | 'holder' | 'stacker' | 'og';

export interface TierInfo {
  id: HiveTier;
  label: string;
  emoji: string;
  threshold: number;
  color: string;
  benefits: string[];
}

export const TIERS: Record<Exclude<HiveTier, 'none'>, TierInfo> = {
  holder: {
    id: 'holder',
    label: 'Holder',
    emoji: '🐝',
    threshold: 10_000,
    color: 'emerald',
    benefits: [
      'Share in platform revenue based on your holdings',
      'Priority access to top agents',
      'Verified Holder badge on your profile',
      'Governance vote when it goes live',
    ],
  },
  stacker: {
    id: 'stacker',
    label: 'Stacker',
    emoji: '⚡',
    threshold: 100_000,
    color: 'blue',
    benefits: [
      'Bigger cut of platform revenue',
      'Best agents matched to you at reduced rates',
      'Tasks and proposals highlighted everywhere',
      'Early access to new features',
    ],
  },
  og: {
    id: 'og',
    label: 'OG',
    emoji: '👑',
    threshold: 1_000_000,
    color: 'amber',
    benefits: [
      'Largest revenue share in every distribution',
      'Top agents, best rates, first priority',
      'Featured on homepage and marketplace',
      'x402 Premium API included',
      'Gold OG badge',
      'Direct say in platform decisions',
    ],
  },
};

export const ALL_TIERS = [TIERS.holder, TIERS.stacker, TIERS.og];

/**
 * Get the $HIVE token balance for a Solana wallet.
 * Returns the human-readable balance (decimals applied).
 */
export async function getHiveBalance(walletAddress: string): Promise<number> {
  const rpcUrl = (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com').trim();
  const connection = new Connection(rpcUrl);

  try {
    const owner = new PublicKey(walletAddress);
    const ata = getAssociatedTokenAddressSync(HIVE_MINT, owner);

    const accountInfo = await connection.getTokenAccountBalance(ata);
    return accountInfo.value.uiAmount ?? 0;
  } catch (err: any) {
    // Account doesn't exist = 0 balance
    if (
      err.message?.includes('could not find account') ||
      err.message?.includes('Invalid param') ||
      err.message?.includes('AccountNotFound')
    ) {
      return 0;
    }
    // TokenAccountNotFoundError from getTokenAccountBalance
    if (err.message?.includes('TokenAccountNotFoundError') || err.toString?.().includes('TokenAccountNotFoundError')) {
      return 0;
    }
    throw err;
  }
}

/**
 * Map a balance to a tier.
 */
export function getHolderTier(balance: number): HiveTier {
  if (balance >= TIERS.og.threshold) return 'og';
  if (balance >= TIERS.stacker.threshold) return 'stacker';
  if (balance >= TIERS.holder.threshold) return 'holder';
  return 'none';
}

/**
 * Get tier info for a balance.
 */
export function getTierInfo(balance: number): TierInfo | null {
  const tier = getHolderTier(balance);
  if (tier === 'none') return null;
  return TIERS[tier];
}
