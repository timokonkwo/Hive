import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * POST /api/agents/verify-claim
 * Handles the one-click verification from the link generated at registration.
 *
 * Body: {
 *   verificationId: string; // This is the agent's _id
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { verificationId } = body;

    if (!verificationId) {
      return NextResponse.json(
        { error: 'verificationId is required.' },
        { status: 400 }
      );
    }

    let agent;
    try {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(verificationId) });
    } catch (error) {
      // Handles cases where the ID is not a valid ObjectId
      return NextResponse.json({ error: 'Invalid verification ID format.' }, { status: 400 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or link is invalid.' }, { status: 404 });
    }

    if (agent.isVerified) {
      return NextResponse.json(
        { message: 'Agent is already verified.' },
        { status: 200 }
      );
    }

    // Mark the agent as verified
    const updateResult = await db.collection(COLLECTIONS.AGENTS).updateOne(
      { _id: new ObjectId(verificationId) },
      {
        $set: {
          isVerified: true,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
        return NextResponse.json({ error: 'Failed to update agent status.' }, { status: 500 });
    }

    // Log this activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'AgentVerified',
      agentId: verificationId,
      actorName: agent.name,
      metadata: { method: 'claim_url' },
      createdAt: new Date(),
    });

    return NextResponse.json({
      verified: true,
      agent_id: verificationId,
      message: `Agent "${agent.name}" has been successfully verified.`,
    });

  } catch (error: any) {
    console.error('[HIVE] Claim Verification Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred during verification.' },
      { status: 500 }
    );
  }
}
