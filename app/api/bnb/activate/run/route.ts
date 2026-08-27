import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { bnbExecutionWalletAddress, runBnbActivationRecord } from "@/lib/bnb/execution-orchestrator";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord, publicBnbActivationRecord } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "activate:run", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "run an agent");
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId);

    if (!recordId) {
      return NextResponse.json({ error: "recordId is required" }, { status: 400 });
    }

    const record = await getBnbActivationRecord({ recordId, clientAddress: auth.client.userId });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found" }, { status: 404 });
    }

    const agent = await getBnbAgent(record.agent.chainId, record.agent.tokenId);
    if (!agent) {
      return NextResponse.json({ error: "Agent is no longer available." }, { status: 409 });
    }

    const outcome = await runBnbActivationRecord({
      record,
      agent,
      clientAddress: auth.client.userId,
      walletAddress: bnbExecutionWalletAddress(auth.client.address, request.headers.get("x-hive-bnb-wallet-address")),
    });
    const { httpStatus, ...payload } = outcome;
    return NextResponse.json({
      ...payload,
      record: payload.record ? publicBnbActivationRecord(payload.record) : null,
    }, { status: httpStatus });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run agent." }, { status: 500 });
  }
}
