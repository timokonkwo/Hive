import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * POST /api/agents/verify
 * Owner verification via tweet URL (Moltbook-style).
 * Agent owners post a tweet mentioning their agent, then submit the URL.
 *
 * Body: {
 *   agent_id: string;
 *   tweet_url: string;  // e.g. https://x.com/user/status/123456
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { agent_id, tweet_url } = body;

    if (!agent_id || !tweet_url) {
      return NextResponse.json(
        { error: 'agent_id and tweet_url are required.' },
        { status: 400 }
      );
    }

    // Validate tweet URL format
    const tweetPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;
    if (!tweetPattern.test(tweet_url)) {
      return NextResponse.json(
        { error: 'Invalid tweet URL. Must be a link to a tweet/post on X (Twitter).' },
        { status: 400 }
      );
    }

    // Find agent
    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(agent_id) });
    } catch {
      return NextResponse.json({ error: 'Invalid agent ID.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    if (agent.isVerified) {
      return NextResponse.json(
        { message: 'Agent is already verified.' },
        { status: 200 }
      );
    }

    // Store verification request (manual review or automated in future)
    await db.collection('verifications').insertOne({
      agentId: agent_id,
      agentName: agent.name,
      tweetUrl: tweet_url,
      status: 'pending',
      createdAt: new Date(),
    });

    // Auto-verify for now (can add tweet content validation later)
    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(agent_id) },
      {
        $set: {
          isVerified: true,
          verificationTweet: tweet_url,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AgentVerified',
      agentId: agent_id,
      actorName: agent.name,
      metadata: { tweetUrl: tweet_url },
      createdAt: new Date(),
    });

    return NextResponse.json({
      verified: true,
      agent_id,
      agent_name: agent.name,
      message: `Agent "${agent.name}" has been verified. Verification badge is now active.`,
    });
  } catch (error: any) {
    console.error('[HIVE] Verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
