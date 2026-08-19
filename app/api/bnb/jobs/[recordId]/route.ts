import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { buildBnbEscrowPaymentRequest } from "@/lib/bnb/escrow";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord } from "@/lib/bnb/records";
import { shouldRequireBnbEscrow } from "@/lib/bnb/runtime";

type Params = Promise<{ recordId: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const limited = enforceBnbRateLimit(request, "jobs:detail", "read");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "view this job");
  if (auth.response) return auth.response;

  const { recordId } = await params;
  const cleanRecordId = decodeURIComponent(recordId || "").trim();
  if (!cleanRecordId) {
    return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
  }

  try {
    const record = await getBnbActivationRecord({ recordId: cleanRecordId, clientAddress: auth.client.userId });
    if (!record) {
      return NextResponse.json({ error: "Job was not found." }, { status: 404 });
    }

    const agent = await getBnbAgent(record.agent.chainId, record.agent.tokenId);
    const paymentRequired = agent ? shouldRequireBnbEscrow(agent) : record.limits.walletConfirmationRequired !== false;
    const paymentRequest = record.payment?.transactionStatus === "success"
      ? null
      : paymentRequired
        ? buildBnbEscrowPaymentRequest(record)
        : {
          status: "not_required" as const,
          reason: "Ready to run.",
        };
    return NextResponse.json({ record, paymentRequest });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load job." }, { status: 500 });
  }
}
