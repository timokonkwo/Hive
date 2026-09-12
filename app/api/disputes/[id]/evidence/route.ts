import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createHash } from 'crypto';
import { evidenceUri as isValidEvidenceUri, publicEvidence, evidenceOpen, publicCase, positivePage } from '@/lib/dispute-view';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  const rl = checkRateLimit(`evidence-read:${getClientIp(req)}`, RATE_LIMITS.READ);
  if (!rl.allowed) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
  try {
    const { id } = await params;
    if (!/^[a-f0-9]{24}$/i.test(id)) return reply({ error: 'Invalid case.' }, 400);
    const db = await getDb();
    if (!await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: new ObjectId(id) })) return reply({ error: 'Case not found.' }, 404);
    const requestId = req.nextUrl.searchParams.get('requestId');
    if (requestId) {
      if (!/^[a-f0-9]{24}$/.test(requestId)) return reply({ error: 'Invalid request.' }, 400);
      const client = await authenticateClient(req), agent = !client ? await authenticateRequest(req.headers, db) : null, userId = client?.userId || agent?.agent?.id;
      if (!userId) return reply({ error: 'Sign in to check your submission.' }, 401);
      const item = await db.collection(COLLECTIONS.DISPUTE_EVIDENCE).findOne({ _id: new ObjectId(requestId), disputeId: id, submittedBy: userId });
      return reply({ item: item ? publicEvidence(item) : null });
    }
    const page = positivePage(req.nextUrl.searchParams.get('page')), limit = 20;
    const [items, total] = await Promise.all([db.collection(COLLECTIONS.DISPUTE_EVIDENCE).find({ disputeId: id }).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).toArray(), db.collection(COLLECTIONS.DISPUTE_EVIDENCE).countDocuments({ disputeId: id })]);
    return reply({ evidence: items.map(publicEvidence), total, page, limit });
  } catch { return reply({ error: 'Evidence could not be loaded.' }, 503); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`dispute-evidence:${ip}`, RATE_LIMITS.WRITE);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid dispute id.' }, { status: 400 });

    const db = await getDb();
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    const submitterId = client?.userId || agentAuth?.agent?.id;
    if (!submitterId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const dispute = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: new ObjectId(id) });
    if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    if (dispute.status !== 'active') {
      return NextResponse.json({ error: 'Evidence can only be added to active disputes.' }, { status: 400 });
    }
    if (!evidenceOpen(publicCase(dispute))) {
      return NextResponse.json({ error: 'Evidence window has closed.' }, { status: 400 });
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > 12 * 1024) return NextResponse.json({ error: 'Evidence is too long.' }, { status: 413 });
    let body; try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid evidence.' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || (body.requestId !== undefined && !/^[a-f0-9]{24}$/.test(body.requestId))) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const uri = String(body.uri || '').trim();
    const summary = String(body.summary || '').trim();
    if (!isValidEvidenceUri(uri)) {
      return NextResponse.json({ error: 'uri must be an https, ipfs, or arweave URI.' }, { status: 400 });
    }
    if (summary.length < 10 || summary.length > 1000) {
      return NextResponse.json({ error: 'summary must be between 10 and 1000 characters.' }, { status: 400 });
    }

    const fingerprint = createHash('sha256').update(JSON.stringify([id, uri, summary])).digest('hex');
    if (body.requestId) {
      const prior = await db.collection(COLLECTIONS.DISPUTE_EVIDENCE).findOne({ _id: new ObjectId(body.requestId) });
      if (prior) return prior.submittedBy === submitterId && prior.disputeId === id && prior.fingerprint === fingerprint ? NextResponse.json({ success: true, evidence: publicEvidence(prior) }) : NextResponse.json({ error: 'This request was already used. Check the evidence.' }, { status: 409 });
    }
    let submittedByRole: 'reporter' | 'provider' | 'voter' = 'voter';
    if (dispute.reportId && ObjectId.isValid(dispute.reportId)) {
      const report = await db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({ _id: new ObjectId(dispute.reportId) });
      if (report?.reporterId === submitterId) submittedByRole = 'reporter';
    }
    if (agentAuth?.agent?.solanaAddress && agentAuth.agent.solanaAddress === dispute.providerAddress) {
      submittedByRole = 'provider';
    }

    const now = new Date();
    if (!evidenceOpen(publicCase(dispute))) return NextResponse.json({ error: 'Evidence window has closed.' }, { status: 400 });
    const result = await db.collection(COLLECTIONS.DISPUTE_EVIDENCE).insertOne({
      _id: body.requestId ? new ObjectId(body.requestId) : new ObjectId(), fingerprint,
      disputeId: id,
      submittedBy: submitterId,
      submittedByRole,
      uri,
      summary,
      createdAt: now,
    });

    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'DisputeEvidenceSubmitted',
      actorName: submittedByRole,
      metadata: { disputeId: id, submittedBy: submitterId, submittedByRole, uri },
      createdAt: now,
    }).catch(() => logger.warn('Evidence saved; activity log unavailable.'));

    return NextResponse.json({
      success: true,
      evidence: { id: result.insertedId.toString(), disputeId: id, submittedByRole, uri, summary, createdAt: now },
    }, { status: 201 });
  } catch (error: any) {
    logger.error('POST /api/disputes/[id]/evidence error:', error);
    return NextResponse.json({ error: 'The evidence result could not be confirmed. Check the case.' }, { status: 500 });
  }
}
