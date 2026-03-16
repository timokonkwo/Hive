import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { authenticateRequest } from "@/lib/api-key";

// GET /api/tasks/[id]/bids — List bids for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`read-bids:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();

    const bids = await db
      .collection(COLLECTIONS.BIDS)
      .find({ taskId: id })
      .sort({ createdAt: -1 })
      .toArray();

    // Verify agents still exist (filter out bids from deleted agents)
    // Extract both agentId and agentAddress to handle old and new bids
    const agentIds = bids.map(b => b.agentId).filter(Boolean).map(id => {
      try { return new ObjectId(id); } catch { return id; }
    });
    const agentAddresses = bids.map(b => b.agentAddress).filter(Boolean);

    let validAgents: any[] = [];
    if (agentIds.length > 0 || agentAddresses.length > 0) {
       validAgents = await db.collection(COLLECTIONS.AGENTS).find({
         $or: [
           { _id: { $in: agentIds } },
           { walletAddress: { $in: agentAddresses.map(a => new RegExp(`^${a}$`, 'i')) } }
         ]
       }).toArray();
    }

    const validAgentIds = new Set(validAgents.map(a => a._id.toString()));
    const validAgentAddresses = new Set(validAgents.map(a => a.walletAddress?.toLowerCase()).filter(Boolean));

    const validBids = bids.filter(b => {
      // If the bid has an agentId, check if it's in the valid set
      if (b.agentId) return validAgentIds.has(b.agentId);
      // For legacy bids without agentId, check wallet address
      if (b.agentAddress) return validAgentAddresses.has(b.agentAddress.toLowerCase());
      return false; // No agent identifier, invalid bid
    });

    const mapped = validBids.map((b) => ({
      ...b,
      id: b._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json({ bids: mapped });
  } catch (error) {
    console.error("GET /api/tasks/[id]/bids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/bids — Submit a bid / proposal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Rate limit: 10 bids per minute per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`submit-bid:${ip}`, RATE_LIMITS.SUBMIT_BID);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const body = await request.json();

    const { agentAddress, agentName, amount, timeEstimate, coverLetter } = body;

    if (!amount || !coverLetter) {
      return NextResponse.json(
        { error: "amount and coverLetter are required" },
        { status: 400 }
      );
    }

    // Verify task exists
    let task;
    try {
      task = await db
        .collection(COLLECTIONS.TASKS)
        .findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status !== "Open") {
      return NextResponse.json(
        { error: "Task is not accepting bids" },
        { status: 400 }
      );
    }

    // Try API key auth first, then fall back to wallet address lookup
    let agent: any = null;
    let resolvedAgentAddress = agentAddress;

    // Try authenticateRequest (API key or wallet header)
    const auth = await authenticateRequest(request.headers, db);
    if (auth) {
      agent = auth.agent;
      resolvedAgentAddress = agent.walletAddress || agentAddress || agent.id;
    }

    // Fall back to wallet address lookup for backward compat
    if (!agent && agentAddress) {
      agent = await db.collection(COLLECTIONS.AGENTS).findOne({
        walletAddress: { $regex: new RegExp(`^${agentAddress}$`, 'i') },
      });
      if (agent) {
        agent = { ...agent, id: agent._id.toString(), _id: undefined };
      }
    }

    if (!agent) {
      return NextResponse.json(
        { error: "Only registered agents can submit proposals. Register at /agent/register first, and provide your API key via x-hive-api-key header." },
        { status: 403 }
      );
    }

    // Use the agent's real registered name
    const resolvedAgentName = agent.name || agentName || `Agent ${agentAddress.slice(0, 6)}`;

    const bid = {
      taskId: id,
      agentAddress,
      agentId: agent._id.toString(),
      agentName: resolvedAgentName,
      amount,
      timeEstimate: timeEstimate || "TBD",
      coverLetter,
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // Update proposals count on the task
    await db
      .collection(COLLECTIONS.TASKS)
      .updateOne({ _id: new ObjectId(id) }, { $inc: { proposalsCount: 1 } });

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: "BidSubmitted",
      taskId: new ObjectId(id),
      actorAddress: agentAddress,
      actorName: agentName || `Agent ${agentAddress.slice(0, 6)}`,
      metadata: { amount, timeEstimate, taskTitle: task.title },
      createdAt: new Date(),
    });

    return NextResponse.json(
      { id: result.insertedId.toString(), ...bid },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tasks/[id]/bids error:", error);
    return NextResponse.json(
      { error: "Failed to submit bid" },
      { status: 500 }
    );
  }
}
