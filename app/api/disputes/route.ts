import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';
import { createDispute } from '@/lib/disputes';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MIN_SLASHABLE_STAKE_HIVE = 10_000;

function isValidEvidenceUri(value: string): boolean {
  if (typeof value !== 'string' || value.length < 8 || value.length > 500) return false;
  if (value.startsWith('ipfs://') || value.startsWith('ar://')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * GET /api/disputes
 * Retrieves a list of staker slashing disputes.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`disputes-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'All';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (status !== 'All') {
      query.status = status;
    }

    const [disputes, total] = await Promise.all([
      db.collection(COLLECTIONS.DISPUTES)
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.DISPUTES).countDocuments(query),
    ]);

    const mapped = disputes.map((d) => ({
      ...d,
      id: d._id.toString(),
      _id: undefined
    }));

    return NextResponse.json({ disputes: mapped, total, page, limit });
  } catch (error: any) {
    logger.error('GET /api/disputes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disputes
 * Files a new dispute against an active tool provider node.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`disputes-post:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    const admin = await verifyAdmin(req);
    if (admin.error) {
      return NextResponse.json(
        { error: 'Direct dispute creation is admin-only. Submit /api/dispute-reports for DAO review.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { providerAddress, toolId, reason, evidenceUri } = body;

    if (!providerAddress || !toolId || !reason || !evidenceUri) {
      return NextResponse.json(
        { error: 'providerAddress, toolId, reason, and evidenceUri are required.' },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(providerAddress)) {
      return NextResponse.json({ error: 'Invalid provider Solana address.' }, { status: 400 });
    }

    const normalizedToolId = String(toolId).trim();
    if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(normalizedToolId)) {
      return NextResponse.json(
        { error: 'toolId must be 1-80 characters and may only contain letters, numbers, dot, underscore, colon, or hyphen.' },
        { status: 400 }
      );
    }

    const normalizedReason = String(reason).trim();
    if (normalizedReason.length < 20 || normalizedReason.length > 2000) {
      return NextResponse.json(
        { error: 'reason must be between 20 and 2000 characters.' },
        { status: 400 }
      );
    }

    const normalizedEvidenceUri = String(evidenceUri).trim();
    if (!isValidEvidenceUri(normalizedEvidenceUri)) {
      return NextResponse.json(
        { error: 'evidenceUri must be an https, ipfs, or arweave URI.' },
        { status: 400 }
      );
    }

    const provider = await db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress: providerAddress });
    if (!provider) {
      return NextResponse.json(
        { error: 'No registered provider exists for this Solana address.' },
        { status: 404 }
      );
    }

    const registeredTools = Array.isArray(provider.registeredTools) ? provider.registeredTools : [];
    if (registeredTools.length > 0) {
      const ownsTool = registeredTools.some((tool: any) =>
        tool?.name === normalizedToolId || tool?.id === normalizedToolId || tool?.toolId === normalizedToolId
      );
      if (!ownsTool) {
        return NextResponse.json(
          { error: 'This provider does not own the specified tool.' },
          { status: 400 }
        );
      }
    }

    const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: providerAddress, status: 'active' });
    const activeStake = Math.max(Number(stake?.activeAmount || 0), Number(provider.stakedAmount || 0));
    if (!Number.isFinite(activeStake) || activeStake < MIN_SLASHABLE_STAKE_HIVE) {
      return NextResponse.json(
        { error: `Provider must have at least ${MIN_SLASHABLE_STAKE_HIVE.toLocaleString()} active HIVE staked before a slashing dispute can be opened.` },
        { status: 400 }
      );
    }

    const result = await createDispute(
      providerAddress,
      normalizedToolId,
      normalizedReason,
      normalizedEvidenceUri,
      activeStake
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to register dispute.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, disputeId: result.disputeId }, { status: 201 });
  } catch (error: any) {
    logger.error('POST /api/disputes error:', error);
    return NextResponse.json(
      { error: error.message || 'Dispute filing execution failed.' },
      { status: 500 }
    );
  }
}
