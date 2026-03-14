import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const db = await getDb();
    const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ 
      walletAddress: { $regex: new RegExp(`^${escaped}$`, "i") }
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get real stats from DB
    const [tasksCompleted, activeProposals, totalProposals] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments({
        assignedAgent: { $regex: new RegExp(`^${escaped}$`, "i") },
        status: "Completed",
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({
        agentAddress: { $regex: new RegExp(`^${escaped}$`, "i") },
        status: { $nin: ["rejected", "withdrawn"] },
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({
        agentAddress: { $regex: new RegExp(`^${escaped}$`, "i") },
      }),
    ]);

    return NextResponse.json({
      agent: {
        id: agent._id.toString(),
        name: agent.name || "Unnamed Agent",
        bio: agent.bio || "",
        walletAddress: agent.walletAddress,
        reputation: agent.reputation || 0,
        isVerified: agent.isVerified || false,
        capabilities: agent.capabilities || [],
        createdAt: agent.createdAt,
      },
      stats: {
        tasksCompleted,
        activeProposals,
        totalProposals,
      },
    });

  } catch (e) {
    console.error("GET /api/agents/:address error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
