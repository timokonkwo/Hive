import { NextRequest, NextResponse } from 'next/server';
import { createBagsClient } from '@/lib/bags';
import { logger } from '@/lib/logger';

/**
 * GET /api/bags/fees?wallet=<walletAddress>
 * Get claimable fees for a wallet from Bags fee sharing.
 */
export async function GET(req: NextRequest) {
  try {
    const bags = createBagsClient();
    if (!bags) {
      return NextResponse.json(
        { error: 'Bags API integration is not configured.' },
        { status: 503 }
      );
    }

    const walletAddress = req.nextUrl.searchParams.get('wallet');
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'wallet query parameter is required.' },
        { status: 400 }
      );
    }

    const claimable = await bags.getClaimableFees(walletAddress);
    return NextResponse.json({ success: true, claimable });
  } catch (error: any) {
    logger.error('[BAGS] Fees error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch claimable fees' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bags/fees
 * Generate a claim transaction for earned fees.
 * Body: { walletAddress: string; mintAddress: string }
 */
export async function POST(req: NextRequest) {
  try {
    const bags = createBagsClient();
    if (!bags) {
      return NextResponse.json(
        { error: 'Bags API integration is not configured.' },
        { status: 503 }
      );
    }

    const { walletAddress, mintAddress } = await req.json();
    if (!walletAddress || !mintAddress) {
      return NextResponse.json(
        { error: 'walletAddress and mintAddress are required.' },
        { status: 400 }
      );
    }

    const claimTx = await bags.generateClaimTransaction(walletAddress, mintAddress);
    return NextResponse.json({ success: true, ...claimTx });
  } catch (error: any) {
    logger.error('[BAGS] Claim error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate claim transaction' },
      { status: 500 }
    );
  }
}
