/**
 * Bags Integration — powered by @bagsfm/bags-sdk
 *
 * Handles server-side token launches on Solana via the Bags platform.
 * The server signs and broadcasts transactions using a dedicated launch keypair.
 *
 * Env vars required:
 *   BAGS_API_KEY          — Bags developer API key (from dev.bags.fm)
 *   HIVE_LAUNCH_KEYPAIR   — Solana keypair (base58 secret or JSON byte array)
 *   SOLANA_RPC_URL         — (optional) Solana RPC endpoint, defaults to mainnet
 */

import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// ── Constants ──

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const BAGS_PARTNER_CONFIG_PDA = 'G5brHxe8WLXw8svg9Aon3CigpDfchVT8ukNJWqmH76uN';
const BAGS_CONFIG_TYPE = 'fa29606e-5e48-4c37-827f-4b03d58ee23d'; // 1% pre-migration, 0.25% post
const DEFAULT_RPC = 'https://flashy-proportionate-arm.solana-mainnet.quiknode.pro/7f10e26aece44e206a781dfd9c74360edac7181b/';

// ── Types (re-exported for route handlers) ──

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image?: string; // URL string
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface FeeShareConfig {
  walletAddress: string;
  bps: number;
  label?: string;
}

export interface TokenLaunchParams {
  metadata: TokenMetadata;
  feeSharing?: FeeShareConfig[];
  initialBuyAmountSol?: number;
}

export interface TokenLaunchResult {
  success: boolean;
  mintAddress?: string;
  transactionId?: string;
  error?: string;
}

// ── Keypair Parsing ──

/**
 * Parse a Solana keypair from an env var.
 * Supports two formats:
 *   1. Base58-encoded secret key string
 *   2. JSON byte array string: "[174,47,218,...]"
 */
function parseKeypair(raw: string): Keypair {
  const trimmed = raw.trim();

  // JSON byte array format
  if (trimmed.startsWith('[')) {
    const bytes = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }

  // Base58 format
  const decoded = bs58.decode(trimmed);
  return Keypair.fromSecretKey(decoded);
}

// ── Singleton SDK + Connection ──

let _sdk: BagsSDK | null = null;
let _connection: Connection | null = null;
let _launchKeypair: Keypair | null = null;

function getConnection(): Connection {
  if (!_connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
    _connection = new Connection(rpcUrl, 'confirmed');
  }
  return _connection;
}

function getLaunchKeypair(): Keypair | null {
  if (!_launchKeypair) {
    const raw = process.env.HIVE_LAUNCH_KEYPAIR;
    if (!raw) {
      console.warn('[BAGS] HIVE_LAUNCH_KEYPAIR not configured — token launch signing disabled');
      return null;
    }
    try {
      _launchKeypair = parseKeypair(raw);
      console.log(`[BAGS] Launch wallet: ${_launchKeypair.publicKey.toBase58()}`);
    } catch (err) {
      console.error('[BAGS] Failed to parse HIVE_LAUNCH_KEYPAIR:', err);
      return null;
    }
  }
  return _launchKeypair;
}

function getSDK(): BagsSDK | null {
  if (!_sdk) {
    const apiKey = process.env.BAGS_API_KEY;
    if (!apiKey) {
      console.warn('[BAGS] BAGS_API_KEY not configured — Bags integration disabled');
      return null;
    }
    _sdk = new BagsSDK(apiKey, getConnection(), 'confirmed');
  }
  return _sdk;
}

// ── Public API ──

/**
 * BagsClient wraps the official @bagsfm/bags-sdk with server-side signing.
 */
export class BagsClient {
  private sdk: BagsSDK;
  private keypair: Keypair;
  private connection: Connection;

  constructor() {
    const sdk = getSDK();
    if (!sdk) throw new Error('Bags SDK not configured (missing BAGS_API_KEY)');

    const keypair = getLaunchKeypair();
    if (!keypair) throw new Error('Launch keypair not configured (missing HIVE_LAUNCH_KEYPAIR)');

    this.sdk = sdk;
    this.keypair = keypair;
    this.connection = getConnection();
  }

  /**
   * Launch a token on Bags/Solana.
   *
   * Flow:
   *  1. Upload metadata to Bags (create-token-info)
   *  2. Create fee share config → get meteoraConfigKey + sign config txs
   *  3. Create launch transaction with meteoraConfigKey
   *  4. Sign + broadcast + confirm
   */
  async launchToken(params: TokenLaunchParams): Promise<TokenLaunchResult> {
    try {
      const apiKey = process.env.BAGS_API_KEY!;
      const wallet = this.keypair.publicKey.toBase58();

      // Step 1: Create token metadata on Bags
      console.log(`[BAGS] Creating token info: ${params.metadata.name} (${params.metadata.symbol})`);

      const imageUrl = params.metadata.image
        || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(params.metadata.name)}&size=256`;

      const tokenInfo = await this.sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: params.metadata.name,
        symbol: params.metadata.symbol,
        description: params.metadata.description,
        imageUrl,
        twitter: params.metadata.twitter,
        telegram: params.metadata.telegram,
        website: params.metadata.website,
      });

      console.log(`[BAGS] Token info created: mint=${tokenInfo.tokenMint}, metadata=${tokenInfo.tokenMetadata}`);

      const initialBuyLamports = Math.floor((params.initialBuyAmountSol || 0) * 1e9);

      // Step 2: Create fee share config with our partner config
      console.log('[BAGS] Creating fee share config...');
      const configRes = await fetch(`${BAGS_API_BASE}/fee-share/config`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer: wallet,
          baseMint: tokenInfo.tokenMint,
          claimersArray: [wallet],
          basisPointsArray: [10000],
          bagsConfigType: BAGS_CONFIG_TYPE,
          partner: wallet,
          partnerConfig: BAGS_PARTNER_CONFIG_PDA,
        }),
      });

      if (!configRes.ok) {
        const err = await configRes.json().catch(() => ({}));
        console.error('[BAGS] Fee share config failed:', configRes.status, err);
        return { success: false, error: err.response || 'Fee share config failed' };
      }

      const configData = await configRes.json();
      const meteoraConfigKey = configData.response?.meteoraConfigKey;
      if (!meteoraConfigKey) {
        return { success: false, error: 'No meteoraConfigKey in fee share config response' };
      }
      console.log(`[BAGS] meteoraConfigKey: ${meteoraConfigKey}`);

      // Sign and broadcast config txs if needed
      if (configData.response.needsCreation && configData.response.transactions?.length > 0) {
        for (const txData of configData.response.transactions) {
          const txStr = typeof txData === 'string' ? txData : txData.transaction;
          const txBytes = bs58.decode(txStr);
          const tx = VersionedTransaction.deserialize(txBytes);
          tx.sign([this.keypair]);
          const sig = await this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 });
          console.log(`[BAGS] Config tx: ${sig}`);
        }
        // Wait for config txs to confirm
        await new Promise(r => setTimeout(r, 5000));
      }

      // Step 3: Create launch transaction
      console.log(`[BAGS] Getting launch tx... configKey=${meteoraConfigKey}`);
      const launchRes = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipfs: tokenInfo.tokenMetadata,
          tokenMint: tokenInfo.tokenMint,
          wallet,
          initialBuyLamports,
          configKey: meteoraConfigKey,
        }),
      });

      if (!launchRes.ok) {
        const errData = await launchRes.json().catch(() => ({}));
        console.error('[BAGS] Launch tx failed:', launchRes.status, errData);
        return { success: false, error: errData.response || `Launch API returned ${launchRes.status}` };
      }

      const launchData = await launchRes.json();
      const launchTxBytes = bs58.decode(launchData.response);
      const launchTx = VersionedTransaction.deserialize(launchTxBytes);

      // Step 4: Sign + broadcast + confirm
      console.log('[BAGS] Signing and broadcasting...');
      launchTx.sign([this.keypair]);
      const txSignature = await this.connection.sendRawTransaction(launchTx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });

      console.log(`[BAGS] Confirming tx: ${txSignature}`);
      const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction({
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      console.log(`[BAGS] ✅ Token launched! Mint: ${tokenInfo.tokenMint}, Tx: ${txSignature}`);

      return {
        success: true,
        mintAddress: tokenInfo.tokenMint,
        transactionId: txSignature,
      };
    } catch (error: any) {
      console.error('[BAGS] Token launch failed:', error);
      return {
        success: false,
        error: error.message || 'Token launch failed',
      };
    }
  }

  /**
   * Get token analytics (lifetime fees, creators).
   */
  async getTokenAnalytics(mintAddress: string) {
    const mint = new PublicKey(mintAddress);
    const [totalFees, creators] = await Promise.all([
      this.sdk.state.getTokenLifetimeFees(mint),
      this.sdk.state.getTokenCreators(mint).catch(() => []),
    ]);
    return { mintAddress, totalFees, creators };
  }

  /**
   * Get claimable fee positions for a wallet.
   */
  async getClaimableFees(walletAddress: string) {
    const wallet = new PublicKey(walletAddress);
    return this.sdk.fee.getAllClaimablePositions(wallet);
  }

  /**
   * Generate claim transactions for a fee position.
   */
  async generateClaimTransaction(walletAddress: string, mintAddress: string) {
    const wallet = new PublicKey(walletAddress);
    const positions = await this.sdk.fee.getAllClaimablePositions(wallet);
    // Find position matching the requested mint
    const position = positions.find((p: any) => p.baseMint?.toBase58() === mintAddress);
    if (!position) {
      throw new Error('No claimable position found for this mint');
    }
    const txs = await this.sdk.fee.getClaimTransaction(wallet, position);
    return { transactions: txs.map(tx => Buffer.from(tx.serialize()).toString('base64')) };
  }
}

/**
 * Default Hive fee sharing configuration.
 * 1% of all trading volume is distributed among configured wallets.
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

// Legacy aliases for route handlers
const BAGS_PARTNER_KEY = BAGS_PARTNER_CONFIG_PDA;
const BAGS_REF_CODE = 'hive';
export { BAGS_PARTNER_KEY, BAGS_REF_CODE };

/**
 * Create a BagsClient instance. Returns null if not configured.
 */
export function createBagsClient(): BagsClient | null {
  try {
    return new BagsClient();
  } catch (err: any) {
    console.warn(`[BAGS] Client not available: ${err.message}`);
    return null;
  }
}
