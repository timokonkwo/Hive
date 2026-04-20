/**
 * Agent Token Launch — Bags Integration
 *
 * Dedicated Bags client for launching agent tokens during registration.
 * Uses a SEPARATE Bags account from Hive's main account so tokens
 * show as launched by the agent platform, not by Hive directly.
 *
 * Env vars required:
 *   BAGS_AGENT_API_KEY          — Bags API key for the agent launch account
 *   BAGS_AGENT_PARTNER_KEY      — Partner key from dev.bags.fm
 *   HIVE_AGENT_LAUNCH_KEYPAIR   — Solana keypair for signing agent token launches
 *   SOLANA_RPC_URL              — (optional) Solana RPC endpoint
 */

import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// ── Constants ──

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

/**
 * High Flat with Compounding — 10% pre-grad, 10% post-grad (50% compounds post-grad).
 * Maximizes revenue extraction on bonding curve tokens that likely won't graduate.
 * Fees are not visible to traders on the Bags bonding curve UI.
 */
const AGENT_CONFIG_TYPE = '48e26d2f-0a9d-4625-a3cc-c3987d874b9e';

/** Hardcoded image for all agent token launches */
const AGENT_TOKEN_IMAGE_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz'}/agent.png`;

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

/** Minimum wallet balance (SOL) to allow a launch */
const MIN_LAUNCH_BALANCE_SOL = 0.05;

/** Blocked token symbols — cannot be used for agent tokens */
const BLOCKED_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'HIVE', 'BONK', 'WIF', 'JUP',
  'RAY', 'ORCA', 'PYTH', 'JTO', 'RENDER', 'HNT', 'MOBILE', 'W',
  'TRUMP', 'MELANIA', 'PEPE', 'DOGE', 'SHIB', 'FLOKI',
]);

// ── Types ──

export interface AgentTokenLaunchParams {
  agentName: string;
  tokenSymbol: string;
  bio: string;
  website?: string;
}

export interface AgentTokenLaunchResult {
  success: boolean;
  mintAddress?: string;
  transactionId?: string;
  error?: string;
}

// ── Keypair Parsing (same logic as lib/bags.ts) ──

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

// ── Singletons (separate from main Bags client) ──

let _agentSdk: BagsSDK | null = null;
let _agentConnection: Connection | null = null;
let _agentKeypair: Keypair | null = null;

function getAgentConnection(): Connection {
  if (!_agentConnection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
    _agentConnection = new Connection(rpcUrl, 'confirmed');
  }
  return _agentConnection;
}

function getAgentKeypair(): Keypair | null {
  if (!_agentKeypair) {
    const raw = process.env.HIVE_AGENT_LAUNCH_KEYPAIR;
    if (!raw) {
      console.warn('[AGENT-BAGS] HIVE_AGENT_LAUNCH_KEYPAIR not configured');
      return null;
    }
    try {
      _agentKeypair = parseKeypair(raw);
      console.log(`[AGENT-BAGS] Agent launch wallet: ${_agentKeypair.publicKey.toBase58()}`);
    } catch (err) {
      console.error('[AGENT-BAGS] Failed to parse HIVE_AGENT_LAUNCH_KEYPAIR:', err);
      return null;
    }
  }
  return _agentKeypair;
}

function getAgentSDK(): BagsSDK | null {
  if (!_agentSdk) {
    const apiKey = process.env.BAGS_AGENT_API_KEY;
    if (!apiKey) {
      console.warn('[AGENT-BAGS] BAGS_AGENT_API_KEY not configured');
      return null;
    }
    _agentSdk = new BagsSDK(apiKey, getAgentConnection(), 'confirmed');
  }
  return _agentSdk;
}

// ── Public API ──

/**
 * AgentBagsClient handles server-side agent token launches.
 *
 * Separate from the main BagsClient — uses its own API key, keypair,
 * and partner config so agent tokens aren't attributed to Hive's profile.
 */
export class AgentBagsClient {
  private sdk: BagsSDK;
  private keypair: Keypair;
  private connection: Connection;
  private partnerKey: string;
  private apiKey: string;

  constructor() {
    const sdk = getAgentSDK();
    if (!sdk) throw new Error('Agent Bags SDK not configured (missing BAGS_AGENT_API_KEY)');

    const keypair = getAgentKeypair();
    if (!keypair) throw new Error('Agent launch keypair not configured (missing HIVE_AGENT_LAUNCH_KEYPAIR)');

    const partnerKey = process.env.BAGS_AGENT_PARTNER_KEY;
    if (!partnerKey) throw new Error('Agent partner key not configured (missing BAGS_AGENT_PARTNER_KEY)');

    const apiKey = process.env.BAGS_AGENT_API_KEY;
    if (!apiKey) throw new Error('Agent API key not configured (missing BAGS_AGENT_API_KEY)');

    this.sdk = sdk;
    this.keypair = keypair;
    this.connection = getAgentConnection();
    this.partnerKey = partnerKey;
    this.apiKey = apiKey;
  }

  /**
   * Get the SOL balance of the agent launch wallet.
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Check if the wallet has enough SOL to launch a token.
   */
  async canLaunch(): Promise<{ allowed: boolean; balance: number; reason?: string }> {
    const balance = await this.getBalance();
    if (balance < MIN_LAUNCH_BALANCE_SOL) {
      return {
        allowed: false,
        balance,
        reason: `Insufficient balance: ${balance.toFixed(4)} SOL (need >= ${MIN_LAUNCH_BALANCE_SOL} SOL)`,
      };
    }
    return { allowed: true, balance };
  }

  /**
   * Launch an agent token on Bags/Solana.
   *
   * Flow:
   *  1. Check wallet balance
   *  2. Upload metadata to Bags (name, symbol, bio + auto-appended note, agent.png)
   *  3. Create fee share config (100% to agent launch wallet, High Flat config type)
   *  4. Create launch transaction
   *  5. Sign + broadcast + confirm
   */
  async launchAgentToken(params: AgentTokenLaunchParams): Promise<AgentTokenLaunchResult> {
    const { agentName, tokenSymbol, bio, website } = params;

    try {
      // Pre-flight: check balance
      const balanceCheck = await this.canLaunch();
      if (!balanceCheck.allowed) {
        return { success: false, error: balanceCheck.reason };
      }

      const wallet = this.keypair.publicKey.toBase58();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://uphive.xyz';

      // Build token description with auto-appended agent note
      const tokenDescription = `${bio.trim()}\n\nThis token represents ${agentName}, an AI agent on Hive Protocol - ${siteUrl}/agent/${encodeURIComponent(agentName)}`;

      // Step 1: Create token metadata on Bags
      console.log(`[AGENT-BAGS] Creating token info: ${agentName} (${tokenSymbol})`);

      const tokenInfo = await this.sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: agentName,
        symbol: tokenSymbol,
        description: tokenDescription,
        imageUrl: AGENT_TOKEN_IMAGE_URL,
        website: website || `${siteUrl}/agent/${encodeURIComponent(agentName)}`,
      });

      console.log(`[AGENT-BAGS] Token info created: mint=${tokenInfo.tokenMint}, metadata=${tokenInfo.tokenMetadata}`);

      // Step 2: Create fee share config — 100% to agent launch wallet
      console.log('[AGENT-BAGS] Creating fee share config (High Flat, 10%)...');
      const configRes = await fetch(`${BAGS_API_BASE}/fee-share/config`, {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer: wallet,
          baseMint: tokenInfo.tokenMint,
          claimersArray: [wallet],
          basisPointsArray: [10000], // 100% to Hive agent launch wallet
          bagsConfigType: AGENT_CONFIG_TYPE,
          partner: wallet,
          partnerConfig: this.partnerKey,
        }),
      });

      if (!configRes.ok) {
        const err = await configRes.json().catch(() => ({}));
        console.error('[AGENT-BAGS] Fee share config failed:', configRes.status, err);
        return { success: false, error: (err as any).response || `Fee share config failed (${configRes.status})` };
      }

      const configData = await configRes.json();
      const meteoraConfigKey = configData.response?.meteoraConfigKey;
      if (!meteoraConfigKey) {
        return { success: false, error: 'No meteoraConfigKey in fee share config response' };
      }
      console.log(`[AGENT-BAGS] meteoraConfigKey: ${meteoraConfigKey}`);

      // Sign and broadcast config transactions if needed
      if (configData.response.needsCreation && configData.response.transactions?.length > 0) {
        for (const txData of configData.response.transactions) {
          const txStr = typeof txData === 'string' ? txData : txData.transaction;
          const txBytes = bs58.decode(txStr);
          const tx = VersionedTransaction.deserialize(txBytes);
          tx.sign([this.keypair]);
          const sig = await this.connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 5,
          });
          console.log(`[AGENT-BAGS] Config tx: ${sig}`);
        }
        // Wait for config txs to land
        await new Promise(r => setTimeout(r, 5000));
      }

      // Step 3: Create launch transaction
      console.log(`[AGENT-BAGS] Getting launch tx... configKey=${meteoraConfigKey}`);
      const launchRes = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipfs: tokenInfo.tokenMetadata,
          tokenMint: tokenInfo.tokenMint,
          wallet,
          initialBuyLamports: 0, // No initial buy for agent tokens
          configKey: meteoraConfigKey,
        }),
      });

      if (!launchRes.ok) {
        const errData = await launchRes.json().catch(() => ({}));
        console.error('[AGENT-BAGS] Launch tx failed:', launchRes.status, errData);
        return { success: false, error: (errData as any).response || `Launch API returned ${launchRes.status}` };
      }

      const launchData = await launchRes.json();
      const launchTxBytes = bs58.decode(launchData.response);
      const launchTx = VersionedTransaction.deserialize(launchTxBytes);

      // Step 4: Sign + broadcast + confirm
      console.log('[AGENT-BAGS] Signing and broadcasting...');
      launchTx.sign([this.keypair]);
      const txSignature = await this.connection.sendRawTransaction(launchTx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });

      console.log(`[AGENT-BAGS] Confirming tx: ${txSignature}`);
      const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction({
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      console.log(`[AGENT-BAGS] Token launched! Mint: ${tokenInfo.tokenMint}, Tx: ${txSignature}`);

      return {
        success: true,
        mintAddress: tokenInfo.tokenMint,
        transactionId: txSignature,
      };
    } catch (error: any) {
      console.error('[AGENT-BAGS] Agent token launch failed:', error);
      return {
        success: false,
        error: error.message || 'Agent token launch failed',
      };
    }
  }

  /**
   * Get the public key of the agent launch wallet.
   */
  getWalletAddress(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Get lifetime fees generated by a specific token.
   */
  async getTokenLifetimeFees(mintAddress: string): Promise<number> {
    try {
      const mint = new PublicKey(mintAddress);
      return await this.sdk.state.getTokenLifetimeFees(mint);
    } catch {
      return 0;
    }
  }

  /**
   * Get all claimable fee positions for the agent launch wallet.
   * Returns array of positions with baseMint and claimable amounts.
   */
  async getClaimablePositions(): Promise<any[]> {
    try {
      return await this.sdk.fee.getAllClaimablePositions(this.keypair.publicKey);
    } catch {
      return [];
    }
  }
}

// ── Validation Utilities ──

/**
 * Validate and normalize a token symbol for agent token launch.
 * Returns the normalized symbol or an error message.
 */
export function validateTokenSymbol(symbol: string): { valid: boolean; normalized?: string; error?: string } {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, error: 'Token symbol is required.' };
  }

  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (normalized.length < 2) {
    return { valid: false, error: 'Token symbol must be at least 2 characters.' };
  }

  if (normalized.length > 10) {
    return { valid: false, error: 'Token symbol must be 10 characters or less.' };
  }

  if (BLOCKED_SYMBOLS.has(normalized)) {
    return { valid: false, error: `Token symbol "${normalized}" is reserved and cannot be used.` };
  }

  return { valid: true, normalized };
}

/**
 * Auto-generate a token symbol from an agent name.
 * Takes first 3-5 alphanumeric characters and uppercases them.
 */
export function generateTokenSymbol(agentName: string): string {
  const cleaned = agentName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  // Take first 5 chars, minimum 2
  const symbol = cleaned.slice(0, 5);
  if (symbol.length < 2) return 'AGENT';
  // If the auto-generated symbol is blocked, append a suffix
  if (BLOCKED_SYMBOLS.has(symbol)) {
    return symbol.slice(0, 4) + 'X';
  }
  return symbol;
}

/**
 * Create an AgentBagsClient instance. Returns null if not configured.
 */
export function createAgentBagsClient(): AgentBagsClient | null {
  try {
    return new AgentBagsClient();
  } catch (err: any) {
    console.warn(`[AGENT-BAGS] Client not available: ${err.message}`);
    return null;
  }
}
