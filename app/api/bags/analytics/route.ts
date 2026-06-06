import { NextRequest, NextResponse } from 'next/server';
import { createBagsClient } from '@/lib/bags';
import { logger } from '@/lib/logger';

/**
 * GET /api/bags/analytics?mint=<mintAddress>
 * Fetch token analytics from Bags (fees, volume, holders, market cap).
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

    const mintAddress = req.nextUrl.searchParams.get('mint');
    if (!mintAddress) {
      return NextResponse.json(
        { error: 'mint query parameter is required.' },
        { status: 400 }
      );
    }

    const analytics = await bags.getTokenAnalytics(mintAddress);
    return NextResponse.json({ success: true, analytics });
  } catch (error: any) {
    logger.error('[BAGS] Analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
