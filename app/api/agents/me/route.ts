import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * GET /api/agents/me
 * Get the authenticated agent's own profile and stats.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agents-me:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header or x-wallet-address header.' },
        { status: 401 }
      );
    }

    const { agent, authMethod } = auth;

    // Build a flexible query that matches both new (agentId) and legacy (walletAddress) assignedAgent values
    const agentMatchQuery: any = { $or: [{ assignedAgent: agent.id }] };
    if (agent.walletAddress) {
      const escapedWallet = agent.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      agentMatchQuery.$or.push({ assignedAgent: { $regex: new RegExp(`^${escapedWallet}$`, 'i') } });
    }

    // Get task stats
    const [completedTasks, activeBids, totalEarnings] = await Promise.all([
      db.collection('tasks').countDocuments({ ...agentMatchQuery, status: 'Completed' }),
      db.collection('bids').countDocuments({ agentId: agent.id, status: 'Pending' }),
      db.collection('tasks')
        .find({ ...agentMatchQuery, status: 'Completed' })
        .toArray()
        .then(tasks => tasks.reduce((sum: number, t: any) => {
          const budgetStr = t.budget || t.bountyAmount || '0';
          const num = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
          return sum + (isNaN(num) ? 0 : num);
        }, 0)),
    ]);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        capabilities: agent.capabilities || [],
        reputation: agent.reputation || 0,
        isVerified: agent.isVerified || false,
        isStaked: agent.isStaked || false,
        walletAddress: agent.walletAddress || null,
        website: agent.website || null,
        createdAt: agent.createdAt,
      },
      stats: {
        tasksCompleted: completedTasks,
        activeBids,
        totalEarnings: `$${totalEarnings} USD`,
      },
      authMethod,
    });
  } catch (error: any) {
    console.error('[HIVE] /api/agents/me error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/me
 * Update own profile. Agents can link a wallet, update bio, or capabilities.
 * Wallet can only be set if currently null (prevents hijacking).
 */
export async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`agents-me-patch:${ip}`, RATE_LIMITS.MANAGE_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const auth = await authenticateRequest(req.headers, db);

    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { walletAddress, bio, capabilities, name, website, owner_twitter } = body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    const messages: string[] = [];

    // Name update — with duplicate check
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
        return NextResponse.json({ error: 'Name must be a non-empty string of 100 chars or less.' }, { status: 400 });
      }
      // Check for duplicate
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await db.collection('agents').findOne({
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
        _id: { $ne: new (require('mongodb').ObjectId)(auth.agent.id) },
      });
      if (existing) {
        return NextResponse.json({ error: `An agent named "${name}" already exists.` }, { status: 409 });
      }
      updates.name = name.trim();
      messages.push('Name updated');
    }

    // Wallet linking — only if currently null
    if (walletAddress) {
      if (typeof walletAddress !== 'string' || walletAddress.length < 20) {
        return NextResponse.json({ error: 'Invalid wallet address format.' }, { status: 400 });
      }
      if (auth.agent.walletAddress) {
        return NextResponse.json(
          { error: 'Wallet already linked. Cannot change wallet address.' },
          { status: 409 }
        );
      }
      updates.walletAddress = walletAddress;
      messages.push('Wallet linked');
    }

    // Bio update
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 1000) {
        return NextResponse.json({ error: 'Bio must be a string of 1000 chars or less.' }, { status: 400 });
      }
      updates.bio = bio;
      messages.push('Bio updated');
    }

    // Capabilities update
    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.length > 10) {
        return NextResponse.json({ error: 'Capabilities must be an array of 1-10 items.' }, { status: 400 });
      }
      updates.capabilities = capabilities;
      messages.push('Capabilities updated');
    }

    // Website update
    if (website !== undefined) {
      if (website !== null && (typeof website !== 'string' || website.length > 200)) {
        return NextResponse.json({ error: 'Website must be a string of 200 chars or less, or null to clear.' }, { status: 400 });
      }
      updates.website = website;
      messages.push('Website updated');
    }

    // Twitter handle update
    if (owner_twitter !== undefined) {
      if (owner_twitter !== null && (typeof owner_twitter !== 'string' || owner_twitter.length > 50)) {
        return NextResponse.json({ error: 'Twitter handle must be 50 chars or less, or null to clear.' }, { status: 400 });
      }
      updates.ownerTwitter = owner_twitter;
      messages.push('Twitter updated');
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update. Provide name, bio, capabilities, website, owner_twitter, or walletAddress.' }, { status: 400 });
    }

    const { ObjectId } = require('mongodb');
    await db.collection('agents').updateOne(
      { _id: new ObjectId(auth.agent.id) },
      { $set: updates }
    );

    return NextResponse.json({
      success: true,
      message: messages.join('. ') + '.',
      walletLinked: !!walletAddress,
    });
  } catch (error: any) {
    console.error('[HIVE] PATCH /api/agents/me error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
