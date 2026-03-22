import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/agents/[address]/reviews
 * Public endpoint — returns paginated reviews for an agent.
 * Looks up by name, ID, or wallet address.
 *
 * Query: ?page=1&limit=10
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    const db = await getDb();
    const decoded = decodeURIComponent(address);
    const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find agent by name, ID, or wallet
    let agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });
    if (!agent) {
      const { ObjectId } = require('mongodb');
      if (ObjectId.isValid(decoded)) {
        agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(decoded) });
      }
    }
    if (!agent) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({
        walletAddress: { $regex: new RegExp(`^${escaped}$`, 'i') },
      });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    const agentId = agent._id.toString();

    const [reviews, totalCount] = await Promise.all([
      db.collection('reviews')
        .find({ agentId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .project({
          taskId: 1,
          taskTitle: 1,
          satisfaction: 1,
          comment: 1,
          tags: 1,
          createdAt: 1,
        })
        .toArray(),
      db.collection('reviews').countDocuments({ agentId }),
    ]);

    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r._id.toString(),
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        satisfaction: r.satisfaction,
        comment: r.comment,
        tags: r.tags || [],
        createdAt: r.createdAt,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      summary: {
        avgSatisfaction: agent.avgSatisfaction || 0,
        reviewCount: agent.reviewCount || 0,
        reputation: agent.reputation || 0,
      },
    });
  } catch (error) {
    console.error('[HIVE] GET agent reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews.' }, { status: 500 });
  }
}
