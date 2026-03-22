import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyUsdcPayment } from '@/lib/solana-pay';

// Solana tx signatures are 87-88 characters, base58 encoded
const TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * POST /api/tasks/[id]/complete
 * Client approves submitted work, pays the agent via on-chain USDC transfer,
 * and marks the task as Completed.
 *
 * For tasks with a budget > 0, a Solana USDC payment transaction signature
 * is required. The backend verifies the on-chain transfer before marking complete.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`complete-task:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;

    // SECURITY: Validate taskId format before using in ObjectId
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const body = await req.json();
    const { clientAddress, txSignature, satisfaction, comment, tags } = body;

    if (!clientAddress || typeof clientAddress !== 'string') {
      return NextResponse.json({ error: 'clientAddress is required.' }, { status: 400 });
    }

    // SECURITY: Validate clientAddress format
    // Accepts EVM addresses (0x...) and Privy user IDs (did:privy:... for email/Google users)
    if (!/^(0x[a-fA-F0-9]{10,}|did:privy:[a-zA-Z0-9]+)$/.test(clientAddress)) {
      return NextResponse.json({ error: 'Invalid client address format.' }, { status: 400 });
    }

    // Verify task exists
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // Only the task poster can complete the task
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Only the task poster can complete this task.' }, { status: 403 });
    }

    // Task must be in "In Review" status
    if (task.status !== 'In Review') {
      return NextResponse.json(
        { error: 'Task must be in "In Review" status to be completed.' },
        { status: 400 }
      );
    }

    const now = new Date();
    let paymentVerified = false;
    let paymentDetails: Record<string, any> = {};

    // If task has a budget amount, verify on-chain payment
    const budgetAmount = task.budgetAmount || 0;

    if (budgetAmount > 0) {
      if (!txSignature || typeof txSignature !== 'string') {
        return NextResponse.json(
          { error: 'Payment transaction signature is required for tasks with a budget.' },
          { status: 400 }
        );
      }

      // SECURITY: Validate tx signature format (base58, ~88 chars)
      if (!TX_SIGNATURE_REGEX.test(txSignature)) {
        return NextResponse.json(
          { error: 'Invalid transaction signature format.' },
          { status: 400 }
        );
      }

      // SECURITY: Atomic replay prevention using unique index
      // Insert the tx signature FIRST. If duplicate key error, it's a replay.
      // This prevents TOCTOU race conditions (findOne → insertOne gap).
      try {
        await db.collection('payment_signatures').createIndex(
          { txSignature: 1 },
          { unique: true, background: true }
        );
      } catch {
        // Index already exists — fine
      }

      try {
        await db.collection('payment_signatures').insertOne({
          txSignature,
          taskId,
          clientAddress: clientAddress.toLowerCase(),
          status: 'pending',
          createdAt: now,
        });
      } catch (insertError: any) {
        if (insertError?.code === 11000) {
          return NextResponse.json(
            { error: 'This transaction has already been used for a payment.' },
            { status: 400 }
          );
        }
        throw insertError;
      }

      // Find the assigned agent
      const acceptedBid = await db.collection(COLLECTIONS.BIDS).findOne({
        taskId,
        status: { $in: ['accepted', 'WorkSubmitted'] },
      });

      if (!acceptedBid) {
        await db.collection('payment_signatures').deleteOne({ txSignature, status: 'pending' });
        return NextResponse.json({ error: 'No accepted bid found for this task.' }, { status: 400 });
      }

      // Get agent's Solana address
      let agent = null;
      if (acceptedBid.agentId && ObjectId.isValid(acceptedBid.agentId)) {
        agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(acceptedBid.agentId) });
      }
      if (!agent && acceptedBid.agentName) {
        agent = await db.collection(COLLECTIONS.AGENTS).findOne({ name: acceptedBid.agentName });
      }
      if (!agent && acceptedBid.agentAddress) {
        agent = await db.collection(COLLECTIONS.AGENTS).findOne({ walletAddress: acceptedBid.agentAddress });
      }

      const agentSolanaAddress = agent?.solanaAddress;

      if (!agentSolanaAddress) {
        await db.collection('payment_signatures').deleteOne({ txSignature, status: 'pending' });
        return NextResponse.json(
          { error: 'The assigned agent has not set a Solana wallet address for receiving payments.' },
          { status: 400 }
        );
      }

      // Get client's Solana address — exact match first, then case-insensitive fallback
      const client = await db.collection(COLLECTIONS.CLIENTS).findOne({
        address: clientAddress,
      }) || await db.collection(COLLECTIONS.CLIENTS).findOne({
        address: { $regex: new RegExp(`^${clientAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });

      const clientSolanaAddress = client?.solanaAddress;

      if (!clientSolanaAddress) {
        await db.collection('payment_signatures').deleteOne({ txSignature, status: 'pending' });
        return NextResponse.json(
          { error: 'You need to link a Solana wallet address in your dashboard before making payments.' },
          { status: 400 }
        );
      }

      // Verify the on-chain payment
      const verification = await verifyUsdcPayment(
        txSignature,
        clientSolanaAddress,
        agentSolanaAddress,
        budgetAmount
      );

      if (!verification.verified) {
        // Clean up pending signature on failure
        await db.collection('payment_signatures').deleteOne({ txSignature, status: 'pending' });
        return NextResponse.json(
          { error: `Payment verification failed: ${verification.error}` },
          { status: 400 }
        );
      }

      // Mark signature as verified
      await db.collection('payment_signatures').updateOne(
        { txSignature },
        {
          $set: {
            status: 'verified',
            agentAddress: agentSolanaAddress,
            amount: verification.confirmedAmount || budgetAmount,
            verifiedAt: now,
          },
        }
      );

      paymentVerified = true;
      paymentDetails = {
        paidAmount: verification.confirmedAmount || budgetAmount,
        paidAt: now,
        paymentTxSignature: txSignature,
        paymentChain: 'solana',
        paymentToken: 'USDC',
        payerAddress: clientSolanaAddress,
        payeeAddress: agentSolanaAddress,
      };
    }

    // SECURITY: Atomic status update — only complete if still "In Review"
    // Prevents double-completion race condition
    const updateResult = await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(taskId), status: 'In Review' },
      {
        $set: {
          status: 'Completed',
          completedAt: now,
          updatedAt: now,
          ...(paymentVerified ? paymentDetails : {}),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Task has already been completed.' },
        { status: 409 }
      );
    }

    // Update the submission status to Approved
    await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
      { taskId },
      { $set: { status: 'Approved', updatedAt: now } }
    );

    // Update the accepted bid to Completed
    await db.collection(COLLECTIONS.BIDS).updateMany(
      { taskId, status: { $in: ['accepted', 'WorkSubmitted'] } },
      { $set: { status: 'Completed', updatedAt: now } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskCompleted',
      taskId,
      actorAddress: clientAddress,
      metadata: {
        taskTitle: task.title,
        assignedAgent: task.assignedAgentName || task.assignedAgent,
        ...(paymentVerified
          ? { paidAmount: paymentDetails.paidAmount, paymentTx: txSignature }
          : {}),
      },
      createdAt: now,
    });

    // --- REVIEW & REPUTATION ---
    // Find the agent for this task
    const completionBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: 'Completed',
    });
    const agentId = completionBid?.agentId;
    const agentName = completionBid?.agentName || task.assignedAgentName || '';

    // Store review if satisfaction provided (1-5)
    const satRating = parseInt(satisfaction);
    if (agentId && satRating >= 1 && satRating <= 5) {
      try {
        await db.collection('reviews').insertOne({
          taskId,
          taskTitle: task.title,
          agentId,
          agentName,
          clientAddress: clientAddress.toLowerCase(),
          satisfaction: satRating,
          comment: typeof comment === 'string' ? comment.slice(0, 500).trim() : null,
          tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === 'string').slice(0, 5) : [],
          createdAt: now,
        });
      } catch (e: any) {
        // Duplicate review (unique index on taskId) — ignore
        if (e?.code !== 11000) console.error('[HIVE] Review insert error:', e);
      }
    }

    // Recalculate and persist agent reputation
    if (agentId) {
      try {
        // Get all reviews for this agent
        const allReviews = await db.collection('reviews')
          .find({ agentId })
          .project({ satisfaction: 1 })
          .toArray();

        const avgSatisfaction = allReviews.length > 0
          ? allReviews.reduce((sum: number, r: any) => sum + r.satisfaction, 0) / allReviews.length
          : 0;

        // Count completed tasks and total proposals
        const [completedCount, proposalCount] = await Promise.all([
          db.collection(COLLECTIONS.TASKS).countDocuments({
            $or: [
              { assignedAgent: agentId },
              ...(agentName ? [{ assignedAgentName: agentName }] : []),
            ],
            status: 'Completed',
          }),
          db.collection(COLLECTIONS.BIDS).countDocuments({ agentId }),
        ]);

        // reputation = (avgSatisfaction × 200) + (completedTasks × 50) + (proposals × 5)
        const newReputation = Math.round(
          (avgSatisfaction * 200) + (completedCount * 50) + (proposalCount * 5)
        );

        await db.collection(COLLECTIONS.AGENTS).updateOne(
          { _id: new ObjectId(agentId) },
          {
            $set: {
              reputation: newReputation,
              avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
              reviewCount: allReviews.length,
              updatedAt: now,
            },
          }
        );
      } catch (repErr) {
        console.error('[HIVE] Reputation update error:', repErr);
      }
    }

    return NextResponse.json({
      success: true,
      paid: paymentVerified,
      message: paymentVerified
        ? `Task completed. Payment of $${paymentDetails.paidAmount} USDC verified.`
        : `Task has been marked as Completed.`,
    });
  } catch (error: any) {
    console.error('[HIVE] Complete task error:', error);
    // SECURITY: Don't leak internal error details to client
    return NextResponse.json(
      { error: 'An unexpected error occurred while completing the task.' },
      { status: 500 }
    );
  }
}
