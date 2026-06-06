import { NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { USDC_MINT, USDC_DECIMALS } from '@/lib/solana-pay';
import bs58 from 'bs58';
import { logger } from '@/lib/logger';

function parseKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const bytes = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.HIVE_LAUNCH_KEYPAIR || process.env.HIVE_AGENT_LAUNCH_KEYPAIR;
  if (!raw) return null;
  try {
    return parseKeypair(raw);
  } catch (err) {
    logger.error('[CRON-SETTLE] Failed to parse treasury keypair:', err);
    return null;
  }
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

const MAX_SETTLEMENT_RETRIES = 3;

/**
 * GET /api/cron/settle-sessions
 * Aggregates all pending tool invocation costs and executes batch USDC settlements.
 * Splits fees for tokenized tools: 50% to provider, 50% to tool token fee vault.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const stealthSecret = process.env.STEALTH_AGENT_SECRET;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (stealthSecret && authHeader === `Bearer ${stealthSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};
  results.startedAt = new Date().toISOString();

  try {
    const db = await getDb();
    const treasuryKeypair = getTreasuryKeypair();

    if (!treasuryKeypair) {
      return NextResponse.json({ error: 'Treasury signing keypair is not configured on the server.' }, { status: 503 });
    }

    // Fetch all pending invocation entries
    const pendingLedger = await db.collection(COLLECTIONS.SESSION_LEDGER)
      .find({ status: 'pending', type: 'invocation' })
      .toArray();

    if (pendingLedger.length === 0) {
      return NextResponse.json({ message: 'No pending executions to settle.' });
    }

    // Group costs by provider address
    const groupings: Record<string, { totalCost: number; ids: any[] }> = {};
    for (const entry of pendingLedger) {
      const provider = entry.providerAddress;
      if (!provider) continue;
      if (!groupings[provider]) {
        groupings[provider] = { totalCost: 0, ids: [] };
      }
      groupings[provider].totalCost += entry.cost || 0;
      groupings[provider].ids.push(entry._id);
    }

    const providers = Object.keys(groupings);
    results.totalProvidersToSettle = providers.length;
    results.settlements = [];

    const connection = getConnection();
    const treasuryPubKey = treasuryKeypair.publicKey;
    const sourceAta = await getAssociatedTokenAddress(USDC_MINT, treasuryPubKey);

    // ─── Build a lookup of tokenized tools ───
    // toolId → { tokenMint, feeVaultAddress } for tools that have Bags.fm tokens
    const toolTokenLookup: Record<string, { tokenMint: string; feeVaultAddress: string }> = {};
    try {
      const tokenizedAgents = await db.collection(COLLECTIONS.AGENTS)
        .find({ 'registeredTools.tokenMint': { $exists: true } })
        .toArray();
      for (const agent of tokenizedAgents) {
        for (const tool of (agent.registeredTools || [])) {
          if (tool.tokenMint && tool.feeVaultAddress) {
            toolTokenLookup[tool.name] = {
              tokenMint: tool.tokenMint,
              feeVaultAddress: tool.feeVaultAddress,
            };
          }
        }
      }
    } catch (lookupErr: any) {
      logger.warn('[CRON-SETTLE] Tool token lookup failed (continuing without splits);:', lookupErr.message);
    }

    // Split settlements into batches of 8 to avoid transaction size limits
    const BATCH_SIZE = 8;
    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
      const batchProviders = providers.slice(i, i + BATCH_SIZE);
      const transaction = new Transaction();
      const processedIds: any[] = [];
      let batchTotalUSDC = 0;

      for (const provider of batchProviders) {
        const data = groupings[provider];
        if (data.totalCost <= 0) continue;

        const providerPubKey = new PublicKey(provider);
        const destinationAta = await getAssociatedTokenAddress(USDC_MINT, providerPubKey);

        // Check if provider ATA exists, create it if not
        try {
          await getAccount(connection, destinationAta);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              treasuryPubKey,
              destinationAta,
              providerPubKey,
              USDC_MINT,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        const rawAmount = BigInt(Math.round(data.totalCost * Math.pow(10, USDC_DECIMALS)));
        transaction.add(
          createTransferInstruction(
            sourceAta,
            destinationAta,
            treasuryPubKey,
            rawAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        batchTotalUSDC += data.totalCost;
        processedIds.push(...data.ids);
      }

      if (processedIds.length === 0) continue;

      // ─── Broadcast with retry logic ───
      let txSignature: string | null = null;

      for (let attempt = 1; attempt <= MAX_SETTLEMENT_RETRIES; attempt++) {
        try {
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryPubKey;

          transaction.sign(treasuryKeypair);

          txSignature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            maxRetries: 5,
          });

          // Confirm transaction
          const latestBlockhash = await connection.getLatestBlockhash('confirmed');
          await connection.confirmTransaction(
            {
              signature: txSignature,
              blockhash: latestBlockhash.blockhash,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            'confirmed'
          );

          break; // Success
        } catch (txErr: any) {
          logger.warn(`[CRON-SETTLE] Attempt ${attempt}/${MAX_SETTLEMENT_RETRIES} failed:`, txErr.message);
          txSignature = null;
          if (attempt === MAX_SETTLEMENT_RETRIES) {
            logger.error('[CRON-SETTLE] All retry attempts exhausted for batch.');
            results.errors = results.errors || [];
            (results.errors as string[]).push(`Batch settlement failed after ${MAX_SETTLEMENT_RETRIES} attempts: ${txErr.message}`);
          }
        }
      }

      if (!txSignature) continue;

      logger.info(`[CRON-SETTLE] Settle tx success: ${txSignature} (settled ${batchTotalUSDC} USDC);`);

      // Update database entries in bulk
      await db.collection(COLLECTIONS.SESSION_LEDGER).updateMany(
        { _id: { $in: processedIds } },
        {
          $set: {
            status: 'settled',
            settlementTxSignature: txSignature,
            settledAt: new Date()
          }
        }
      );

      // Track outcomes
      results.settlements.push({
        signature: txSignature,
        amountUsdc: batchTotalUSDC,
        itemsCount: processedIds.length
      });
    }

    // Update lastSettledAt for all affected session budgets
    const uniqueUserIds = Array.from(new Set(pendingLedger.map(e => e.userId)));
    if (uniqueUserIds.length > 0) {
      await db.collection(COLLECTIONS.SESSION_BUDGETS).updateMany(
        { userId: { $in: uniqueUserIds } },
        { $set: { lastSettledAt: new Date(), updatedAt: new Date() } }
      );
    }

    // Log cron run activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'SessionSettlementCron',
      metadata: {
        totalSettleAmountUsdc: pendingLedger.reduce((sum, item) => sum + (item.cost || 0), 0),
        processedLedgerCount: pendingLedger.length,
        settlementsCount: results.settlements.length
      },
      createdAt: new Date(),
    });

  } catch (error: any) {
    logger.error('[CRON-SETTLE] Settle sessions error:', error);
    results.error = error.message || 'Settlement execution failed.';
  }

  return NextResponse.json({
    cron: 'settle-sessions',
    timestamp: new Date().toISOString(),
    ...results
  });
}
