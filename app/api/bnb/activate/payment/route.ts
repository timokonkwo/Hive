import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, confirmBnbActivationPayment } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:payment", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to update this payment." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const transactionHash = readString(body.transactionHash);

  if (!recordId || !transactionHash) {
    return NextResponse.json({ error: "recordId and transactionHash are required" }, { status: 400 });
  }

  let record;
  try {
    record = await confirmBnbActivationPayment({ recordId, clientAddress: client.userId, transactionHash });
  } catch (error) {
    if (error instanceof BnbTransactionVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment record was not updated." }, { status: 500 });
  }

  if (!record) {
    return NextResponse.json({ error: "Hire record was not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: record.status,
    message: record.status === "payment_confirmed" ? "Escrow payment confirmed." : "Payment submitted.",
    receiptId: record.receiptId,
    recordId: record.recordId,
    payment: record.payment,
    record,
  });
}
