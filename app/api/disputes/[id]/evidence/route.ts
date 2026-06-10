import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid dispute id.' }, { status: 400 });

    const db = await getDb();
    const evidence = await db.collection(COLLECTIONS.DISPUTE_EVIDENCE)
      .find({ disputeId: id })
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json({
      evidence: evidence.map((item) => ({ ...item, id: item._id.toString(), _id: undefined })),
    });
  } catch (error: any) {
    logger.error('GET /api/disputes/[id]/evidence error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load evidence.' }, { status: 500 });
  }
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
    if (dispute.evidenceOpenUntil && new Date() > new Date(dispute.evidenceOpenUntil)) {
      return NextResponse.json({ error: 'Evidence window has closed.' }, { status: 400 });
    }

    const body = await req.json();
    const uri = String(body.uri || '').trim();
    const summary = String(body.summary || '').trim();
    if (!isValidEvidenceUri(uri)) {
      return NextResponse.json({ error: 'uri must be an https, ipfs, or arweave URI.' }, { status: 400 });
    }
    if (summary.length < 10 || summary.length > 1000) {
      return NextResponse.json({ error: 'summary must be between 10 and 1000 characters.' }, { status: 400 });
    }

    let submittedByRole: 'reporter' | 'provider' | 'voter' = 'voter';
    if (dispute.reportId) {
      const report = await db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({ _id: new ObjectId(dispute.reportId) });
      if (report?.reporterId === submitterId) submittedByRole = 'reporter';
    }
    if (agentAuth?.agent?.solanaAddress && agentAuth.agent.solanaAddress === dispute.providerAddress) {
      submittedByRole = 'provider';
    }

    const now = new Date();
    const result = await db.collection(COLLECTIONS.DISPUTE_EVIDENCE).insertOne({
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
    });

    return NextResponse.json({
      success: true,
      evidence: { id: result.insertedId.toString(), disputeId: id, submittedBy: submitterId, submittedByRole, uri, summary, createdAt: now },
    }, { status: 201 });
  } catch (error: any) {
    logger.error('POST /api/disputes/[id]/evidence error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit evidence.' }, { status: 500 });
  }
}
