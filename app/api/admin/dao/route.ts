import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdmin } from '@/lib/admin-auth';
import { getDb, COLLECTIONS } from '@/lib/db';
import { createDispute } from '@/lib/disputes';
import { logger } from '@/lib/logger';

const MIN_SLASHABLE_STAKE_HIVE = 10_000;

function mapDoc(doc: any) {
  return doc ? { ...doc, id: doc._id.toString(), _id: undefined } : null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(req.url);
    const reportStatus = searchParams.get('reportStatus') || 'all';
    const disputeStatus = searchParams.get('disputeStatus') || 'active';
    const db = await getDb();

    const reportQuery: Record<string, any> = {};
    if (reportStatus !== 'all') reportQuery.status = reportStatus;

    const disputeQuery: Record<string, any> = {};
    if (disputeStatus !== 'all') disputeQuery.status = disputeStatus;

    const [reports, disputes, counts] = await Promise.all([
      db.collection(COLLECTIONS.DISPUTE_REPORTS)
        .find(reportQuery)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      db.collection(COLLECTIONS.DISPUTES)
        .find(disputeQuery)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      Promise.all([
        db.collection(COLLECTIONS.DISPUTE_REPORTS).countDocuments({ status: 'submitted' }),
        db.collection(COLLECTIONS.DISPUTE_REPORTS).countDocuments({ status: 'needs_evidence' }),
        db.collection(COLLECTIONS.DISPUTE_REPORTS).countDocuments({ status: 'escalated' }),
        db.collection(COLLECTIONS.DISPUTES).countDocuments({ status: 'active' }),
        db.collection(COLLECTIONS.DISPUTES).countDocuments({ status: 'queued' }),
      ]),
    ]);

    return NextResponse.json({
      reports: reports.map(mapDoc),
      disputes: disputes.map(mapDoc),
      stats: {
        submittedReports: counts[0],
        needsEvidenceReports: counts[1],
        escalatedReports: counts[2],
        activeDisputes: counts[3],
        queuedDisputes: counts[4],
      },
    });
  } catch (error: any) {
    logger.error('GET /api/admin/dao error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load DAO admin data.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (admin.error) return admin.error;

    const db = await getDb();
    const body = await req.json();
    const action = String(body.action || '');
    const now = new Date();
    const adminId = admin.client?.userId || 'admin_api_key';

    if (['reject_report', 'request_evidence', 'escalate_report'].includes(action)) {
      const reportId = String(body.reportId || '');
      if (!ObjectId.isValid(reportId)) return NextResponse.json({ error: 'Valid reportId required.' }, { status: 400 });

      const report = await db.collection(COLLECTIONS.DISPUTE_REPORTS).findOne({ _id: new ObjectId(reportId) });
      if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
      if (report.status === 'escalated') {
        return NextResponse.json({ error: 'Report has already been escalated.' }, { status: 400 });
      }

      const triageReason = String(body.reason || '').trim().slice(0, 1000);

      if (action === 'reject_report') {
        await db.collection(COLLECTIONS.DISPUTE_REPORTS).updateOne(
          { _id: report._id },
          { $set: { status: 'rejected', triageReason: triageReason || 'Rejected by admin review.', reviewedBy: adminId, updatedAt: now } }
        );
        await db.collection(COLLECTIONS.ACTIVITY).insertOne({
          type: 'DisputeReportRejected',
          actorName: 'admin',
          metadata: { reportId, reviewedBy: adminId, reason: triageReason },
          createdAt: now,
        });
        return NextResponse.json({ success: true });
      }

      if (action === 'request_evidence') {
        await db.collection(COLLECTIONS.DISPUTE_REPORTS).updateOne(
          { _id: report._id },
          { $set: { status: 'needs_evidence', triageReason: triageReason || 'More evidence required.', reviewedBy: adminId, updatedAt: now } }
        );
        await db.collection(COLLECTIONS.ACTIVITY).insertOne({
          type: 'DisputeReportNeedsEvidence',
          actorName: 'admin',
          metadata: { reportId, reviewedBy: adminId, reason: triageReason },
          createdAt: now,
        });
        return NextResponse.json({ success: true });
      }

      const provider = await db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress: report.providerAddress });
      if (!provider) return NextResponse.json({ error: 'Provider no longer exists.' }, { status: 404 });

      const stake = await db.collection(COLLECTIONS.STAKES).findOne({ solanaAddress: report.providerAddress, status: 'active' });
      const activeStake = Math.max(Number(stake?.activeAmount || 0), Number(provider.stakedAmount || 0));
      if (!Number.isFinite(activeStake) || activeStake < MIN_SLASHABLE_STAKE_HIVE) {
        return NextResponse.json(
          { error: `Provider must have at least ${MIN_SLASHABLE_STAKE_HIVE.toLocaleString()} active HIVE staked before escalation.` },
          { status: 400 }
        );
      }

      const result = await createDispute(
        report.providerAddress,
        report.toolId,
        report.reason,
        report.evidenceUri,
        activeStake,
        {
          reportId,
          category: report.category,
          openedBy: adminId,
          openedByRole: 'admin',
          evidencePeriodHours: Number(body.evidencePeriodHours ?? 24),
          votingPeriodHours: Number(body.votingPeriodHours ?? 48),
          quorumBps: Number(body.quorumBps ?? 500),
          slashThresholdBps: Number(body.slashThresholdBps ?? 6000),
        }
      );

      if (!result.success || !result.disputeId) {
        return NextResponse.json({ error: result.error || 'Failed to escalate report.' }, { status: 400 });
      }

      await db.collection(COLLECTIONS.DISPUTE_REPORTS).updateOne(
        { _id: report._id },
        {
          $set: {
            status: 'escalated',
            triageReason: triageReason || 'Escalated to formal DAO dispute.',
            reviewedBy: adminId,
            disputeId: result.disputeId,
            updatedAt: now,
          },
        }
      );

      await db.collection(COLLECTIONS.DISPUTE_EVIDENCE).insertOne({
        disputeId: result.disputeId,
        submittedBy: report.reporterId,
        submittedByRole: 'reporter',
        uri: report.evidenceUri,
        summary: report.reason.slice(0, 1000),
        createdAt: now,
      });

      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'DisputeReportEscalated',
        actorName: 'admin',
        metadata: { reportId, disputeId: result.disputeId, reviewedBy: adminId },
        createdAt: now,
      });

      return NextResponse.json({ success: true, disputeId: result.disputeId });
    }

    if (['dismiss_dispute', 'extend_dispute', 'start_voting'].includes(action)) {
      const disputeId = String(body.disputeId || '');
      if (!ObjectId.isValid(disputeId)) return NextResponse.json({ error: 'Valid disputeId required.' }, { status: 400 });

      const dispute = await db.collection(COLLECTIONS.DISPUTES).findOne({ _id: new ObjectId(disputeId) });
      if (!dispute) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });

      if (action === 'dismiss_dispute') {
        const reason = String(body.reason || 'Dismissed by admin review.').trim().slice(0, 1000);
        await db.collection(COLLECTIONS.DISPUTES).updateOne(
          { _id: dispute._id },
          { $set: { status: 'dismissed', phase: 'resolved', resolutionReason: reason, resolvedAt: now, reviewedBy: adminId } }
        );
        await db.collection(COLLECTIONS.AGENTS).updateOne(
          { solanaAddress: dispute.providerAddress },
          { $set: { disputeStatus: 'resolved', updatedAt: now } }
        );
        await db.collection(COLLECTIONS.ACTIVITY).insertOne({
          type: 'DisputeAdminDismissed',
          actorName: 'admin',
          metadata: { disputeId, reviewedBy: adminId, reason },
          createdAt: now,
        });
        return NextResponse.json({ success: true });
      }

      if (action === 'start_voting') {
        const votingHours = Math.min(Math.max(Number(body.votingPeriodHours || 48), 1), 168);
        const votingEndsAt = new Date(now.getTime() + votingHours * 60 * 60 * 1000);
        await db.collection(COLLECTIONS.DISPUTES).updateOne(
          { _id: dispute._id, status: 'active' },
          {
            $set: {
              phase: 'voting',
              evidenceOpenUntil: now,
              votingStartsAt: now,
              votingEndsAt,
              deadline: votingEndsAt,
              updatedAt: now,
              reviewedBy: adminId,
            },
          }
        );
        return NextResponse.json({ success: true });
      }

      const hours = Math.min(Math.max(Number(body.hours || 24), 1), 168);
      const baseDeadline = new Date(dispute.deadline || now);
      const deadline = new Date(Math.max(baseDeadline.getTime(), now.getTime()) + hours * 60 * 60 * 1000);
      await db.collection(COLLECTIONS.DISPUTES).updateOne(
        { _id: dispute._id, status: 'active' },
        { $set: { votingEndsAt: deadline, deadline, updatedAt: now, reviewedBy: adminId } }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported DAO admin action.' }, { status: 400 });
  } catch (error: any) {
    logger.error('PATCH /api/admin/dao error:', error);
    return NextResponse.json({ error: error.message || 'DAO admin action failed.' }, { status: 500 });
  }
}
