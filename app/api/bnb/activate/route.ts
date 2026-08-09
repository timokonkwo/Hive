import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { buildBnbEscrowPaymentRequest, isNativeBnbBudget } from "@/lib/bnb/escrow";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, createBnbActivationRecord } from "@/lib/bnb/records";
import { getBnbHireBlocker } from "@/lib/bnb/runtime";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to hire an agent." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const chainId = String(body.chainId || "").trim();
  const tokenId = String(body.tokenId || "").trim();
  const taskTemplate = readString(body.taskTemplate) || "Custom task";
  const taskDetails = readString(body.taskDetails);
  const spendCap = typeof body.spendCap === "string" || typeof body.spendCap === "number" ? String(body.spendCap) : "unset";
  const expiry = readString(body.expiry) || "24 hours";

  if (!chainId || !tokenId) {
    return NextResponse.json({ error: "chainId and tokenId are required" }, { status: 400 });
  }

  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found" }, { status: 404 });
  }

  const hireBlocker = getBnbHireBlocker(agent);
  if (hireBlocker) {
    return NextResponse.json({ error: hireBlocker }, { status: hireBlocker.includes("not configured") ? 503 : 409 });
  }

  if (!isNativeBnbBudget(spendCap)) {
    return NextResponse.json({ error: "Enter a BNB budget, for example 0.01 BNB." }, { status: 400 });
  }

  try {
    const record = await createBnbActivationRecord({
      agent,
      taskTemplate: taskDetails ? `${taskTemplate}: ${taskDetails}` : taskTemplate,
      spendCap,
      expiry,
      clientAddress: client.userId,
    });
    const paymentRequest = buildBnbEscrowPaymentRequest(record);

    return NextResponse.json({
      status: "saved",
      message: paymentRequest.status === "ready" ? "Hire saved. Confirm the wallet transaction to fund escrow." : "Hire saved.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      agent: record.agent,
      limits: record.limits,
      paymentRequest,
      storage: record.storage,
      record,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save hire." }, { status: 500 });
  }
}
