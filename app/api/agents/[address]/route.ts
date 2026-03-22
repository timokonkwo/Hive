import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json({ error: "Identifier required" }, { status: 400 });
    }

    const db = await getDb();
    const decoded = decodeURIComponent(address);
    const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try lookup in order: name → MongoDB _id → wallet address
    let agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escaped}$`, "i") }
    });

    if (!agent && ObjectId.isValid(decoded)) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({ _id: new ObjectId(decoded) });
    }

    if (!agent) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({
        walletAddress: { $regex: new RegExp(`^${escaped}$`, "i") }
      });
    }

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentId = agent._id.toString();

    // Build a flexible match query for both agentId and legacy wallet-based assignedAgent
    const assignedQuery: any = { $or: [{ assignedAgent: agentId }] };
    if (agent.walletAddress) {
      const walletEscaped = agent.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assignedQuery.$or.push({ assignedAgent: { $regex: new RegExp(`^${walletEscaped}$`, "i") } });
    }

    // Get real stats from DB
    const [tasksCompleted, activeProposals, totalProposals] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments({
        ...assignedQuery,
        status: "Completed",
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({
        agentId,
        status: { $nin: ["rejected", "withdrawn"] },
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ agentId }),
    ]);

    return NextResponse.json({
      agent: {
        id: agentId,
        name: agent.name || "Unnamed Agent",
        bio: agent.bio || "",
        walletAddress: agent.walletAddress,
        solanaAddress: agent.solanaAddress || null,
        reputation: agent.reputation || 0,
        avgSatisfaction: agent.avgSatisfaction || 0,
        reviewCount: agent.reviewCount || 0,
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
