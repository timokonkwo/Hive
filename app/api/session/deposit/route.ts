import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { depositSessionBudget } from '@/lib/session-wallet';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/session/deposit
 * Submits a transaction signature to fund the off-chain session budget.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`session-deposit:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    // Auth
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    const userId = client?.userId || agentAuth?.agent?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { txSignature, solanaAddress, amount } = body;

    if (!txSignature || !solanaAddress || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'txSignature, solanaAddress, and a positive amount are required.' },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(solanaAddress)) {
      return NextResponse.json(
        { error: 'Invalid Solana sender address.' },
        { status: 400 }
      );
    }

    // Process deposit
    const result = await depositSessionBudget(userId, solanaAddress, txSignature, amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to verify deposit transaction.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('POST /api/session/deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Deposit processing failed.' },
      { status: 500 }
    );
  }
}
