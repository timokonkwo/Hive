import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { VerificationError, verificationId, verificationAccess, verificationView, verificationCode, postLink, xHandle, type VerificationAgent } from '@/lib/agent-verification';
import { readXPost, checkXPost, xLookupConfigured } from '@/lib/x-post-proof';
import { logger } from '@/lib/logger';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: NextRequest) {
  const reply = (v: unknown, status = 200) => NextResponse.json(v, { status, headers });
  try {
    const limit = checkRateLimit(`verify-agent:${getClientIp(req)}`, RATE_LIMITS.VERIFY_CLAIM);
    if (!limit.allowed) return reply({ error: 'Too many checks. Try again shortly.' }, 429);
    let body; try { body = await req.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }
    if (!body || !verificationId(body.agent_id)) return reply({ error: 'This agent link is invalid.' }, 400);
    const db = await getDb(), collection = db.collection<VerificationAgent>('agents');
    const agent = await collection.findOne({ _id: new ObjectId(body.agent_id) });
    if (!agent) return reply({ error: 'This agent was not found.' }, 404);
    const access = verificationAccess(req.headers, agent, body.token);
    if (!access) return reply({ error: 'Use your verification link or agent access details.' }, 401);
    if (agent.isVerified === true) return reply(verificationView(agent, true, xLookupConfigured()));
    if (agent.ownerTwitter && !xHandle(agent.ownerTwitter)) return reply({ error: 'Update your X handle in My agents before verification.' }, 409);
    const link = postLink(body.tweet_url), code = verificationCode(agent);
    if (body.code !== code) return reply({ error: 'The verification code changed. Refresh and copy the current text.' }, 409);
    const proof = checkXPost(await readXPost(link.id), link, code, agent);
    const now = new Date();
    const saved = await collection.updateOne({ _id: agent._id, isVerified: { $ne: true }, name: agent.name,
      ownerTwitter: agent.ownerTwitter === undefined ? { $exists: false } : agent.ownerTwitter,
      verificationTokenHash: agent.verificationTokenHash === undefined ? { $exists: false } : agent.verificationTokenHash,
      ...(access === 'key' ? { apiKeyHash: agent.apiKeyHash } : {}),
    }, { $set: { isVerified: true, verifiedAt: now, updatedAt: now, verificationTweet: link.url, ownershipVerification: proof, ownerTwitter: proof.username } });
    if (saved.matchedCount !== 1) {
      const current = await collection.findOne({ _id: agent._id });
      if (current?.isVerified === true) return reply(verificationView(current, true, xLookupConfigured()));
      return reply({ error: 'This agent changed during verification. Refresh and try again.' }, 409);
    }
    try { await db.collection(COLLECTIONS.ACTIVITY).insertOne({ type: 'AgentVerified', agentId: body.agent_id, actorName: agent.name, metadata: { postId: proof.postId, authorId: proof.authorId, method: proof.method }, createdAt: now }); }
    catch { logger.warn('[HIVE] Verification activity could not be recorded.'); }
    return reply(verificationView({ ...agent, isVerified: true, verifiedAt: now, ownerTwitter: proof.username, ownershipVerification: proof }, true, xLookupConfigured()));
  } catch (error) { return reply({ error: error instanceof VerificationError ? error.message : 'Verification could not be confirmed. Check the saved status before trying again.' }, error instanceof VerificationError ? error.status : 500); }
}
