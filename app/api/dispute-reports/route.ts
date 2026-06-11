import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const REPORT_CATEGORIES = new Set(['failed_execution', 'malicious_output', 'billing', 'uptime', 'policy', 'other']);

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

async function resolveReporter(req: NextRequest, db: any) {
  const client = await authenticateClient(req);
  if (client) return { reporterId: client.userId, reporterType: 'client' as const };

  const agentAuth = await authenticateRequest(req.headers, db);
  if (agentAuth) return { reporterId: agentAuth.agent.id, reporterType: 'agent' as const };

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`dispute-reports-get:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const reporter = await resolveReporter(req, db);
    if (!reporter) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const query: Record<string, any> = { reporterId: reporter.reporterId };
    if (status !== 'all') query.status = status;

    const reports = await db.collection(COLLECTIONS.DISPUTE_REPORTS)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      reports: reports.map((report) => ({ ...report, id: report._id.toString(), _id: undefined })),
    });
  } catch (error: any) {
    logger.error('GET /api/dispute-reports error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load dispute reports.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`dispute-reports-post:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const reporter = await resolveReporter(req, db);
    if (!reporter) return NextResponse.json({ error: 'Authentication required to submit reports.' }, { status: 401 });

    const body = await req.json();
    const providerAddress = String(body.providerAddress || '').trim();
    const toolId = String(body.toolId || '').trim();
    const evidenceUri = String(body.evidenceUri || '').trim();
    const reason = String(body.reason || '').trim();
    const category = REPORT_CATEGORIES.has(body.category) ? body.category : 'other';
    const sessionLedgerId = body.sessionLedgerId ? String(body.sessionLedgerId).trim() : null;

    if (!providerAddress || !toolId || !evidenceUri || !reason) {
      return NextResponse.json(
        { error: 'providerAddress, toolId, evidenceUri, and reason are required.' },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(providerAddress)) {
      return NextResponse.json({ error: 'Invalid provider Solana address.' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(toolId)) {
      return NextResponse.json(
        { error: 'toolId must be 1-80 characters and may only contain letters, numbers, dot, underscore, colon, or hyphen.' },
        { status: 400 }
      );
    }

    if (reason.length < 20 || reason.length > 2000) {
      return NextResponse.json({ error: 'reason must be between 20 and 2000 characters.' }, { status: 400 });
    }

    if (!isValidEvidenceUri(evidenceUri)) {
      return NextResponse.json({ error: 'evidenceUri must be an https, ipfs, or arweave URI.' }, { status: 400 });
    }

    const provider = await db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress: providerAddress });
    if (!provider) {
      return NextResponse.json({ error: 'No registered provider exists for this Solana address.' }, { status: 404 });
    }

    const registeredTools = Array.isArray(provider.registeredTools) ? provider.registeredTools : [];
    if (registeredTools.length > 0) {
      const ownsTool = registeredTools.some((tool: any) =>
        tool?.name === toolId || tool?.id === toolId || tool?.toolId === toolId
      );
      if (!ownsTool) {
        return NextResponse.json({ error: 'This provider does not own the specified tool.' }, { status: 400 });
      }
    }

    let affectedParty = false;
    if (sessionLedgerId && ObjectId.isValid(sessionLedgerId)) {
      const ledger = await db.collection(COLLECTIONS.SESSION_LEDGER).findOne({ _id: new ObjectId(sessionLedgerId) });
      affectedParty = !!ledger
        && ledger.userId === reporter.reporterId
        && ledger.providerAddress === providerAddress
        && ledger.toolId === toolId;
    }

    const reporterStake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: reporter.reporterId, status: 'active' });
    const watchdogEligible = (reporterStake?.activeAmount || 0) >= 10_000;
    const providerStake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: providerAddress });
    const activeProviderStake = Math.max(
      Number(providerStake?.activeAmount || 0) + Number(providerStake?.lockedAmount || 0),
      Number(provider.stakedAmount || 0)
    );

    try {
      await db.collection(COLLECTIONS.DISPUTE_REPORTS).createIndex(
        { providerAddress: 1, toolId: 1, sessionLedgerId: 1, status: 1 },
        {
          unique: true,
          partialFilterExpression: { status: { $in: ['submitted', 'needs_evidence', 'escalated'] } },
          background: true,
        }
      );
    } catch {
      return NextResponse.json({ error: 'Report deduplication is not ready. Try again shortly.' }, { status: 503 });
    }

    const now = new Date();
    const report = {
      reporterId: reporter.reporterId,
      reporterType: reporter.reporterType,
      providerAddress,
      providerName: provider.name || null,
      toolId,
      category,
      reason,
      evidenceUri,
      sessionLedgerId,
      affectedParty,
      watchdogEligible,
      providerStake: activeProviderStake,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    let result;
    try {
      result = await db.collection(COLLECTIONS.DISPUTE_REPORTS).insertOne(report);
    } catch (error: any) {
      if (error?.code === 11000) {
        return NextResponse.json(
          { error: 'A report for this provider/tool/session is already under review.' },
          { status: 409 }
        );
      }
      throw error;
    }

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'DisputeReportSubmitted',
      actorName: reporter.reporterType,
      metadata: {
        reportId: result.insertedId.toString(),
        reporterId: reporter.reporterId,
        providerAddress,
        toolId,
        category,
        affectedParty,
        watchdogEligible,
      },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      report: { ...report, id: result.insertedId.toString() },
    }, { status: 201 });
  } catch (error: any) {
    logger.error('POST /api/dispute-reports error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit dispute report.' }, { status: 500 });
  }
}
