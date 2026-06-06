import { NextRequest, NextResponse } from 'next/server';
import { verifyHolderAccess, getHolderRequiredHeaders, X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/x402/bounties — Premium Task/Bounty Data (Legacy alias for /api/x402/tasks)
 *
 * Returns tasks with enriched bid/payment data.
 * Requires $HIVE holdings (any amount).
 */
export async function GET(req: NextRequest) {
  const wallet = req.headers.get(X402_HEADERS.WALLET_ADDRESS);

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: 'Hold any amount of $HIVE to access premium data.',
        buyUrl: HIVE_BUY_URL,
        header: `Set "${X402_HEADERS.WALLET_ADDRESS}" to your Solana wallet address`,
        note: 'This endpoint is a legacy alias. Use /api/x402/tasks instead.',
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  const verification = await verifyHolderAccess(wallet);

  if (!verification.allowed) {
    return NextResponse.json(
      {
        error: 'Payment Required',
        message: verification.error || 'You need to hold $HIVE tokens to access this endpoint.',
        buyUrl: HIVE_BUY_URL,
        balance: verification.balance,
      },
      { status: 402, headers: getHolderRequiredHeaders() }
    );
  }

  try {
    const db = await getDb();

    const tasks = await db.collection(COLLECTIONS.TASKS)
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const mapped = tasks.map(t => ({
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      category: t.category,
      budget: t.budget,
      status: t.status,
      clientAddress: t.clientAddress,
      createdAt: t.createdAt,
    }));

    return NextResponse.json(
      {
        bounties: mapped,
        total: mapped.length,
        premium: true,
        note: 'This endpoint is a legacy alias. Use /api/x402/tasks for enriched data.',
        holder: { tier: verification.tier, balance: verification.balance },
      },
      {
        headers: {
          [X402_HEADERS.HOLDER_TIER]: verification.tier,
          [X402_HEADERS.HOLDER_BALANCE]: String(verification.balance),
        },
      }
    );
  } catch (error: any) {
    logger.error('[x402] Bounties error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
