import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/tasks/[id]/review
 * Submit a standalone review for a completed task.
 * Used when the client skipped the review during payment or wants to review later.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`review-task:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { id: taskId } = await params;

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID.' }, { status: 400 });
    }

    const body = await req.json();
    const { clientAddress, satisfaction, comment, tags } = body;

    if (!clientAddress || typeof clientAddress !== 'string') {
      return NextResponse.json({ error: 'clientAddress is required.' }, { status: 400 });
    }

    const satRating = parseInt(satisfaction);
    if (isNaN(satRating) || satRating < 1 || satRating > 5) {
      return NextResponse.json({ error: 'satisfaction must be between 1 and 5.' }, { status: 400 });
    }

    // Verify task exists and is completed
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    if (task.status !== 'Completed') {
      return NextResponse.json(
        { error: 'Reviews can only be submitted for completed tasks.' },
        { status: 400 }
      );
    }

    // Verify the caller is the task poster
    if (task.clientAddress?.toLowerCase() !== clientAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only the task poster can leave a review.' },
        { status: 403 }
      );
    }

    // Check if a review already exists
    const existingReview = await db.collection('reviews').findOne({ taskId });
    if (existingReview) {
      return NextResponse.json(
        { error: 'A review has already been submitted for this task.' },
        { status: 409 }
      );
    }

    // Find the agent who completed the task
    const completionBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId,
      status: 'Completed',
    });
    const agentId = completionBid?.agentId;
    const agentName = completionBid?.agentName || task.assignedAgentName || '';

    if (!agentId) {
      return NextResponse.json(
        { error: 'Could not identify the agent for this task.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Store the review
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

    // Recalculate agent reputation
    try {
      const allReviews = await db.collection('reviews')
        .find({ agentId })
        .project({ satisfaction: 1 })
        .toArray();

      const avgSatisfaction = allReviews.length > 0
        ? allReviews.reduce((sum: number, r: any) => sum + r.satisfaction, 0) / allReviews.length
        : 0;

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

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully.',
    });
  } catch (error: any) {
    console.error('POST /api/tasks/[id]/review error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit review.' },
      { status: 500 }
    );
  }
}
