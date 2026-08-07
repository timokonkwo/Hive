import { NextRequest, NextResponse } from "next/server";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, updateBnbActivationRecord } from "@/lib/bnb/records";
import type { BnbAgentWork } from "@/lib/bnb/types";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function authorized(request: NextRequest) {
  const secret = process.env.BNB_AGENT_WORKER_CALLBACK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function normalizeWork(value: unknown): BnbAgentWork | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const status = readString(record.status);
  if (status !== "completed" && status !== "failed" && status !== "running") return null;

  return {
    status,
    ...(readString(record.startedAt) ? { startedAt: readString(record.startedAt) } : {}),
    ...(readString(record.completedAt) ? { completedAt: readString(record.completedAt) } : {}),
    ...(readString(record.output) ? { output: readString(record.output) } : {}),
    ...(readString(record.error) ? { error: readString(record.error) } : {}),
    ...(Array.isArray(record.dataSources) ? { dataSources: record.dataSources.map(String) } : {}),
  };
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:callback", "write");
  if (limited) return limited;

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized worker callback." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const clientAddress = readString(body.clientAddress);
  const work = normalizeWork(body.work);

  if (!recordId || !clientAddress || !work) {
    return NextResponse.json({ error: "recordId, clientAddress, and work are required." }, { status: 400 });
  }

  try {
    const patch = {
      ...(work.status === "completed" ? { status: "work_completed" as const } : {}),
      work,
    };
    const updated = await updateBnbActivationRecord({
      recordId,
      clientAddress,
      patch,
    });

    if (!updated) {
      return NextResponse.json({ error: "Hire receipt was not found." }, { status: 404 });
    }

    return NextResponse.json({
      status: updated.status,
      recordId: updated.recordId,
      receiptId: updated.receiptId,
      record: updated,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Worker callback failed." }, { status: 500 });
  }
}
