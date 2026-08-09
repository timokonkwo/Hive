import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import {
  buildBnbEscrowSettlementRequest,
  readBnbEscrowSettlement,
  type BnbEscrowSettlementAction,
} from "@/lib/bnb/escrow";
import { BnbStorageError, getBnbActivationRecord, updateBnbActivationRecord } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asSettlementAction(value: string): BnbEscrowSettlementAction | null {
  if (value === "release" || value === "refund") return value;
  return null;
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:settlement", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to update escrow." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId);
    const action = asSettlementAction(readString(body.action));
    const transactionHash = readString(body.transactionHash);

    if (!recordId || !action) {
      return NextResponse.json({ error: "recordId and action are required" }, { status: 400 });
    }

    const record = await getBnbActivationRecord({ recordId, clientAddress: client.userId });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found" }, { status: 404 });
    }

    if (record.status === "released" || record.status === "refunded") {
      return NextResponse.json({ error: "This escrow receipt is already closed." }, { status: 409 });
    }

    if (action === "release" && record.work?.status !== "completed") {
      return NextResponse.json({ error: "Agent work must be completed before release." }, { status: 409 });
    }

    if (!transactionHash) {
      return NextResponse.json({
        status: "ready",
        recordId: record.recordId,
        receiptId: record.receiptId,
        settlementRequest: buildBnbEscrowSettlementRequest(record, action),
      });
    }

    const settlement = await readBnbEscrowSettlement(transactionHash, action, record.payment?.jobId);
    const status =
      settlement.transactionStatus === "success"
        ? action === "release" ? "released" : "refunded"
        : action === "release" ? "release_submitted" : "refund_submitted";

    const updated = await updateBnbActivationRecord({
      recordId,
      clientAddress: client.userId,
      patch: {
        status,
        settlement: {
          action,
          transactionHash: settlement.transactionHash,
          transactionStatus: settlement.transactionStatus,
          explorerUrl: settlement.explorerUrl,
          blockNumber: settlement.blockNumber,
        },
      },
    });

    return NextResponse.json({
      status: updated?.status || status,
      message: settlement.transactionStatus === "success" ? "Escrow updated on BSC." : "Escrow transaction submitted.",
      record: updated,
      settlement,
    });
  } catch (error) {
    if (error instanceof BnbTransactionVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update escrow." }, { status: 500 });
  }
}
