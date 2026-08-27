import { createHash, randomUUID } from "node:crypto";
import { preflightBnbAgentJob, preflightFromExecutionTarget, runBnbAgentAdapter, selectBnbJobPreflight } from "@/lib/bnb/adapters/registry";
import type { BnbAdapterId, BnbAdapterPreflightResult } from "@/lib/bnb/adapters/types";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBscExplorerTxUrl } from "@/lib/bnb/chain";
import { bnbDeliveryFailureReason, formatBnbDeliveryText, normalizeBnbDelivery } from "@/lib/bnb/delivery";
import { recordBnbIncident } from "@/lib/bnb/incidents";
import { withBnbWalletJobContext } from "@/lib/bnb/jobs";
import { claimBnbActivationRun, commitBnbActivationRunResult, updateBnbActivationRecord } from "@/lib/bnb/records";
import { resolveBnbPaymentMode } from "@/lib/bnb/runtime";
import { sanitizeBnbX402PaymentSnapshot } from "@/lib/bnb/x402";
import type {
  BnbActivationExecution,
  BnbActivationRecord,
  BnbAgentDelivery,
  BnbAgentProfile,
  BnbAgentWork,
  BnbEndpointCapabilityContract,
  BnbExecutionEndpoint,
} from "@/lib/bnb/types";

const RUN_STALE_AFTER_MS = 10 * 60 * 1000;

export type BnbExecutionOutcome = {
  httpStatus: number;
  status: BnbActivationRecord["status"] | "delivered";
  message?: string;
  error?: string;
  record: BnbActivationRecord | null;
  work?: BnbAgentWork;
  delivery?: BnbAgentDelivery;
  adapterPreflight?: BnbAdapterPreflightResult[];
};

export function bnbExecutionWalletAddress(authAddress: string, headerAddress: string | null) {
  return readEvmAddress(authAddress) || readEvmAddress(headerAddress);
}

export function withRunWalletContext(record: BnbActivationRecord, walletAddress: string): BnbActivationRecord {
  if (!record.jobSpec || !walletAddress || record.executionTarget) return record;
  const jobSpec = withBnbWalletJobContext(record.jobSpec, walletAddress);
  if (jobSpec === record.jobSpec) return record;

  return {
    ...record,
    jobSpec,
    limits: {
      ...record.limits,
      task: jobSpec.summary,
    },
  };
}

export async function runBnbActivationRecord({
  record,
  agent,
  clientAddress,
  walletAddress,
  now = new Date(),
}: {
  record: BnbActivationRecord;
  agent: BnbAgentProfile;
  clientAddress?: string;
  walletAddress?: string;
  now?: Date;
}): Promise<BnbExecutionOutcome> {
  const existingOutcome = outcomeForExistingRun(record, now);
  if (existingOutcome) return existingOutcome;

  const paymentMode = paymentModeForRecord(record, agent);
  const paymentReady = paymentMode === "none"
    || (paymentMode === "escrow" && record.payment?.transactionStatus === "success")
    || (
      paymentMode === "x402"
      && record.payment?.mode === "x402"
      && record.payment.transactionStatus === "success"
      && record.payment.x402?.status === "verified"
      && Boolean(record.payment.x402.paymentHeader)
    );
  if (!paymentReady) {
    recordBnbAnalyticsEvent({
      name: "run.failed",
      route: "bnb.execution",
      clientAddress,
      agent,
      recordId: record.recordId,
      receiptId: record.receiptId,
      status: record.status,
      ok: false,
      metadata: {
        reason: "payment_required",
        paymentMode,
        capability: record.jobSpec?.capability || "",
      },
    });
    return {
      httpStatus: 409,
      status: record.status,
      error: "Payment is required before this job can run.",
      record,
      work: record.work,
      delivery: record.delivery,
    };
  }

  const executionRecord = withRunWalletContext(record, walletAddress || "");
  const pinnedPreflight = preflightFromExecutionTarget(executionRecord);
  const adapterPreflight = pinnedPreflight ? [pinnedPreflight] : await preflightBnbAgentJob(agent, executionRecord);
  const runnablePreflight = pinnedPreflight || selectBnbJobPreflight(executionRecord, adapterPreflight);
  if (!runnablePreflight) {
    const reason = adapterPreflight.find((result) => result.reason)?.reason || "This agent cannot run this job.";
    return failBnbActivationRun({
      record: executionRecord,
      clientAddress,
      reason,
      httpStatus: 409,
      adapterPreflight,
    });
  }

  const startedAt = now.toISOString();
  const execution = buildBnbExecutionAudit({
    record: executionRecord,
    agent,
    adapterPreflight: runnablePreflight,
    startedAt,
  });
  const claimed = await claimBnbActivationRun({
    recordId: record.recordId,
    clientAddress,
    staleBefore: new Date(now.getTime() - RUN_STALE_AFTER_MS).toISOString(),
    patch: {
      status: "running",
      jobSpec: executionRecord.jobSpec,
      limits: executionRecord.limits,
      work: {
        status: "running",
        startedAt,
      },
      delivery: {
        status: "running",
        startedAt,
      },
      execution,
    },
  });

  if (!claimed.claimed) {
    if (!claimed.record) {
      return {
        httpStatus: 404,
        status: record.status,
        error: "Hire receipt was not found.",
        record: null,
      };
    }
    return outcomeForExistingRun(claimed.record, now) || {
      httpStatus: 202,
      status: claimed.record.status,
      message: "Run in progress.",
      record: claimed.record,
      work: claimed.record.work,
      delivery: claimed.record.delivery,
    };
  }

  const claimedRecord = claimed.record || executionRecord;
  recordBnbAnalyticsEvent({
    name: "run.started",
    route: "bnb.execution",
    clientAddress,
    agent,
    recordId: claimedRecord.recordId,
    receiptId: claimedRecord.receiptId,
    status: "running",
    ok: true,
    metadata: {
      capability: claimedRecord.jobSpec?.capability || "",
      taskType: claimedRecord.jobSpec?.taskType || "",
      adapter: execution.adapter || "",
      paymentRequired: paymentMode !== "none",
      paymentMode,
    },
  });
  try {
    const work = await runBnbAgentAdapter(agent, claimedRecord, runnablePreflight);
    if (!work) {
      throw new Error("This agent returned no result.");
    }
    return applyBnbActivationWorkResult({
      record: claimedRecord,
      clientAddress,
      work,
    });
  } catch (error) {
    return failBnbActivationRun({
      record: claimedRecord,
      clientAddress,
      reason: error,
      httpStatus: 502,
    });
  }
}

export async function applyBnbActivationWorkResult({
  record,
  clientAddress,
  work,
  failedHttpStatus = 502,
  mismatchHttpStatus = 422,
}: {
  record: BnbActivationRecord;
  clientAddress?: string;
  work: BnbAgentWork;
  failedHttpStatus?: number;
  mismatchHttpStatus?: number;
}): Promise<BnbExecutionOutcome> {
  const now = new Date().toISOString();
  const startedAt = work.startedAt || record.work?.startedAt || record.execution?.startedAt || now;
  const completedAt = work.completedAt || (work.status === "running" ? undefined : now);
  const normalizedDelivery = normalizeBnbDelivery(work.output, record.jobSpec);
  const deliveryText = formatBnbDeliveryText(work.output, record.jobSpec);
  const resultIssue = work.status === "completed" ? bnbDeliveryFailureReason(normalizedDelivery) : "";
  const finalWork: BnbAgentWork = resultIssue
    ? {
      ...work,
      status: "failed",
      startedAt,
      completedAt: completedAt || now,
      error: resultIssue,
    }
    : {
      ...work,
      startedAt,
      ...(completedAt ? { completedAt } : {}),
      ...(work.error ? { error: userFacingBnbExecutionError(work.error) } : {}),
    };
  const isComplete = finalWork.status === "completed";
  const isRunning = finalWork.status === "running";
  const error = finalWork.error ? userFacingBnbExecutionError(finalWork.error) : undefined;
  const delivery: BnbAgentDelivery = {
    status: isComplete ? "delivered" : isRunning ? "running" : "failed",
    ...(deliveryText ? { summary: deliveryText.split("\n").find(Boolean) } : {}),
    ...(finalWork.output ? { rawOutput: finalWork.output } : {}),
    ...(finalWork.dataSources ? { dataSources: finalWork.dataSources } : {}),
    ...(finalWork.adapter ? { adapter: finalWork.adapter } : {}),
    ...(finalWork.runId ? { runId: finalWork.runId } : {}),
    startedAt,
    ...(completedAt || finalWork.completedAt ? { completedAt: finalWork.completedAt || completedAt } : {}),
    ...(error ? { error } : {}),
  };
  const execution = executionWithWork(record.execution, finalWork, delivery.status, error);
  const settledPayment = finalizedX402Payment(record, finalWork);
  const committed = await commitBnbActivationRunResult({
    recordId: record.recordId,
    clientAddress,
    attemptId: record.execution?.attemptId || "",
    patch: {
      status: isComplete ? "delivered" : isRunning ? "running" : "failed",
      work: finalWork,
      delivery,
      ...(execution ? { execution } : {}),
      ...(settledPayment ? { payment: settledPayment } : {}),
    },
  });
  const updated = committed.record;
  if (!committed.applied) {
    return outcomeForExistingRun(updated || record, new Date()) || {
      httpStatus: updated ? 409 : 404,
      status: updated?.status || record.status,
      error: updated ? "This run has already changed." : "Hire receipt was not found.",
      record: updated,
      work: updated?.work,
      delivery: updated?.delivery,
    };
  }
  if (!isRunning) {
    recordBnbAnalyticsEvent({
      name: isComplete ? "run.completed" : "run.failed",
      route: "bnb.execution",
      clientAddress,
      agent: updated?.agent || record.agent,
      recordId: record.recordId,
      receiptId: record.receiptId,
      status: updated?.status || (isComplete ? "delivered" : "failed"),
      ok: isComplete,
      durationMs: durationMs(startedAt, finalWork.completedAt || completedAt),
      metadata: {
        capability: record.jobSpec?.capability || "",
        taskType: record.jobSpec?.taskType || "",
        adapter: finalWork.adapter || execution?.adapter || "",
        hasSources: Boolean(finalWork.dataSources?.length),
      },
    });
  }
  if (!isRunning && !isComplete) {
    recordBnbIncident({
      kind: "run.failed",
      route: "bnb.execution",
      record: updated || record,
      agent: updated?.agent || record.agent,
      status: updated?.status || "failed",
      reason: error || finalWork.error || "Agent run failed.",
      metadata: {
        capability: record.jobSpec?.capability || "",
        taskType: record.jobSpec?.taskType || "",
        adapter: finalWork.adapter || execution?.adapter || "",
        resultRejected: Boolean(resultIssue),
      },
    });
  }
  if (isComplete) {
    recordBnbAnalyticsEvent({
      name: "delivery.ready",
      route: "bnb.execution",
      clientAddress,
      agent: updated?.agent || record.agent,
      recordId: record.recordId,
      receiptId: record.receiptId,
      status: updated?.status || "delivered",
      ok: true,
      durationMs: durationMs(startedAt, finalWork.completedAt || completedAt),
      metadata: {
        capability: record.jobSpec?.capability || "",
        taskType: record.jobSpec?.taskType || "",
        adapter: finalWork.adapter || execution?.adapter || "",
        hasSources: Boolean(finalWork.dataSources?.length),
      },
    });
  }

  return {
    httpStatus: isComplete ? 200 : isRunning ? 202 : resultIssue ? mismatchHttpStatus : failedHttpStatus,
    status: updated?.status || (isComplete ? "delivered" : isRunning ? "running" : "failed"),
    message: isComplete ? "Delivery is ready." : isRunning ? "Run in progress." : undefined,
    ...(error ? { error } : {}),
    record: updated,
    work: finalWork,
    delivery: updated?.delivery || delivery,
  };
}

async function failBnbActivationRun({
  record,
  clientAddress,
  reason,
  httpStatus,
  adapterPreflight,
}: {
  record: BnbActivationRecord;
  clientAddress?: string;
  reason: unknown;
  httpStatus: number;
  adapterPreflight?: BnbAdapterPreflightResult[];
}): Promise<BnbExecutionOutcome> {
  const now = new Date().toISOString();
  const error = userFacingBnbExecutionError(reason);
  const startedAt = record.work?.startedAt || record.execution?.startedAt || now;
  const work: BnbAgentWork = {
    status: "failed",
    startedAt,
    completedAt: now,
    error,
  };
  const delivery: BnbAgentDelivery = {
    status: "failed",
    startedAt,
    completedAt: now,
    error,
  };
  const execution = executionWithWork(record.execution, work, "failed", error);
  const failurePatch: Partial<BnbActivationRecord> = {
    status: "failed",
    work,
    delivery,
    ...(execution ? { execution } : {}),
  };
  const committed = record.execution?.attemptId
    ? await commitBnbActivationRunResult({
        recordId: record.recordId,
        clientAddress,
        attemptId: record.execution.attemptId,
        patch: failurePatch,
      })
    : {
        applied: true,
        record: await updateBnbActivationRecord({
          recordId: record.recordId,
          clientAddress,
          patch: failurePatch,
        }),
      };
  const updated = committed.record;
  if (!committed.applied) {
    return outcomeForExistingRun(updated || record, new Date()) || {
      httpStatus: updated ? 409 : 404,
      status: updated?.status || record.status,
      error: updated ? "This run has already changed." : "Hire receipt was not found.",
      record: updated,
      work: updated?.work,
      delivery: updated?.delivery,
      ...(adapterPreflight ? { adapterPreflight } : {}),
    };
  }
  recordBnbAnalyticsEvent({
    name: "run.failed",
    route: "bnb.execution",
    clientAddress,
    agent: updated?.agent || record.agent,
    recordId: record.recordId,
    receiptId: record.receiptId,
    status: updated?.status || "failed",
    ok: false,
    durationMs: durationMs(startedAt, now),
    metadata: {
      capability: record.jobSpec?.capability || "",
      taskType: record.jobSpec?.taskType || "",
      hasAdapterPreflight: Boolean(adapterPreflight?.length),
    },
  });
  recordBnbIncident({
    kind: "run.failed",
    route: "bnb.execution",
    record: updated || record,
    agent: updated?.agent || record.agent,
    status: updated?.status || "failed",
    reason: error,
    metadata: {
      capability: record.jobSpec?.capability || "",
      taskType: record.jobSpec?.taskType || "",
      hasAdapterPreflight: Boolean(adapterPreflight?.length),
    },
  });

  return {
    httpStatus,
    status: updated?.status || "failed",
    error,
    record: updated,
    work,
    delivery: updated?.delivery || delivery,
    ...(adapterPreflight ? { adapterPreflight } : {}),
  };
}

function outcomeForExistingRun(record: BnbActivationRecord, now: Date): BnbExecutionOutcome | null {
  if (record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed") {
    return {
      httpStatus: 200,
      status: record.status === "work_completed" ? "delivered" : record.status,
      message: "Delivery is ready.",
      record,
      work: record.work,
      delivery: record.delivery,
    };
  }

  if ((record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running") && !runningRecordIsStale(record, now)) {
    return {
      httpStatus: 202,
      status: record.status,
      message: "Run in progress.",
      record,
      work: record.work,
      delivery: record.delivery,
    };
  }

  return null;
}

function runningRecordIsStale(record: BnbActivationRecord, now: Date) {
  const startedAt = record.work?.startedAt || record.delivery?.startedAt || record.execution?.startedAt;
  if (!startedAt) return false;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return false;
  return now.getTime() - started > RUN_STALE_AFTER_MS;
}

function buildBnbExecutionAudit({
  record,
  agent,
  adapterPreflight,
  startedAt,
}: {
  record: BnbActivationRecord;
  agent: BnbAgentProfile;
  adapterPreflight: BnbAdapterPreflightResult;
  startedAt: string;
}): BnbActivationExecution {
  const endpoint = auditEndpoint(adapterPreflight.endpoint || endpointForAdapter(agent, adapterPreflight.adapter));
  const capability = auditCapability(record.jobSpec?.endpointCapability);
  const requestArgs = requestArgsForAudit(record);
  const jobHash = hash(stableStringify(record.jobSpec || record.limits.task));
  const requestHash = hash(stableStringify({
    agent: {
      chainId: record.agent.chainId,
      tokenId: record.agent.tokenId,
      wallet: record.agent.agentWallet,
    },
    jobHash,
    endpoint: endpoint?.url || "",
    capability: capability?.name || record.jobSpec?.taskType || "",
    requestArgs,
  }));

  return {
    state: "running",
    attemptId: randomUUID(),
    idempotencyKey: `bnb-run:${record.recordId}:${requestHash.slice(0, 16)}`,
    requestHash,
    jobHash,
    adapter: adapterId(adapterPreflight.adapter || endpoint?.adapter),
    ...(endpoint ? { endpoint } : {}),
    ...(capability ? { capability } : {}),
    ...(Object.keys(requestArgs).length > 0 ? { requestArgs } : {}),
    startedAt,
  };
}

function executionWithWork(
  execution: BnbActivationExecution | undefined,
  work: BnbAgentWork,
  state: BnbAgentDelivery["status"],
  error?: string,
): BnbActivationExecution | undefined {
  if (!execution) return undefined;
  const executionState = state === "delivered" ? "completed" : state === "running" ? "running" : "failed";
  return {
    ...execution,
    state: executionState,
    ...(adapterId(work.adapter) ? { adapter: adapterId(work.adapter) } : {}),
    ...(work.dataSources ? { sources: work.dataSources } : {}),
    ...(work.runId ? { runId: work.runId } : {}),
    ...(work.startedAt || execution.startedAt ? { startedAt: work.startedAt || execution.startedAt } : {}),
    ...(work.completedAt ? { completedAt: work.completedAt } : {}),
    ...(error ? { error } : {}),
  };
}

export function userFacingBnbExecutionError(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Agent run failed.";
  if (/payment is required before this job can run/i.test(message)) return "Payment is required before this job can run.";
  if (/not available for jobs|cannot run this job|returned no result|different result|payment method that is not available/i.test(message)) return message;
  if (/required|missing|invalid/i.test(message) && !/\b(?:MCP|A2A|x402|HTTP|endpoint|JSON-RPC|tool|schema)\b/i.test(message)) return message;
  if (/\b(?:401|403|unauthorized|forbidden|session|token|credential)\b/i.test(message)) return "This agent is not available for jobs right now.";
  if (/\b(?:MCP|A2A|x402|HTTP|endpoint|JSON-RPC|Bad Gateway|tool|schema|adapter|fetch failed|network)\b/i.test(message)) return "This agent could not complete the job.";
  return message || "Agent run failed.";
}

function requestArgsForAudit(record: BnbActivationRecord) {
  const fields = record.jobSpec?.fields || {};
  return Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key, String(value).trim()] as const)
      .filter(([, value]) => Boolean(value))
  );
}

function auditEndpoint(endpoint: BnbExecutionEndpoint | undefined): BnbActivationExecution["endpoint"] | undefined {
  if (!endpoint || endpoint.adapter === "web") return undefined;
  return {
    adapter: endpoint.adapter,
    url: endpoint.url,
    label: endpoint.label,
    verified: endpoint.verified,
    source: endpoint.source,
  };
}

function endpointForAdapter(agent: BnbAgentProfile, adapter: BnbAdapterId) {
  return agent.executionEndpoints?.find((endpoint) => endpoint.adapter === adapter || (adapter === "http" && endpoint.adapter === "x402"));
}

function auditCapability(capability: BnbEndpointCapabilityContract | undefined): BnbActivationExecution["capability"] | undefined {
  if (!capability) return undefined;
  return {
    name: capability.name,
    kind: capability.kind,
    ...(capability.description ? { description: capability.description } : {}),
    ...(capability.tags ? { tags: capability.tags } : {}),
    ...(capability.paymentRequired !== undefined ? { paymentRequired: capability.paymentRequired } : {}),
  };
}

function adapterId(value: string | undefined): BnbAdapterId | undefined {
  if (value === "mcp" || value === "a2a" || value === "x402" || value === "http") return value;
  return undefined;
}

function readEvmAddress(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^0x[a-fA-F0-9]{40}$/.test(text) ? text : "";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function durationMs(startedAt: string | undefined, completedAt: string | undefined) {
  if (!startedAt || !completedAt) return undefined;
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) return undefined;
  return Math.max(0, completed - started);
}

function finalizedX402Payment(record: BnbActivationRecord, work: BnbAgentWork): BnbActivationRecord["payment"] | undefined {
  if (work.paymentSettlement?.mode !== "x402" || record.payment?.mode !== "x402" || !record.payment.x402) return undefined;
  const x402 = sanitizeBnbX402PaymentSnapshot(record.payment.x402);
  if (!x402) return undefined;
  const transaction = work.paymentSettlement.transaction || x402.transaction || "";
  return {
    ...record.payment,
    transactionHash: transaction || record.payment.transactionHash,
    transactionStatus: "success",
    explorerUrl: transaction ? getBscExplorerTxUrl(transaction) : record.payment.explorerUrl,
    x402: {
      ...x402,
      status: work.paymentSettlement.status,
      transaction: transaction || undefined,
      network: work.paymentSettlement.network || x402.network,
      payer: work.paymentSettlement.payer || x402.payer,
      settledAt: work.paymentSettlement.settledAt,
      error: work.paymentSettlement.status === "unconfirmed" ? "Settlement receipt was not returned." : undefined,
    },
  };
}

function paymentModeForRecord(record: BnbActivationRecord, agent: BnbAgentProfile) {
  if (record.payment?.mode) return record.payment.mode;
  if (record.limits.walletConfirmationRequired === false) return "none" as const;
  if (record.payment?.jobId || record.payment?.contractAddress) return "escrow" as const;
  return resolveBnbPaymentMode(agent);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value !== "object") return JSON.stringify(value);

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
