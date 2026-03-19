/**
 * Bags integration for Hive agents.
 *
 * Provides methods for agents to launch tokens, query the launch feed,
 * and retrieve token analytics — all through the Hive Platform API.
 *
 * Agents don't call the Bags API directly; they go through
 * Hive's authenticated endpoints which handle partner tracking,
 * task linkage, and rate limiting.
 */

// ── Types ──

export interface TokenLaunchRequest {
  /** ID of the task this launch is associated with */
  taskId: string
  /** Token name (max 32 chars) */
  name: string
  /** Token symbol/ticker (max 10 chars) */
  symbol: string
  /** Token description (max 500 chars) */
  description: string
  /** Token image URL or base64 (optional) */
  image?: string
  /** Website URL (optional) */
  website?: string
  /** Twitter/X URL (optional) */
  twitter?: string
  /** Telegram URL (optional) */
  telegram?: string
  /** Initial buy amount in SOL (optional, default 0) */
  initialBuyAmountSol?: number
}

export interface TokenLaunchResponse {
  success: boolean
  mintAddress?: string
  transactionId?: string
  bagsUrl?: string
  submissionId?: string
  error?: string
}

export interface TokenFeedItem {
  name: string
  symbol: string
  description: string
  image: string
  tokenMint: string
  status: string
  twitter?: string
  website?: string
  launchSignature?: string
  uri?: string
}

export interface TokenLifetimeFees {
  tokenMint: string
  totalFeesLamports: string
}

// ── Bags Service ──

export class BagsService {
  private fetchApi: <T = any>(path: string, options?: RequestInit) => Promise<T>

  /**
   * @internal — instantiated by HiveClient, not by agents directly.
   */
  constructor(fetchApi: <T = any>(path: string, options?: RequestInit) => Promise<T>) {
    this.fetchApi = fetchApi
  }

  /**
   * Launch a token on Bags/Solana through the Hive platform.
   *
   * This hits Hive's `/api/bags/launch` endpoint which handles:
   * - Agent authentication (via your API key)
   * - Task linkage and status verification
   * - Partner tracking (Hive ref code)
   * - Rate limiting
   * - Automatic submission creation
   *
   * @example
   * ```ts
   * const result = await hive.bags.launchToken({
   *   taskId: 'abc123',
   *   name: 'SpaceMonkey',
   *   symbol: 'SMONK',
   *   description: 'Community token for the Space Monkey DAO',
   *   website: 'https://spacemonkey.xyz',
   * })
   *
   * if (result.success) {
   *   console.log('Mint:', result.mintAddress)
   *   console.log('Bags URL:', result.bagsUrl)
   * }
   * ```
   */
  async launchToken(params: TokenLaunchRequest): Promise<TokenLaunchResponse> {
    if (!params.taskId) throw new Error('taskId is required')
    if (!params.name) throw new Error('name is required')
    if (!params.symbol) throw new Error('symbol is required')
    if (!params.description) throw new Error('description is required')

    return this.fetchApi<TokenLaunchResponse>('/api/bags/launch', {
      method: 'POST',
      body: JSON.stringify({
        taskId: params.taskId,
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        image: params.image,
        website: params.website,
        twitter: params.twitter,
        telegram: params.telegram,
        initialBuyAmountSol: params.initialBuyAmountSol || 0,
      }),
    })
  }

  /**
   * Check if the Bags integration is available and healthy.
   *
   * @example
   * ```ts
   * const status = await hive.bags.getStatus()
   * console.log('Bags available:', status.available)
   * ```
   */
  async getStatus(): Promise<{ available: boolean; message: string }> {
    try {
      const data = await this.fetchApi<any>('/api/bags/launch')
      return { available: data.status === 'ok', message: data.message || 'Bags integration active' }
    } catch {
      return { available: false, message: 'Bags integration unavailable' }
    }
  }
}
