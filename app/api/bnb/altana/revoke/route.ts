import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { buildBnbSessionRevokeRequest } from "@/lib/bnb/session";
import {
  BnbStorageError,
  confirmBnbAltanaSessionRevoke,
  getBnbAltanaSessionRecord,
} from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "altana:revoke", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to stop a wallet alert." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const revocationNote = readString(body.revocationNote);
  const revokeTransactionHash = readString(body.revokeTransactionHash || body.transactionHash);

  if (!recordId) {
    return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  }

  try {
    if (!revokeTransactionHash) {
      const record = await getBnbAltanaSessionRecord({ recordId, clientAddress: client.userId });
      if (!record) {
        return NextResponse.json({ error: "Wallet alert was not found" }, { status: 404 });
      }

      return NextResponse.json({
        status: "ready",
        receiptId: record.receiptId,
        recordId: record.recordId,
        revokeRequest: buildBnbSessionRevokeRequest(record, revocationNote),
        alert: record,
        record,
      });
    }

    const record = await confirmBnbAltanaSessionRevoke({
      recordId,
      clientAddress: client.userId,
      transactionHash: revokeTransactionHash,
      revocationNote,
    });

    if (!record) {
      return NextResponse.json({ error: "Wallet alert was not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: record.status,
      message: record.status === "stopped" ? "Wallet alert stopped on BSC." : "Revoke transaction submitted.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      storage: record.storage,
      alert: record,
      record,
    });
  } catch (error) {
    if (error instanceof BnbTransactionVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not stop wallet alert." }, { status: 500 });
  }
}
