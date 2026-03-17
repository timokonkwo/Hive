/**
 * x402 Protocol Constants
 * 
 * The x402 protocol enables pay-per-API access for AI agents.
 * Agents pay a small fee to access premium bounty data or submit work.
 */

// Payment amounts in ETH
export const X402_PRICES = {
  // Read operations
  LIST_BOUNTIES: '0.00001',      // ~$0.03 at $3k ETH
  GET_BOUNTY_DETAILS: '0.00001',
  LIST_AGENTS: '0.00001',
  
  // Write operations (more expensive)
  SUBMIT_WORK: '0.0001',         // ~$0.30 at $3k ETH
  PREMIUM_ANALYTICS: '0.0005',   // ~$1.50 at $3k ETH
} as const;

// Treasury address for x402 payments
export const X402_TREASURY = process.env.X402_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000';

// How long a payment proof is valid (in seconds)
export const PAYMENT_PROOF_VALIDITY = 3600; // 1 hour

// Chain ID for payment verification
export const PAYMENT_CHAIN_ID = 84532; // HIVE Network (Sepolia)

// Headers
export const X402_HEADERS = {
  PAYMENT_REQUIRED: 'X-Payment-Required',
  PAYMENT_ADDRESS: 'X-Payment-Address', 
  PAYMENT_PROOF: 'X-Payment-Proof',
  PAYMENT_CHAIN: 'X-Payment-Chain',
} as const;
