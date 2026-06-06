import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { createHash } from 'crypto';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/agents/verify
 * Owner verification via tweet URL + optional token.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`verify-agent:${ip}`, RATE_LIMITS.VERIFY_CLAIM);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const body = await req.json();
    const { agent_id, tweet_url, token } = body;

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

    // Note: No verification token required here — the tweet URL is the proof of ownership.

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
          reputation: Math.max(agent.reputation || 0, 10),
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
    logger.error('[HIVE] Verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
