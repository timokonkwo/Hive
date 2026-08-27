import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { BnbTransactionVerificationError } from "@/lib/bnb/errors";
import { getBnbAgent, getBnbAltanaSessionTemplates } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { getBnbRuntimeReadiness } from "@/lib/bnb/runtime";
import { buildBnbSessionGrantRequest } from "@/lib/bnb/session";
import { BnbStorageError, confirmBnbAltanaSessionGrant, createBnbAltanaSessionRecord } from "@/lib/bnb/records";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "altana:session", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "save a wallet alert");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const grantTransactionHash = readString(body.grantTransactionHash || body.transactionHash);

  if (recordId && grantTransactionHash) {
    try {
      const record = await confirmBnbAltanaSessionGrant({
        recordId,
        clientAddress: auth.client.userId,
        transactionHash: grantTransactionHash,
      });

      if (!record) {
        return NextResponse.json({ error: "Wallet alert was not found" }, { status: 404 });
      }

      return NextResponse.json({
        status: record.status,
        message: record.status === "active" ? "Wallet alert active on BSC." : "Session grant submitted.",
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
      return NextResponse.json({ error: error instanceof Error ? error.message : "Session grant was not confirmed." }, { status: 500 });
    }
  }

  const templateId = readString(body.templateId);
  const walletLabel = readString(body.walletLabel);
  const walletAddress = readString(body.walletAddress);
  const trigger = readString(body.trigger || body.threshold);
  const budget = readString(body.budget);

  if (!templateId) {
    return NextResponse.json({ error: "Choose an alert type." }, { status: 400 });
  }

  const readiness = getBnbRuntimeReadiness();
  if (!readiness.actions.canGrantSession) {
    const error = readiness.storage.ready
      ? "BNB session registry is not configured."
      : "BNB record storage is not configured.";
    return NextResponse.json({ error }, { status: 503 });
  }

  const template = getBnbAltanaSessionTemplates().find((item) => item.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown alert type" }, { status: 404 });
  }

  try {
    const record = await createBnbAltanaSessionRecord({
      template,
      walletLabel,
      walletAddress,
      trigger,
      budget,
      clientAddress: auth.client.userId,
    });
    const agent = template.agentTokenId ? await getBnbAgent(56, template.agentTokenId) : null;
    const grantRequest = agent
      ? buildBnbSessionGrantRequest(record, agent)
      : { status: "not_ready", reason: "The wallet alert agent is not configured." };

    return NextResponse.json({
      status: record.status,
      message: grantRequest.status === "ready" ? "Wallet alert saved. Confirm the BSC session grant." : "Wallet alert saved.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      storage: record.storage,
      grantRequest,
      alert: record,
      record,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save wallet alert." }, { status: 500 });
  }
}
