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
      'Smart agent recommendations via holder-gated premium API',
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
      'Competition analysis & trends via holder-gated premium API',
      'Gold OG badge',
      'Direct say in platform decisions',
    ],
  },
};

export const ALL_TIERS = [TIERS.holder, TIERS.stacker, TIERS.og];

export type StakingTier = 'none' | 'staker' | 'power' | 'governor';

export interface StakingTierInfo {
  id: StakingTier;
  label: string;
  threshold: number;
  color: string;
  routingDiscountBps: number;
  pointsMultiplier: number;
  governanceMultiplier: number;
  benefits: string[];
}

export const STAKING_TIERS: Record<Exclude<StakingTier, 'none'>, StakingTierInfo> = {
  staker: {
    id: 'staker',
    label: 'Staker',
    threshold: 100_000,
    color: 'emerald',
    routingDiscountBps: 500,
    pointsMultiplier: 1.25,
    governanceMultiplier: 1,
    benefits: [
      'Premium API access',
      '5% MCP routing discount',
      '1.25x Hive Points',
      'DAO voting eligibility',
      'Staker badge',
    ],
  },
  power: {
    id: 'power',
    label: 'Power Staker',
    threshold: 1_000_000,
    color: 'blue',
    routingDiscountBps: 1000,
    pointsMultiplier: 1.5,
    governanceMultiplier: 1.25,
    benefits: [
      '10% MCP routing discount',
      '1.5x Hive Points',
      'Proposal access',
      'Priority routing',
      'Early feature access',
    ],
  },
  governor: {
    id: 'governor',
    label: 'Governor',
    threshold: 10_000_000,
    color: 'amber',
    routingDiscountBps: 2000,
    pointsMultiplier: 2,
    governanceMultiplier: 2,
    benefits: [
      '20% MCP routing discount',
      '2x Hive Points',
      'Advanced governance',
      'High-trust badge',
      'Priority access to tokenized tool launches',
    ],
  },
};

export const ALL_STAKING_TIERS = [
  STAKING_TIERS.staker,
  STAKING_TIERS.power,
  STAKING_TIERS.governor,
];

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

export function getStakingTier(stakedAmount: number): StakingTier {
  if (stakedAmount >= STAKING_TIERS.governor.threshold) return 'governor';
  if (stakedAmount >= STAKING_TIERS.power.threshold) return 'power';
  if (stakedAmount >= STAKING_TIERS.staker.threshold) return 'staker';
  return 'none';
}

export function getStakingTierInfo(stakedAmount: number): StakingTierInfo | null {
  const tier = getStakingTier(stakedAmount);
  if (tier === 'none') return null;
  return STAKING_TIERS[tier];
}

export async function verifyHiveTransfer(
  txSignature: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountHive: number,
  options: { maxAgeMinutes?: number } = {}
): Promise<{ verified: boolean; error?: string; confirmedAmount?: number; blockTime?: number }> {
  try {
    if (expectedSender === expectedRecipient) {
      return { verified: false, error: 'Sender and recipient cannot be the same address.' };
    }

    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'finalized');
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized',
    });

    if (!tx) {
      return { verified: false, error: 'Transaction not found. It may still be confirming.' };
    }

    if (tx.meta?.err) {
      return { verified: false, error: 'Transaction failed on-chain.' };
    }

    const maxAgeMinutes = options.maxAgeMinutes ?? 15;
    if (!tx.blockTime) {
      return { verified: false, error: 'Transaction block time is unavailable.' };
    }
    const ageMs = Date.now() - tx.blockTime * 1000;
    if (ageMs > maxAgeMinutes * 60 * 1000) {
      return { verified: false, error: `Transaction is older than ${maxAgeMinutes} minutes.` };
    }

    const sender = new PublicKey(expectedSender);
    const recipient = new PublicKey(expectedRecipient);
    const senderAta = getAssociatedTokenAddressSync(HIVE_MINT, sender);
    const recipientAta = getAssociatedTokenAddressSync(HIVE_MINT, recipient);
    const expectedRawAmount = Math.round(expectedAmountHive * Math.pow(10, HIVE_DECIMALS));

    const instructions = tx.transaction.message.instructions;
    const innerInstructions = tx.meta?.innerInstructions || [];
    const allInstructions = [
      ...instructions,
      ...innerInstructions.flatMap((ii: any) => ii.instructions),
    ];

    for (const ix of allInstructions) {
      const parsed = (ix as any)?.parsed;
      if (!parsed || (parsed.type !== 'transfer' && parsed.type !== 'transferChecked')) continue;

      const info = parsed.info;
      if (parsed.type === 'transferChecked' && info.mint !== HIVE_MINT.toBase58()) {
        continue;
      }

      const amount = parsed.type === 'transferChecked'
        ? Number(info.tokenAmount?.amount || 0)
        : Number(info.amount || 0);

      if (amount < expectedRawAmount) continue;
      if (info.source !== senderAta.toBase58()) continue;
      if (info.destination !== recipientAta.toBase58()) continue;
      if (info.authority !== expectedSender) continue;

      return {
        verified: true,
        confirmedAmount: amount / Math.pow(10, HIVE_DECIMALS),
        blockTime: tx.blockTime,
      };
    }

    return { verified: false, error: 'No matching HIVE transfer found in transaction.' };
  } catch (error: any) {
    return { verified: false, error: `Verification failed: ${error.message}` };
  }
}
