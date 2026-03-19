/**
 * Bags API Client
 * Integration with the Bags.fm platform for token launches, fee sharing, and analytics.
 * Docs: https://docs.bags.fm
 *
 * Partner Config Key: Fu2RmDkuTC7JiW5irLcrip4GVaw84U1uL4UNeKH5ncXy
 * Ref Code: hive
 */

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const BAGS_PARTNER_KEY = 'Fu2RmDkuTC7JiW5irLcrip4GVaw84U1uL4UNeKH5ncXy';
const BAGS_REF_CODE = 'hive';

interface BagsApiConfig {
  apiKey: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image?: File | string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

interface FeeShareConfig {
  walletAddress: string;
  bps: number; // Basis points (out of 10000)
  label?: string;
  socialPlatform?: 'twitter' | 'github' | 'kick';
  socialHandle?: string;
}

interface TokenLaunchParams {
  metadata: TokenMetadata;
  feeSharing?: FeeShareConfig[];
  initialBuyAmountSol?: number;
}

interface TokenLaunchResult {
  success: boolean;
  mintAddress?: string;
  transactionId?: string;
  error?: string;
}

interface TokenAnalytics {
  mintAddress: string;
  totalFees: number;
  volume24h: number;
  holders: number;
  marketCap: number;
}

interface ClaimableFee {
  source: string;
  amount: number;
  mintAddress: string;
}

/**
 * Bags API client for Hive Protocol integration.
 * Enables AI agents to launch tokens, configure fee sharing, and claim fees
 * via the Bags platform on Solana.
 */
export class BagsClient {
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(config: BagsApiConfig) {
    this.apiKey = config.apiKey.trim();
    this.headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Step 1: Create token info and metadata.
   * Uploads token image and metadata to Bags, returns a mint address for launch.
   */
  async createTokenInfo(metadata: TokenMetadata): Promise<{ mintAddress: string; metadataUri: string }> {
    const formData = new FormData();
    formData.append('name', metadata.name);
    formData.append('symbol', metadata.symbol);
    formData.append('description', metadata.description);
    
    if (metadata.twitter) formData.append('twitter', metadata.twitter);
    if (metadata.telegram) formData.append('telegram', metadata.telegram);
    if (metadata.website) formData.append('website', metadata.website);
    
    // Partner tracking
    formData.append('partnerKey', BAGS_PARTNER_KEY);
    formData.append('refCode', BAGS_REF_CODE);

    if (metadata.image && metadata.image instanceof File) {
      formData.append('image', metadata.image);
    }

    const response = await fetch(`${BAGS_API_BASE}/token/create-token-info`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Failed to create token info on Bags');
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Step 2: Configure fee sharing for a token.
   * Sets up revenue sharing between wallets (agents, creators, treasury).
   * Total BPS across all claimers must equal 10000 (100%).
   */
  async configureFeeSharing(mintAddress: string, feeClaimers: FeeShareConfig[]): Promise<{ success: boolean }> {
    const totalBps = feeClaimers.reduce((sum, c) => sum + c.bps, 0);
    if (totalBps !== 10000) {
      throw new Error(`Fee sharing BPS must total 10000, got ${totalBps}`);
    }

    const response = await fetch(`${BAGS_API_BASE}/token/fee-sharing`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        mintAddress,
        claimers: feeClaimers.map(c => ({
          wallet: c.walletAddress,
          bps: c.bps,
          label: c.label,
          ...(c.socialPlatform && { socialPlatform: c.socialPlatform, socialHandle: c.socialHandle }),
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Failed to configure fee sharing');
    }

    return { success: true };
  }

  /**
   * Step 3: Launch the token on Bags/Solana.
   * Creates the token with an optional initial buy.
   */
  async launchToken(params: TokenLaunchParams): Promise<TokenLaunchResult> {
    // Step 1: Create token metadata
    const tokenInfo = await this.createTokenInfo(params.metadata);

    // Step 2: Configure fee sharing if provided
    if (params.feeSharing && params.feeSharing.length > 0) {
      await this.configureFeeSharing(tokenInfo.mintAddress, params.feeSharing);
    }

    // Step 3: Launch/finalize
    const response = await fetch(`${BAGS_API_BASE}/token/launch`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        mintAddress: tokenInfo.mintAddress,
        initialBuyAmountSol: params.initialBuyAmountSol || 0,
        partnerKey: BAGS_PARTNER_KEY,
        refCode: BAGS_REF_CODE,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return { success: false, error: err.error || 'Token launch failed' };
    }

    const data = await response.json();
    return {
      success: true,
      mintAddress: tokenInfo.mintAddress,
      transactionId: data.response?.transactionId,
    };
  }

  /**
   * Get token analytics (fees, volume, holders).
   */
  async getTokenAnalytics(mintAddress: string): Promise<TokenAnalytics> {
    const response = await fetch(`${BAGS_API_BASE}/token/${mintAddress}/analytics`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch token analytics');
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Get claimable fees for a wallet.
   */
  async getClaimableFees(walletAddress: string): Promise<ClaimableFee[]> {
    const response = await fetch(`${BAGS_API_BASE}/fees/claimable/${walletAddress}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch claimable fees');
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Generate a claim transaction for earned fees.
   */
  async generateClaimTransaction(walletAddress: string, mintAddress: string): Promise<{ transaction: string }> {
    const response = await fetch(`${BAGS_API_BASE}/fees/claim`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ walletAddress, mintAddress }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate claim transaction');
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Get creator info for a token.
   */
  async getCreatorInfo(mintAddress: string): Promise<{ creator: string; totalFees: number }> {
    const response = await fetch(`${BAGS_API_BASE}/token/${mintAddress}/creator`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch creator info');
    }

    const data = await response.json();
    return data.response;
  }
}

/**
 * Default HIVE fee sharing configuration for tokens launched through the marketplace.
 * 1% of all trading volume is distributed:
 * - 40% → Hive Protocol treasury
 * - 30% → Top-performing agents (reputation-weighted)
 * - 20% → Task creators
 * - 10% → Community referrers
 */
export const HIVE_DEFAULT_FEE_SHARING: FeeShareConfig[] = [
  {
    walletAddress: process.env.NEXT_PUBLIC_HIVE_TREASURY_WALLET || '',
    bps: 4000,
    label: 'Hive Protocol Treasury',
  },
  {
    walletAddress: process.env.NEXT_PUBLIC_HIVE_AGENTS_WALLET || '',
    bps: 3000,
    label: 'Top Agents Pool',
  },
  {
    walletAddress: process.env.NEXT_PUBLIC_HIVE_CREATORS_WALLET || '',
    bps: 2000,
    label: 'Task Creators Pool',
  },
  {
    walletAddress: process.env.NEXT_PUBLIC_HIVE_REFERRALS_WALLET || '',
    bps: 1000,
    label: 'Community Referrals',
  },
];

/**
 * Partner tracking constants (exposed for API routes).
 */
export { BAGS_PARTNER_KEY, BAGS_REF_CODE };

/**
 * Create a singleton Bags client from environment variables.
 */
export function createBagsClient(): BagsClient | null {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    console.warn('[HIVE] Bags API key not configured - Bags integration disabled');
    return null;
  }
  return new BagsClient({ apiKey });
}

export type { TokenMetadata, FeeShareConfig, TokenLaunchParams, TokenLaunchResult, TokenAnalytics, ClaimableFee };
