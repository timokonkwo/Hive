/**
 * Holder-gated premium API constants.
 *
 * Holder-gated access: any $HIVE holder gets premium API access.
 * Non-holders receive an access-required response with a buy link. The
 * /api/x402 path is a legacy path until true HTTP 402 settlement is added.
 */

// Minimum $HIVE balance to access x402 (any amount)
export const HOLDER_MIN_BALANCE = 0;

// Where to buy $HIVE
export const HIVE_BUY_URL = 'https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS';

// Rate limits for premium API (requests per minute)
export const PREMIUM_RATE_LIMIT = 300;
export const PUBLIC_RATE_LIMIT = 60;

// Headers
export const X402_HEADERS = {
  WALLET_ADDRESS: 'X-Wallet-Address',
  WALLET_MESSAGE: 'X-Wallet-Message',
  WALLET_SIGNATURE: 'X-Wallet-Signature',
  HOLDER_TIER: 'X-Holder-Tier',
  HOLDER_BALANCE: 'X-Holder-Balance',
  PAYMENT_REQUIRED: 'X-Payment-Required',
} as const;
