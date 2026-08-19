import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import {
  buildBnbEscrowSettlementRequest,
  readBnbEscrowJob,
  readBnbEscrowSettlement,
  type BnbEscrowSettlementAction,
} from "@/lib/bnb/escrow";
import type { BnbActivationRecord } from "@/lib/bnb/types";
import { BnbStorageError, getBnbActivationRecord, updateBnbActivationRecord } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asSettlementAction(value: string): BnbEscrowSettlementAction | null {
  if (value === "release" || value === "refund") return value;
  return null;
}

async function withVerifiedEscrowExpiry(record: BnbActivationRecord): Promise<BnbActivationRecord> {
  const payment = record.payment;
  const jobId = payment?.jobId;
  if (!payment || !jobId || payment.expiresAt) return record;

  const snapshot = await readBnbEscrowJob(jobId);
  if (snapshot.status !== "funded") return record;

  return {
    ...record,
    payment: {
      ...payment,
      expiresAt: snapshot.expiresAt,
    },
  };
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:settlement", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "update escrow");
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId);
    const action = asSettlementAction(readString(body.action));
    const transactionHash = readString(body.transactionHash);

    if (!recordId || !action) {
      return NextResponse.json({ error: "recordId and action are required" }, { status: 400 });
    }

    const record = await getBnbActivationRecord({ recordId, clientAddress: auth.client.userId });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found" }, { status: 404 });
    }

    if (record.status === "paid" || record.status === "released" || record.status === "refunded") {
      return NextResponse.json({ error: "This escrow receipt is already closed." }, { status: 409 });
    }

    if (record.limits.walletConfirmationRequired === false || !record.payment?.jobId || record.payment.transactionStatus !== "success") {
      return NextResponse.json({ error: "This action is not available for this job." }, { status: 409 });
    }

    if (action === "release" && record.delivery?.status !== "delivered" && record.work?.status !== "completed") {
      return NextResponse.json({ error: "Review the agent delivery before releasing payment." }, { status: 409 });
    }

    const settlementRecord = action === "refund" ? await withVerifiedEscrowExpiry(record) : record;
    if (action === "refund" && settlementRecord !== record && settlementRecord.payment?.expiresAt) {
      await updateBnbActivationRecord({
        recordId,
        clientAddress: auth.client.userId,
        patch: {
          payment: settlementRecord.payment,
        },
      });
    }

    if (!transactionHash) {
      return NextResponse.json({
        status: "ready",
        recordId: record.recordId,
        receiptId: record.receiptId,
        settlementRequest: buildBnbEscrowSettlementRequest(settlementRecord, action),
      });
    }

    const prepared = buildBnbEscrowSettlementRequest(settlementRecord, action);
    if (prepared.status !== "ready") {
      return NextResponse.json({ error: prepared.reason, settlementRequest: prepared }, { status: 409 });
    }

    const settlement = await readBnbEscrowSettlement(transactionHash, action, settlementRecord.payment?.jobId);
    const status =
      settlement.transactionStatus === "success"
        ? action === "release" ? "paid" : "refunded"
        : action === "release" ? "release_submitted" : "refund_submitted";

    const updated = await updateBnbActivationRecord({
      recordId,
      clientAddress: auth.client.userId,
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
