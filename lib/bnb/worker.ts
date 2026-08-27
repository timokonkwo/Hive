import { safeFetchJson } from "@/lib/bnb/endpoint-security";
import { publicBnbActivationRecord } from "@/lib/bnb/records";
import type { BnbActivationRecord, BnbAgentWork } from "@/lib/bnb/types";

export type BnbWorkerResult =
  | {
      mode: "sync";
      work: BnbAgentWork;
    }
  | {
      mode: "async";
      work: BnbAgentWork;
      workerJobId?: string;
    };

function getWorkerUrl() {
  return process.env.BNB_AGENT_WORKER_URL?.trim().replace(/\/$/, "") || "";
}

export function hasBnbAgentWorker() {
  return Boolean(getWorkerUrl());
}

export async function runBnbAgentWorkOnWorker(record: BnbActivationRecord): Promise<BnbWorkerResult> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error("BNB agent worker is not configured.");
  const attemptId = record.execution?.attemptId;
  if (!attemptId) throw new Error("BNB agent run is not initialized.");
  const callbackUrl = getCallbackUrl();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.BNB_AGENT_WORKER_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const { response, payload } = await safeFetchJson(`${workerUrl}/bnb/jobs/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      record: publicBnbActivationRecord(record),
      callbackUrl,
      attemptId,
    }),
    timeoutMs: 20_000,
    maxBytes: 384 * 1024,
  });
  if (!response.ok) {
    const error = typeof payload === "object" && payload && typeof (payload as Record<string, unknown>).error === "string"
      ? (payload as Record<string, string>).error
      : "BNB agent worker request failed.";
    throw new Error(error);
  }

  const payloadRecord = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  if (response.status === 202 || payloadRecord.status === "accepted") {
    return {
      mode: "async",
      workerJobId: typeof payloadRecord.workerJobId === "string" ? payloadRecord.workerJobId : undefined,
      work: {
        status: "running",
        startedAt: new Date().toISOString(),
        dataSources: ["BNB agent worker"],
      },
    };
  }

  if (!payloadRecord.work || typeof payloadRecord.work !== "object") {
    throw new Error("BNB agent worker did not return a work result.");
  }

  return {
    mode: "sync",
    work: payloadRecord.work as BnbAgentWork,
  };
}

function getCallbackUrl() {
  const siteUrl = (process.env.SITE_URL || process.env.URL || "").trim();
  if (!siteUrl) throw new Error("BNB agent callback URL is not configured.");
  try {
    const callbackUrl = new URL("/api/bnb/activate/callback", siteUrl);
    if (callbackUrl.protocol !== "https:" && callbackUrl.hostname !== "localhost" && callbackUrl.hostname !== "127.0.0.1") {
      throw new Error("Callback URL must use HTTPS.");
    }
    return callbackUrl.toString();
  } catch {
    throw new Error("BNB agent callback URL is not configured.");
  }
}
