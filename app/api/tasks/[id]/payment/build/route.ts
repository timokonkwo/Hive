import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { buildUsdcTransferTransaction, getUsdcBalance, isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/[id]/payment/build
 *
 * Builds an unsigned USDC transfer transaction for the client to sign.
 * Returns the serialized transaction for the frontend to present to the wallet.
 *
 * Body: { clientAddress, clientSolanaAddress }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`build-payment:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;
    const body = await req.json();
    const { clientAddress, clientSolanaAddress } = body;

    if (!clientAddress) {
      return NextResponse.json({ error: 'clientAddress is required.' }, { status: 400 });
    }
    if (!clientSolanaAddress || !isValidSolanaAddress(clientSolanaAddress)) {
      return NextResponse.json({ error: 'A valid Solana wallet address is required.' }, { status: 400 });
    }

    // Get task
    let task;
    try {
      task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    } catch {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // Only task poster can build payment
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Only the task poster can initiate payment.' }, { status: 403 });
    }

    if (task.status !== 'In Review') {
      return NextResponse.json({ error: 'Task must be in "In Review" status to pay.' }, { status: 400 });
    }

    const budgetAmount = task.budgetAmount || 0;
    if (budgetAmount <= 0) {
      return NextResponse.json({ error: 'Task has no budget amount set.' }, { status: 400 });
    }

    // Find accepted bid and agent
    const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: { $in: ['accepted', 'WorkSubmitted'] },
    });

    if (!acceptedBid) {
      return NextResponse.json({ error: 'No accepted bid found.' }, { status: 400 });
    }

    // Get agent's Solana address
    let agent = null;
    if (acceptedBid.agentId && ObjectId.isValid(acceptedBid.agentId)) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(acceptedBid.agentId) });
    }
    if (!agent && acceptedBid.agentName) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ name: acceptedBid.agentName });
    }

    if (!agent?.solanaAddress) {
      return NextResponse.json({
        error: 'The assigned agent has not set a Solana wallet for receiving payments. Please contact the agent.',
      }, { status: 400 });
    }

    // Check client has sufficient USDC balance
    const clientBalance = await getUsdcBalance(clientSolanaAddress);
    if (clientBalance < budgetAmount) {
      return NextResponse.json({
        error: `Insufficient USDC balance. You have ${clientBalance.toFixed(2)} USDC but the task requires ${budgetAmount} USDC.`,
        balance: clientBalance,
        required: budgetAmount,
      }, { status: 400 });
    }

    // Build the unsigned transaction
    const { transaction, blockhash } = await buildUsdcTransferTransaction(
      clientSolanaAddress,
      agent.solanaAddress,
      budgetAmount
    );

    return NextResponse.json({
      transaction,
      blockhash,
      paymentDetails: {
        amount: budgetAmount,
        token: 'USDC',
        chain: 'solana',
        fromAddress: clientSolanaAddress,
        toAddress: agent.solanaAddress,
        toName: agent.name || 'Agent',
      },
    });
  } catch (error: any) {
    console.error('[HIVE] Build payment error:', error);
    return NextResponse.json({ error: 'Failed to build payment transaction.' }, { status: 500 });
  }
}
