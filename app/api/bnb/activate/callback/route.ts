import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { applyBnbActivationWorkResult } from "@/lib/bnb/execution-orchestrator";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord, publicBnbActivationRecord } from "@/lib/bnb/records";
import type { BnbAgentWork } from "@/lib/bnb/types";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readBoundedString(value: unknown, maxLength: number) {
  return readString(value).slice(0, maxLength);
}

function authorized(request: NextRequest) {
  const secret = process.env.BNB_AGENT_WORKER_CALLBACK_SECRET?.trim();
  if (!secret) return false;
  return safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeWork(value: unknown): BnbAgentWork | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const status = readString(record.status);
  if (status !== "completed" && status !== "failed" && status !== "running") return null;

  return {
    status,
    ...(readBoundedString(record.startedAt, 64) ? { startedAt: readBoundedString(record.startedAt, 64) } : {}),
    ...(readBoundedString(record.completedAt, 64) ? { completedAt: readBoundedString(record.completedAt, 64) } : {}),
    ...(readBoundedString(record.output, 384 * 1024) ? { output: readBoundedString(record.output, 384 * 1024) } : {}),
    ...(readBoundedString(record.error, 2_000) ? { error: readBoundedString(record.error, 2_000) } : {}),
    ...(Array.isArray(record.dataSources) ? {
      dataSources: record.dataSources.slice(0, 32).map((source) => readBoundedString(source, 2_048)).filter(Boolean),
    } : {}),
    ...(readBoundedString(record.adapter, 32) ? { adapter: readBoundedString(record.adapter, 32) } : {}),
    ...(readBoundedString(record.runId, 256) ? { runId: readBoundedString(record.runId, 256) } : {}),
  };
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "activate:callback", "write");
  if (limited) return limited;

  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized worker callback." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const recordId = readString(body.recordId);
  const attemptId = readString(body.attemptId);
  const work = normalizeWork(body.work);

  if (!recordId || !attemptId || !work) {
    return NextResponse.json({ error: "recordId, attemptId, and work are required." }, { status: 400 });
  }

  try {
    const record = await getBnbActivationRecord({
      recordId,
    });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found." }, { status: 404 });
    }
    if (record.execution?.attemptId !== attemptId) {
      return NextResponse.json({ error: "This run is no longer active." }, { status: 409 });
    }
    if (record.execution.state !== "running" || record.status !== "running") {
      return NextResponse.json({
        status: record.status,
        recordId: record.recordId,
        receiptId: record.receiptId,
        record: publicBnbActivationRecord(record),
      });
    }

    const outcome = await applyBnbActivationWorkResult({
      record,
      clientAddress: record.clientAddress,
      work,
      failedHttpStatus: 200,
      mismatchHttpStatus: 200,
    });

    return NextResponse.json({
      status: outcome.status,
      recordId: outcome.record?.recordId || record.recordId,
      receiptId: outcome.record?.receiptId || record.receiptId,
      record: outcome.record ? publicBnbActivationRecord(outcome.record) : null,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Worker callback failed." }, { status: 500 });
  }
}
