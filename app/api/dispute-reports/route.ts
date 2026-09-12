import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { isValidSolanaAddress } from '@/lib/solana-pay';
import { STAKING_TIERS } from '@/lib/token-utils';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createHash } from 'crypto';
import { evidenceUri as isValidEvidenceUri, privateReport, positivePage } from '@/lib/dispute-view';
import { logger } from '@/lib/logger';

const REPORT_CATEGORIES = new Set(['failed_execution', 'malicious_output', 'billing', 'uptime', 'policy', 'other']);
const MAX_DISPUTE_REPORT_BODY_BYTES = 12 * 1024;

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
    if (searchParams.get('access') === '1') return NextResponse.json({ accountId: reporter.reporterId }, { headers: { 'Cache-Control': 'private, no-store' } });
    const status = searchParams.get('status') || 'all';
    const query: Record<string, any> = { reporterId: reporter.reporterId };
    const requestId = searchParams.get('requestId');
    if (requestId) {
      if (!/^[a-f0-9]{24}$/.test(requestId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
      const report = await db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({ ...query, _id: new ObjectId(requestId) });
      return NextResponse.json({ report: report ? privateReport(report) : null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (status !== 'all') query.status = status;
    const page = positivePage(searchParams.get('page')), limit = positivePage(searchParams.get('limit'), 20, 50);
    const [reports, total] = await Promise.all([db.collection(COLLECTIONS.DISPUTE_REPORTS).find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(), db.collection(COLLECTIONS.DISPUTE_REPORTS).countDocuments(query)]);
    return NextResponse.json({ reports: reports.map(privateReport), total, page, limit }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('GET /api/dispute-reports error:', error);
    return NextResponse.json({ error: 'Reports could not be loaded.' }, { status: 500 });
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

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_DISPUTE_REPORT_BODY_BYTES) {
      return NextResponse.json({ error: 'Dispute report body is too large.' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
    if (body.requestId !== undefined && !/^[a-f0-9]{24}$/.test(body.requestId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const providerAddress = typeof body.providerAddress === 'string' ? body.providerAddress.trim() : '';
    const toolId = String(body.toolId || '').trim();
    const evidenceUri = String(body.evidenceUri || '').trim();
    const reason = String(body.reason || '').trim();
    if (!REPORT_CATEGORIES.has(body.category)) return NextResponse.json({ error: 'Choose a report category.' }, { status: 400 });
    const category = body.category;
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

    const fingerprint = createHash('sha256').update(JSON.stringify([providerAddress, toolId, evidenceUri, reason, category, sessionLedgerId])).digest('hex');
    if (body.requestId) {
      const prior = await db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({ _id: new ObjectId(body.requestId) });
      if (prior) return prior.reporterId === reporter.reporterId && prior.fingerprint === fingerprint ? NextResponse.json({ success: true, report: privateReport(prior) }, { headers: { 'Cache-Control': 'private, no-store' } }) : NextResponse.json({ error: 'This request was already used. Check your reports.' }, { status: 409 });
    }
    if (sessionLedgerId && !/^[a-f0-9]{24}$/i.test(sessionLedgerId)) return NextResponse.json({ error: 'Enter a valid usage reference or leave it blank.' }, { status: 400 });
    const provider = await db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress: providerAddress });
    if (!provider) {
      return NextResponse.json({ error: 'No registered provider exists for this Solana address.' }, { status: 404 });
    }

    const registeredTools = Array.isArray(provider.registeredTools) ? provider.registeredTools : [];
    {
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
      if (!affectedParty) return NextResponse.json({ error: 'This usage reference does not match your account, provider and tool.' }, { status: 400 });
    }

    const reporterStake = await db.collection(COLLECTIONS.STAKES).findOne({ stakerId: reporter.reporterId, status: 'active' });
    const watchdogEligible = (reporterStake?.activeAmount || 0) >= STAKING_TIERS.staker.threshold;
    const providerStake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: providerAddress });
    const providerHasClaimingUnstake = Array.isArray(providerStake?.pendingUnstakes)
      && providerStake.pendingUnstakes.some((request: any) => request?.status === 'claiming');
    if (providerHasClaimingUnstake) {
      return NextResponse.json(
        { error: 'This provider has an unstake claim finalizing. Try again shortly.' },
        { status: 409 }
      );
    }

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
      _id: body.requestId ? new ObjectId(body.requestId) : new ObjectId(),
      fingerprint,
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
    }).catch(() => logger.warn('Report saved; activity log unavailable.'));

    return NextResponse.json({
      success: true,
      report: privateReport(report),
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    logger.error('POST /api/dispute-reports error:', error);
    return NextResponse.json({ error: 'The report result could not be confirmed. Check your reports.' }, { status: 500 });
  }
}
