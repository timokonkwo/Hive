import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { X402_TREASURY, PAYMENT_PROOF_VALIDITY, PAYMENT_CHAIN_ID } from './constants';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL || 'https://sepolia.base.org'),
});

export interface PaymentVerificationResult {
  valid: boolean;
  error?: string;
  amount?: string;
  from?: string;
  timestamp?: number;
}

/**
 * Verify that a payment transaction is valid for x402 access
 * 
 * @param txHash - The transaction hash provided as payment proof
 * @param requiredAmount - The minimum amount required (in ETH string)
 * @param payer - Optional: verify the payment came from a specific address
 */
export async function verifyPayment(
  txHash: string,
  requiredAmount: string,
  payer?: string
): Promise<PaymentVerificationResult> {
  try {
    // Fetch the transaction
    const tx = await publicClient.getTransaction({
      hash: txHash as `0x${string}`,
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    // Verify it's sent to the treasury
    if (tx.to?.toLowerCase() !== X402_TREASURY.toLowerCase()) {
      return { valid: false, error: 'Payment not sent to treasury' };
    }

    // Verify the amount
    const required = parseEther(requiredAmount);
    if (tx.value < required) {
      return { 
        valid: false, 
        error: `Insufficient payment. Required: ${requiredAmount} ETH, Got: ${formatEther(tx.value)} ETH` 
      };
    }

    // Verify the payer if specified
    if (payer && tx.from.toLowerCase() !== payer.toLowerCase()) {
      return { valid: false, error: 'Payment from wrong address' };
    }

    // Verify the transaction is confirmed
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt || receipt.status !== 'success') {
      return { valid: false, error: 'Transaction not confirmed or failed' };
    }

    // Verify the transaction is recent enough
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const txTimestamp = Number(block.timestamp);
    const now = Math.floor(Date.now() / 1000);
    
    if (now - txTimestamp > PAYMENT_PROOF_VALIDITY) {
      return { valid: false, error: 'Payment proof expired' };
    }

    return {
      valid: true,
      amount: formatEther(tx.value),
      from: tx.from,
      timestamp: txTimestamp,
    };
  } catch (error: any) {
    console.error('Payment verification failed:', error);
    return { valid: false, error: error.message || 'Verification failed' };
  }
}

/**
 * Generate x402 payment required response headers
 */
export function getPaymentRequiredHeaders(amount: string): Record<string, string> {
  return {
    'X-Payment-Required': `ETH:${amount}`,
    'X-Payment-Address': X402_TREASURY,
    'X-Payment-Chain': PAYMENT_CHAIN_ID.toString(),
  };
}
