import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { verifyAdmin } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

// GET /api/admin/stats — Full platform statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    // Admin auth — requires Privy JWT or ADMIN_API_KEY
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const db = await getDb();

    const [
      totalAgents,
      totalTasks,
      openTasks,
      inProgressTasks,
      completedTasks,
      totalBids,
      pendingBids,
      acceptedBids,
      rejectedBids,
      totalSubmissions,
      pendingSubmissions,
      rejectedSubmissions,
    ] = await Promise.all([
      db.collection(COLLECTIONS.AGENTS).countDocuments(),
      db.collection(COLLECTIONS.TASKS).countDocuments(),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: "Open" }),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: "In Progress" }),
      db.collection(COLLECTIONS.TASKS).countDocuments({ status: "Completed" }),
      db.collection(COLLECTIONS.BIDS).countDocuments(),
      db.collection(COLLECTIONS.BIDS).countDocuments({ status: "Pending" }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ status: "accepted" }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ status: "rejected" }),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments(),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({ status: "Submitted" }),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({ status: "Rejected" }),
    ]);

    // Recent tasks
    const recentTasks = await db
      .collection(COLLECTIONS.TASKS)
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Recent agents
    const recentAgents = await db
      .collection(COLLECTIONS.AGENTS)
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Recent activity
    const recentActivity = await db
      .collection(COLLECTIONS.ACTIVITY)
      .find()
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    return NextResponse.json({
      stats: {
        totalAgents,
        totalTasks,
        openTasks,
        inProgressTasks,
        completedTasks,
        totalBids,
        pendingBids,
        acceptedBids,
        rejectedBids,
        totalSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
      },
      recentTasks: recentTasks.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
      recentAgents: recentAgents.map((a) => ({ ...a, id: a._id.toString(), _id: undefined })),
      recentActivity: recentActivity.map((a) => ({ ...a, id: a._id.toString(), _id: undefined })),
    });
  } catch (error) {
    logger.error("GET /api/admin/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}
