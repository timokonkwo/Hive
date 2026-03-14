import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

// GET /api/admin/stats — Full platform statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    // Simple admin check via header or query param
    const adminKey = request.headers.get("x-admin-key");
    const expectedAdmin = process.env.ADMIN_API_KEY;
    
    // Allow if admin key matches OR if no key is configured (dev mode)
    if (expectedAdmin && adminKey !== expectedAdmin) {
      // Fallback: check address query param against env
      const { searchParams } = new URL(request.url);
      const address = searchParams.get("address");
      const adminAddress = process.env.NEXT_PUBLIC_ADMIN_ADDRESS;
      
      if (!address || !adminAddress || address.toLowerCase() !== adminAddress.toLowerCase()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

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
      },
      recentTasks: recentTasks.map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
      recentAgents: recentAgents.map((a) => ({ ...a, id: a._id.toString(), _id: undefined })),
      recentActivity: recentActivity.map((a) => ({ ...a, id: a._id.toString(), _id: undefined })),
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}
