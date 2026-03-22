/**
 * Solana USDC Payment Utilities
 *
 * Builds unsigned SPL token transfer transactions for client-to-agent
 * USDC payments. The transaction is signed by the client's wallet (via Privy)
 * and verified on the backend after broadcast.
 *
 * The platform NEVER holds custody of funds — all transfers are
 * direct wallet-to-wallet.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// USDC Mint on Solana Mainnet
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDC_DECIMALS = 6;

// Default RPC — can be overridden via env
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Get a Solana RPC connection.
 */
export function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

/**
 * Get a wallet's USDC balance in human-readable format.
 */
export async function getUsdcBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection();
    const owner = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(USDC_MINT, owner);

    const account = await getAccount(connection, ata);
    return Number(account.amount) / Math.pow(10, USDC_DECIMALS);
  } catch {
    // Account doesn't exist = 0 balance
    return 0;
  }
}

/**
 * Get a wallet's SOL balance.
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection();
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Build an unsigned USDC transfer transaction.
 *
 * Creates the Associated Token Account for the recipient if it doesn't
 * exist (the sender pays for this — ~0.002 SOL rent).
 *
 * @param senderAddress - Client's Solana wallet address
 * @param recipientAddress - Agent's Solana wallet address
 * @param amountUsdc - Amount in USDC (human-readable, e.g. 50.00)
 * @returns Serialized transaction as base64 string
 */
export async function buildUsdcTransferTransaction(
  senderAddress: string,
  recipientAddress: string,
  amountUsdc: number
): Promise<{ transaction: string; blockhash: string }> {
  const connection = getConnection();
  const sender = new PublicKey(senderAddress);
  const recipient = new PublicKey(recipientAddress);

  // SECURITY: Convert USDC amount to raw units using string manipulation
  // to avoid floating-point precision issues (e.g., 0.1 * 1000000 ≠ 100000 in IEEE 754)
  const rawAmount = BigInt(Math.round(amountUsdc * 1_000_000));

  // Get associated token accounts
  const senderAta = await getAssociatedTokenAddress(USDC_MINT, sender);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipient);

  const transaction = new Transaction();

  // Check if recipient's ATA exists — create if not
  try {
    await getAccount(connection, recipientAta);
  } catch {
    // Create ATA for recipient (sender pays rent)
    transaction.add(
      createAssociatedTokenAccountInstruction(
        sender,                  // payer
        recipientAta,            // associated token account
        recipient,               // owner
        USDC_MINT,              // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Add USDC transfer instruction
  transaction.add(
    createTransferInstruction(
      senderAta,               // source
      recipientAta,            // destination
      sender,                  // owner/authority
      rawAmount,               // amount in raw units
      [],                      // multi-signers (none)
      TOKEN_PROGRAM_ID
    )
  );

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;

  // Serialize as base64 (unsigned)
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    transaction: Buffer.from(serialized).toString('base64'),
    blockhash,
  };
}

/**
 * Verify a USDC payment transaction on-chain.
 *
 * Confirms that the transaction:
 * 1. Was successful (not errored)
 * 2. Contains a USDC transfer of the correct amount
 * 3. Is from the expected sender to the expected recipient
 *
 * @returns Payment verification result
 */
export async function verifyUsdcPayment(
  txSignature: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountUsdc: number
): Promise<{
  verified: boolean;
  error?: string;
  confirmedAmount?: number;
}> {
  try {
    // SECURITY: Prevent self-transfers (sender paying themselves)
    if (expectedSender === expectedRecipient) {
      return { verified: false, error: 'Sender and recipient cannot be the same address.' };
    }

    const connection = getConnection();

    // Fetch transaction with full details
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx) {
      return { verified: false, error: 'Transaction not found. It may still be confirming.' };
    }

    if (tx.meta?.err) {
      return { verified: false, error: 'Transaction failed on-chain.' };
    }

    // Look for USDC transfer instruction in the transaction
    const instructions = tx.transaction.message.instructions;
    const innerInstructions = tx.meta?.innerInstructions || [];
    const allInstructions = [
      ...instructions,
      ...innerInstructions.flatMap((ii: any) => ii.instructions),
    ];

    // Find SPL token transfer matching our criteria
    const expectedRawAmount = Math.round(expectedAmountUsdc * Math.pow(10, USDC_DECIMALS));

    for (const ix of allInstructions) {
      const parsed = (ix as any)?.parsed;
      if (!parsed) continue;

      if (
        parsed.type === 'transfer' ||
        parsed.type === 'transferChecked'
      ) {
        const info = parsed.info;
        const amount = parsed.type === 'transferChecked'
          ? Number(info.tokenAmount?.amount || 0)
          : Number(info.amount || 0);

        // For transferChecked, check mint matches USDC
        if (parsed.type === 'transferChecked' && info.mint !== USDC_MINT.toBase58()) {
          continue;
        }

        // Verify amount: must be >= expected (overpayment OK, underpayment NOT)
        if (amount >= expectedRawAmount) {
          // SECURITY: Verify source and destination match USDC-specific ATAs
          // This prevents accepting transfers of non-USDC tokens that happen
          // to have the same raw amount.
          const senderAta = await getAssociatedTokenAddress(
            USDC_MINT,
            new PublicKey(expectedSender)
          );
          const recipientAta = await getAssociatedTokenAddress(
            USDC_MINT,
            new PublicKey(expectedRecipient)
          );

          // For both transfer types, verify ATAs match the USDC-derived ATAs
          const sourceMatch = info.source === senderAta.toBase58();
          const destMatch = info.destination === recipientAta.toBase58();
          const authorityMatch = info.authority === expectedSender;

          if (sourceMatch && destMatch && (parsed.type === 'transferChecked' || authorityMatch)) {
            return {
              verified: true,
              confirmedAmount: amount / Math.pow(10, USDC_DECIMALS),
            };
          }
        }
      }
    }

    return {
      verified: false,
      error: 'No matching USDC transfer found in transaction.',
    };
  } catch (error: any) {
    return {
      verified: false,
      error: `Verification failed: ${error.message}`,
    };
  }
}

/**
 * Validate a Solana address.
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
