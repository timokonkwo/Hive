import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import {
  BnbStorageError,
  cancelBnbAccessRequestRecord,
  createBnbAccessRequestRecord,
} from "@/lib/bnb/records";
import { getBnbRuntimeReadiness } from "@/lib/bnb/runtime";

function readString(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "access-request", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to request access." }, { status: 401 });
  }

  const readiness = getBnbRuntimeReadiness();
  if (!readiness.actions.canCreateRequest) {
    return NextResponse.json({ error: "BNB record storage is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const chainId = readString(body.chainId, 32);
    const tokenId = readString(body.tokenId, 128);
    const task = readString(body.task, 1000);
    const budget = readString(body.budget, 120);
    const deadline = readString(body.deadline, 120);
    const contactPreference = readString(body.contactPreference, 240);

    if (!chainId || !tokenId) return validationError("chainId and tokenId are required.");
    if (task.length < 3) return validationError("Describe the work you need.");

    const agent = await getBnbAgent(chainId, tokenId);
    if (!agent) {
      return NextResponse.json({ error: "BNB agent not found." }, { status: 404 });
    }

    const record = await createBnbAccessRequestRecord({
      agent,
      task,
      ...(budget ? { budget } : {}),
      ...(deadline ? { deadline } : {}),
      ...(contactPreference ? { contactPreference } : {}),
      clientAddress: client.userId,
    });

    return NextResponse.json({
      status: record.status,
      message: "Access request saved.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      agent: record.agent,
      record,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save access request." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "access-request:cancel", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to cancel this request." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId, 128);
    const cancelReason = readString(body.cancelReason, 240);

    if (!recordId) return validationError("recordId is required.");

    const record = await cancelBnbAccessRequestRecord({
      recordId,
      clientAddress: client.userId,
      ...(cancelReason ? { cancelReason } : {}),
    });

    if (!record) {
      return NextResponse.json({ error: "Access request was not found." }, { status: 404 });
    }

    return NextResponse.json({
      status: record.status,
      message: "Access request cancelled.",
      record,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel access request." }, { status: 500 });
  }
}
