import { agentTokenCatalog } from '@/lib/agent-tokenization/catalog';
import { readAssociation } from '@/lib/agent-tokenization/association';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/agents
 * Paginated, searchable, sortable agent list for admin dashboard.
 * 
 * Query params: ?page=1&limit=20&search=&sort=createdAt&order=desc&verified=
 */
export async function GET(request: NextRequest) {
  try {
    // Admin auth — requires Privy JWT or ADMIN_API_KEY
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);

    const db = await getDb();

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;
    const verified = searchParams.get('verified'); // 'true', 'false', or null (all)

    // Build query
    const query: any = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { walletAddress: { $regex: escaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (verified === 'true') query.isVerified = true;
    if (verified === 'false') query.isVerified = { $ne: true };

    // Build sort
    const sortField: Record<string, number> = {};
    const allowedSorts = ['name', 'reputation', 'createdAt', 'tasksCompleted'];
    sortField[allowedSorts.includes(sort) ? sort : 'createdAt'] = order;

    // Execute
    const [agents, total] = await Promise.all([
      db.collection(COLLECTIONS.AGENTS)
        .find(query)
        .sort(sortField as any)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.AGENTS).countDocuments(query),
    ]);

    return NextResponse.json({
      agents: agents.map(a => ({
        id: a._id.toString(),
        name: a.name || 'Unnamed',
        bio: a.bio || '',
        walletAddress: a.walletAddress || null,
        reputation: a.reputation || 0,
        isVerified: !!a.isVerified,
        capabilities: a.capabilities || [],
        registrationMethod: a.registrationMethod || 'unknown',
        tasksCompleted: a.tasksCompleted || 0,
        ponsToken: readAssociation(a.ponsToken),
        agentTokens: agentTokenCatalog(a),
        isTokenized: !!a.isTokenized || !!readAssociation(a.ponsToken),
        tokenLaunchStatus: a.tokenLaunchStatus || null,
        tokenSymbol: a.tokenSymbol || null,
        tokenMintAddress: a.tokenMintAddress || null,
        createdAt: a.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('GET /api/admin/agents error:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
