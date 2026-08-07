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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.BNB_AGENT_WORKER_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${workerUrl}/bnb/jobs/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      record,
      callbackUrl: `${process.env.SITE_URL || process.env.URL || ""}/api/bnb/activate/callback`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "BNB agent worker request failed.");
  }

  if (response.status === 202 || payload.status === "accepted") {
    return {
      mode: "async",
      workerJobId: typeof payload.workerJobId === "string" ? payload.workerJobId : undefined,
      work: {
        status: "running",
        startedAt: new Date().toISOString(),
        dataSources: ["BNB agent worker"],
      },
    };
  }

  if (!payload.work || typeof payload.work !== "object") {
    throw new Error("BNB agent worker did not return a work result.");
  }

  return {
    mode: "sync",
    work: payload.work as BnbAgentWork,
  };
}
