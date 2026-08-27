import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { recordBnbIncident } from "@/lib/bnb/incidents";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, confirmBnbActivationPayment, confirmBnbActivationX402Payment, publicBnbActivationRecord } from "@/lib/bnb/records";
import { BnbX402PaymentError } from "@/lib/bnb/x402";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "activate:payment", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "update this payment");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const transactionHash = readString(body.transactionHash);
  const paymentHeader = readString(body.paymentHeader);

  if (!recordId || (!transactionHash && !paymentHeader)) {
    return NextResponse.json({ error: "recordId and payment confirmation are required" }, { status: 400 });
  }

  let record;
  try {
    record = paymentHeader
      ? await confirmBnbActivationX402Payment({ recordId, clientAddress: auth.client.userId, paymentHeader })
      : await confirmBnbActivationPayment({ recordId, clientAddress: auth.client.userId, transactionHash });
  } catch (error) {
    recordBnbIncident({
      kind: "payment.failed",
      route: "api.bnb.activate.payment",
      recordId,
      status: error instanceof BnbStorageError ? "storage_failed" : error instanceof BnbTransactionVerificationError || error instanceof BnbX402PaymentError ? "verification_failed" : "failed",
      reason: error,
    });
    if (error instanceof BnbTransactionVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BnbX402PaymentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes("not available") ? 409 : 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment record was not updated." }, { status: 500 });
  }

  if (!record) {
    return NextResponse.json({ error: "Hire record was not found" }, { status: 404 });
  }

  recordBnbAnalyticsEvent({
    name: "payment.updated",
    route: "api.bnb.activate.payment",
    clientAddress: auth.client.userId,
    agent: record.agent,
    recordId: record.recordId,
    receiptId: record.receiptId,
    status: record.status,
    ok: record.payment?.transactionStatus === "success",
    metadata: {
      transactionStatus: record.payment?.transactionStatus || "unknown",
      paymentMode: record.payment?.mode || "escrow",
    },
  });
  if (record.payment?.transactionStatus === "reverted") {
    recordBnbIncident({
      kind: "payment.failed",
      route: "api.bnb.activate.payment",
      record,
      status: record.status,
      reason: "Payment transaction reverted.",
      metadata: {
        transactionStatus: record.payment.transactionStatus,
      },
    });
  }

  const publicRecord = publicBnbActivationRecord(record);
  return NextResponse.json({
    status: record.status,
    message: record.status === "funded" || record.status === "payment_confirmed" ? "Payment confirmed." : "Payment submitted.",
    receiptId: record.receiptId,
    recordId: record.recordId,
    payment: publicRecord.payment,
    record: publicRecord,
  });
}
