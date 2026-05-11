import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { Connection } from '@solana/web3.js';
import { authenticateClient } from '@/lib/client-auth';
import { verifiedClientOwnsResource } from '@/lib/client-ownership';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * POST /api/tasks/[id]/payment/send
 *
 * Accepts a signed transaction from the client, sends it to Solana,
 * and returns the tx signature. This runs server-side so the RPC URL
 * is always available (avoids client-side 403 from public RPC nodes).
 *
 * Body: { signedTransaction: string (base64), clientAddress: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`send-payment:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id: taskId } = await params;
    const verified = await authenticateClient(req);
    if (!verified) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { signedTransaction, clientAddress } = body;

    if (!signedTransaction || typeof signedTransaction !== 'string') {
      return NextResponse.json({ error: 'signedTransaction is required.' }, { status: 400 });
    }
    if (signedTransaction.length > 20000 || !/^[A-Za-z0-9+/=]+$/.test(signedTransaction)) {
      return NextResponse.json({ error: 'Invalid signedTransaction format.' }, { status: 400 });
    }

    // Verify task exists and caller is the poster
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }
    const db = await getDb();
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
    if (!verifiedClientOwnsResource(verified, task, clientAddress)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }
    if (task.status !== 'In Review') {
      return NextResponse.json({ error: 'Task is not in review.' }, { status: 400 });
    }

    // Send the signed transaction to Solana via server-side RPC
    const connection = new Connection(RPC_URL, 'confirmed');
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const txSignature = await connection.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction(txSignature, 'confirmed');

    return NextResponse.json({
      success: true,
      txSignature,
    });
  } catch (error: any) {
    console.error('[HIVE] Send payment error:', error);

    // Provide actionable error for wallet issues
    const msg = error.message || '';
    if (msg.includes('insufficient funds') || msg.includes('Insufficient')) {
      return NextResponse.json({ error: 'Insufficient USDC balance.' }, { status: 400 });
    }
    if (msg.includes('blockhash')) {
      return NextResponse.json({ error: 'Transaction expired. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to send transaction.' }, { status: 500 });
  }
}
