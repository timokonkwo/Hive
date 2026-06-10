import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';
import { getStakingTier, getStakingTierInfo } from '@/lib/token-utils';
import { logger } from '@/lib/logger';

const ALLOWED_STATUSES = new Set(['all', 'active', 'none', 'locked', 'slashed']);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value: string) {
  try {
    return ObjectId.isValid(value) ? new ObjectId(value) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = searchParams.get('status') || 'all';

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid stake status filter.' }, { status: 400 });
    }

    const db = await getDb();
    const query: any = {};

    if (status !== 'all') {
      if (status === 'locked') query.lockedAmount = { $gt: 0 };
      else if (status === 'slashed') query.slashedAmount = { $gt: 0 };
      else query.status = status;
    }

    if (search) {
      const escaped = escapeRegex(search);
      query.$or = [
        { stakerId: { $regex: escaped, $options: 'i' } },
        { stakerType: { $regex: escaped, $options: 'i' } },
        { solanaAddress: { $regex: escaped, $options: 'i' } },
        { status: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [statsAgg, stakers, total] = await Promise.all([
      db.collection(COLLECTIONS.STAKES).aggregate([
        {
          $group: {
            _id: null,
            totalStakers: { $sum: 1 },
            activeStakers: { $sum: { $cond: [{ $gt: ['$activeAmount', 0] }, 1, 0] } },
            totalActiveAmount: { $sum: { $ifNull: ['$activeAmount', 0] } },
            totalLockedAmount: { $sum: { $ifNull: ['$lockedAmount', 0] } },
            totalSlashedAmount: { $sum: { $ifNull: ['$slashedAmount', 0] } },
          },
        },
      ]).toArray(),
      db.collection(COLLECTIONS.STAKES)
        .find(query)
        .sort({ activeAmount: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.STAKES).countDocuments(query),
    ]);

    const stakerIds = stakers.map((stake) => String(stake.stakerId || '')).filter(Boolean);
    const agentObjectIds = stakerIds.map(toObjectId).filter(Boolean) as ObjectId[];

    const [clients, agents, events] = await Promise.all([
      stakerIds.length
        ? db.collection(COLLECTIONS.CLIENTS).find({ address: { $in: stakerIds } }).toArray()
        : Promise.resolve([]),
      agentObjectIds.length
        ? db.collection(COLLECTIONS.AGENTS).find({ _id: { $in: agentObjectIds } }).toArray()
        : Promise.resolve([]),
      stakerIds.length
        ? db.collection(COLLECTIONS.STAKE_EVENTS)
            .find({ stakerId: { $in: stakerIds } })
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray()
        : Promise.resolve([]),
    ]);

    const clientById = new Map(clients.map((client) => [client.address, client]));
    const agentById = new Map(agents.map((agent) => [agent._id.toString(), agent]));
    const lastEventByStaker = new Map<string, any>();
    for (const event of events) {
      const key = String(event.stakerId || '');
      if (key && !lastEventByStaker.has(key)) lastEventByStaker.set(key, event);
    }

    const stats = statsAgg[0] || {
      totalStakers: 0,
      activeStakers: 0,
      totalActiveAmount: 0,
      totalLockedAmount: 0,
      totalSlashedAmount: 0,
    };

    return NextResponse.json({
      stats: {
        totalStakers: stats.totalStakers || 0,
        activeStakers: stats.activeStakers || 0,
        totalActiveAmount: stats.totalActiveAmount || 0,
        totalLockedAmount: stats.totalLockedAmount || 0,
        totalSlashedAmount: stats.totalSlashedAmount || 0,
      },
      stakers: stakers.map((stake) => {
        const stakerId = String(stake.stakerId || '');
        const agent = agentById.get(stakerId);
        const client = clientById.get(stakerId);
        const activeAmount = stake.activeAmount || 0;
        const tier = getStakingTier(activeAmount);
        const lastEvent = lastEventByStaker.get(stakerId);

        return {
          id: stake._id.toString(),
          stakerId,
          stakerType: stake.stakerType || 'unknown',
          displayName: agent?.name || client?.name || client?.company || null,
          solanaAddress: stake.solanaAddress || agent?.solanaAddress || client?.solanaAddress || null,
          status: stake.status || (activeAmount > 0 ? 'active' : 'none'),
          activeAmount,
          lockedAmount: stake.lockedAmount || 0,
          slashedAmount: stake.slashedAmount || 0,
          tier,
          tierLabel: getStakingTierInfo(activeAmount)?.label || 'None',
          updatedAt: stake.updatedAt || null,
          createdAt: stake.createdAt || null,
          lastStakeEvent: lastEvent ? {
            txSignature: lastEvent.txSignature || null,
            amount: lastEvent.confirmedAmount || lastEvent.amount || 0,
            status: lastEvent.status || null,
            createdAt: lastEvent.createdAt || null,
            verifiedAt: lastEvent.verifiedAt || null,
          } : null,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('GET /api/admin/stakers error:', error);
    return NextResponse.json({ error: 'Failed to fetch stakers' }, { status: 500 });
  }
}
