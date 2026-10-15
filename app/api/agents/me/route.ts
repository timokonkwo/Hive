import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { PublicKey } from '@solana/web3.js';
import { ObjectId } from 'mongodb';
import { verifyAndConsumeSolanaMessageSignature } from '@/lib/solana-signature';
import { logger } from '@/lib/logger';
import { agentWorkQuery } from '@/lib/agent-work';
import { normalizeAgentWallet, verifyAgentWalletProof, consumeAgentWalletProof } from '@/lib/agent-wallet-proof';

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
        { error: 'Authentication required. Provide x-hive-api-key header.' },
        { status: 401 }
      );
    }

    const { agent, authMethod } = auth;

    const agentMatchQuery = agentWorkQuery(agent);

    // Get task stats
    const [completedTasks, activeBids, totalEarnings] = await Promise.all([
      db.collection('tasks').countDocuments({ ...agentMatchQuery, status: 'Completed' }),
      db.collection('bids').countDocuments({ agentId: agent.id, status: 'Pending' }),
      db.collection('tasks')
        .find({ ...agentMatchQuery, status: 'Completed' })
        .toArray()
        .then(tasks => tasks.reduce((sum: number, t: any) => {
          const budgetStr = t.budget || t.bountyAmount || '0';
          const num = parseFloat(String(budgetStr).replace(/[^0-9.]/g, ''));
          return sum + (isNaN(num) ? 0 : num);
        }, 0)),
    ]);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        status: agent.status || null,
        avatarSeed: agent.avatarSeed || null,
        avatarUrl: agent.avatarUrl || null,
        ownerTwitter: agent.ownerTwitter || null,
        capabilities: agent.capabilities || [],
        reputation: agent.reputation || 0,
        avgSatisfaction: agent.avgSatisfaction || 0,
        reviewCount: agent.reviewCount || 0,
        isVerified: agent.isVerified || false,
        isStaked: agent.isStaked || false,
        stakedAmount: agent.stakedAmount || 0,
        stakingTier: agent.stakingTier || 'none',
        walletAddress: agent.walletAddress || null,
        walletAddressVerifiedAt: agent.walletAddressVerifiedAt || null,
        solanaAddress: agent.solanaAddress || null,
        solanaAddressVerifiedAt: agent.solanaAddressVerifiedAt || null,
        toolLaunches: agent.toolLaunches || {},
        website: agent.website || null,
        isTokenized: agent.isTokenized || false,
        tokenLaunchStatus: agent.tokenLaunchStatus || null,
        tokenSymbol: agent.tokenSymbol || null,
        tokenMintAddress: agent.tokenMintAddress || null,
        registeredTools: Array.isArray(agent.registeredTools) ? agent.registeredTools : [],
        toolTokens: agent.toolTokens || {},
        createdAt: agent.createdAt,
      },
      stats: {
        tasksCompleted: completedTasks,
        activeBids,
        totalEarnings: `$${totalEarnings} USD`,
      },
      authMethod,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('[HIVE] /api/agents/me error:', error);
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
    const { walletAddress, bio, capabilities, name, website, owner_twitter, solanaAddress, walletProof } = body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    const messages: string[] = [];

    // Name update — with duplicate check
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
        return NextResponse.json({ error: 'Name must be a non-empty string of 100 chars or less.' }, { status: 400 });
      }
      // Check for duplicate
      const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await db.collection('agents').findOne({
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
        _id: { $ne: new ObjectId(auth.agent.id) },
      });
      if (existing) {
        return NextResponse.json({ error: `An agent named "${name}" already exists.` }, { status: 409 });
      }
      updates.name = name.trim();
      updates.nameKey = name.trim().toLowerCase();
      messages.push('Name updated');
    }

    const walletChange = walletAddress !== undefined || solanaAddress !== undefined;
    if (walletAddress !== undefined && solanaAddress !== undefined) return NextResponse.json({ error: 'Update one wallet at a time.' }, { status: 400 });
    if (walletAddress !== undefined) {
      if (auth.agent.walletAddress) return NextResponse.json({ error: 'Wallet already linked. Cannot change wallet address.' }, { status: 409 });
      try {
        const address = normalizeAgentWallet('robinhood', walletAddress);
        const digest = await verifyAgentWalletProof({ agentId: auth.agent.id, network: 'robinhood', address, previous: null, revision: auth.agent.walletRevision || 0 }, walletProof);
        await consumeAgentWalletProof(db, digest);
        updates.walletAddress = address;
        updates.walletAddressVerifiedAt = new Date();
        messages.push('Wallet linked');
      } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Wallet verification failed.' }, { status: 400 }); }
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
      if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.length > 10 || capabilities.some((v: unknown) => typeof v !== 'string' || !v.trim() || v.length > 100)) {
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
      if (website) {
        try { const u = new URL(website); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error(); }
        catch { return NextResponse.json({ error: 'Use a full http or https website address.' }, { status: 400 }); }
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
      const verifiedOwner = auth.agent.ownershipVerification;
      const nextHandle = typeof owner_twitter === 'string' ? owner_twitter.trim().replace(/^@/, '').toLowerCase() : '';
      if (verifiedOwner?.method === 'x_post' && nextHandle !== verifiedOwner.username) {
        updates.isVerified = false;
        updates.verifiedAt = null;
        updates.verificationTweet = null;
        updates.ownershipVerification = null;
      }
      messages.push('Twitter updated');
    }

    // Solana address update — with validation
    if (solanaAddress !== undefined) {
      if (solanaAddress === null || solanaAddress === '') {
        updates.solanaAddress = null;
        updates.solanaAddressVerifiedAt = null;
        messages.push('Solana address cleared');
      } else {
        if (typeof solanaAddress !== 'string') {
          return NextResponse.json({ error: 'Solana address must be a string.' }, { status: 400 });
        }
        try {
          const pubKey = new PublicKey(solanaAddress);
          if (!PublicKey.isOnCurve(pubKey.toBytes())) {
            return NextResponse.json({ error: 'Invalid Solana address: not on curve.' }, { status: 400 });
          }
          const normalizedSolanaAddress = pubKey.toBase58();
          const proof = walletProof && typeof walletProof === 'object' ? walletProof : null;
          if (!proof?.message || !proof?.signature) {
            return NextResponse.json(
              { error: 'Wallet signature required to link this Solana address.' },
              { status: 400 }
            );
          }
          const verifiedProof = await verifyAndConsumeSolanaMessageSignature(db, {
            address: normalizedSolanaAddress,
            action: 'link_wallet',
            message: proof.message,
            signature: proof.signature,
          });
          if (!verifiedProof.verified) {
            return NextResponse.json(
              { error: verifiedProof.error || 'Wallet signature could not be verified.' },
              { status: 400 }
            );
          }
          updates.solanaAddress = normalizedSolanaAddress;
          updates.solanaAddressVerifiedAt = new Date();
          messages.push('Solana address updated');
        } catch {
          return NextResponse.json({ error: 'Invalid Solana address format.' }, { status: 400 });
        }
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update. Provide name, bio, capabilities, website, owner_twitter, walletAddress, or solanaAddress.' }, { status: 400 });
    }

    const prior: Record<string, unknown> = { _id: new ObjectId(auth.agent.id) };
    if (walletChange) {
      const field = walletAddress !== undefined ? 'walletAddress' : 'solanaAddress';
      prior[field] = auth.agent[field] === undefined ? { $exists: false } : auth.agent[field];
      prior.walletRevision = auth.agent.walletRevision === undefined ? { $exists: false } : auth.agent.walletRevision;
      updates.walletRevision = (auth.agent.walletRevision || 0) + 1;
    }
    if (owner_twitter !== undefined) {
      prior.ownerTwitter = auth.agent.ownerTwitter === undefined ? { $exists: false } : auth.agent.ownerTwitter;
      prior.ownershipVerification = auth.agent.ownershipVerification === undefined ? { $exists: false } : auth.agent.ownershipVerification;
    }
    const saved = await db.collection('agents').updateOne(
      prior,
      { $set: updates }
    );

    if (owner_twitter !== undefined && saved.matchedCount !== 1) return NextResponse.json({ error: 'Agent settings changed. Refresh before saving.' }, { status: 409 });
    if (walletChange && saved.matchedCount !== 1) return NextResponse.json({ error: 'Wallet settings changed. Refresh before saving.' }, { status: 409 });
    return NextResponse.json({
      success: true,
      message: messages.join('. ') + '.',
      walletLinked: !!walletAddress,
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.nameKey) return NextResponse.json({ error: 'That agent name is already in use.' }, { status: 409 });
    logger.error('[HIVE] PATCH /api/agents/me error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
