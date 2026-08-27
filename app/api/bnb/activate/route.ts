import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { getBscChainId } from "@/lib/bnb/chain";
import { bindBnbJobSpecToExecutionTarget, executionTargetFromPreflight, preflightBnbAgentJob, selectBnbJobPreflight } from "@/lib/bnb/adapters/registry";
import { buildBnbEscrowPaymentRequest, isNativeBnbBudget } from "@/lib/bnb/escrow";
import { bnbX402NetworkChainId, buildBnbX402PaymentRequest } from "@/lib/bnb/x402";
import {
  buildBnbIntentJobSpec,
  buildBnbJobSpec,
  capabilityForBnbAgent,
  isBnbJobCapabilityAllowedForAgent,
  legacyBnbJobSpec,
  unsupportedBnbJobCapabilityReason,
} from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, createBnbActivationRecord, publicBnbActivationRecord } from "@/lib/bnb/records";
import { getBnbHireBlocker, resolveBnbPaymentModeForPreflight } from "@/lib/bnb/runtime";
import type { BnbActivationRecord, BnbAgentProfile, BnbHireIntentInput, BnbJobSpec } from "@/lib/bnb/types";

function readString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readIntent(value: unknown): BnbHireIntentInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    capability: readString(record.capability) as BnbHireIntentInput["capability"],
    endpointCapability: readString(record.endpointCapability),
    taskType: readString(record.taskType),
    outcome: readString(record.outcome),
    target: readString(record.target),
    riskPreference: readString(record.riskPreference) as BnbHireIntentInput["riskPreference"],
    advancedFields: record.advancedFields && typeof record.advancedFields === "object"
      ? record.advancedFields as Record<string, string>
      : {},
    instructions: readString(record.instructions),
  };
}

function readEvmAddress(value: unknown) {
  const text = readString(value);
  return /^0x[a-fA-F0-9]{40}$/.test(text) ? text : "";
}

function executionWalletAddress(request: NextRequest, authAddress: string) {
  return readEvmAddress(authAddress) || readEvmAddress(request.headers.get("x-hive-bnb-wallet-address"));
}

function withDefaultWalletTarget(intent: BnbHireIntentInput, walletAddress: string): BnbHireIntentInput {
  const withWallet = walletAddress
    ? {
      ...intent,
      advancedFields: {
        ...intent.advancedFields,
        walletAddress: intent.advancedFields?.walletAddress || walletAddress,
      },
    }
    : intent;
  if (intent.target || !walletAddress) return withWallet;
  if (intent.capability === "health_factor") return { ...withWallet, target: walletAddress };
  if (intent.capability === "yield_optimisation" && intent.advancedFields?.yieldSource === "Connected wallet") {
    return {
      ...withWallet,
      target: walletAddress,
      advancedFields: {
        ...withWallet.advancedFields,
        walletAddress,
      },
    };
  }
  return withWallet;
}

function shouldPreflightJob(agent: BnbAgentProfile) {
  return Boolean(agent.executionEndpoints?.some((endpoint) => endpoint.adapter === "mcp" || endpoint.adapter === "a2a" || endpoint.adapter === "http" || endpoint.adapter === "x402"));
}

function buildPreflightRecord(agent: BnbAgentProfile, jobSpec: BnbJobSpec, clientAddress: string): BnbActivationRecord {
  const now = new Date().toISOString();
  return {
    recordType: "hire",
    recordId: "preflight",
    receiptId: "preflight",
    status: "awaiting_funding",
    createdAt: now,
    updatedAt: now,
    clientAddress,
    agent: {
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      name: agent.name,
      activationStatus: agent.activationStatus,
      executionStatus: agent.executionStatus,
      agentWallet: agent.agentWallet,
    },
    jobSpec,
    delivery: { status: "pending" },
    limits: {
      task: jobSpec.summary,
      budget: "preflight",
      expires: "preflight",
      walletConfirmationRequired: true,
    },
  };
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "activate", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "hire an agent");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const chainId = readString(body.chainId);
  const tokenId = readString(body.tokenId);
  const taskTemplate = readString(body.taskTemplate) || "Custom task";
  const taskDetails = readString(body.taskDetails);
  const spendCap = typeof body.spendCap === "string" || typeof body.spendCap === "number" ? String(body.spendCap) : "unset";
  const expiry = readString(body.expiry) || "24 hours";
  const intentInput = readIntent(body.intent);
  const jobSpecInput = body.jobSpec && typeof body.jobSpec === "object" ? body.jobSpec as Record<string, unknown> : null;

  if (!chainId || !tokenId) {
    return NextResponse.json({ error: "chainId and tokenId are required" }, { status: 400 });
  }

  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found" }, { status: 404 });
  }

  const walletAddress = executionWalletAddress(request, auth.client.address);
  const intentWithDefaultCapability = intentInput
    ? { ...intentInput, capability: intentInput.capability || capabilityForBnbAgent(agent) }
    : null;
  const jobSpecCapability = jobSpecInput ? readString(jobSpecInput.capability) || capabilityForBnbAgent(agent) : "";
  const requestedCapability = intentWithDefaultCapability?.capability || jobSpecCapability;
  if (requestedCapability && !isBnbJobCapabilityAllowedForAgent(agent, requestedCapability)) {
    return NextResponse.json({ error: unsupportedBnbJobCapabilityReason(agent, requestedCapability) }, { status: 400 });
  }

  const normalizedJob = intentInput
    ? buildBnbIntentJobSpec(withDefaultWalletTarget(intentWithDefaultCapability as BnbHireIntentInput, walletAddress), agent)
    : jobSpecInput
    ? buildBnbJobSpec({
      capability: jobSpecCapability,
      taskType: readString(jobSpecInput.taskType),
      fields: jobSpecInput.fields && typeof jobSpecInput.fields === "object" ? jobSpecInput.fields as Record<string, unknown> : {},
      instructions: readString(jobSpecInput.instructions),
    }, agent)
    : { ok: true as const, spec: legacyBnbJobSpec(taskTemplate, taskDetails) };

  if (!normalizedJob.ok) {
    return NextResponse.json({ error: normalizedJob.error }, { status: 400 });
  }

  let adapterChecks: Awaited<ReturnType<typeof preflightBnbAgentJob>> = [];
  const preflightRecord = buildPreflightRecord(agent, normalizedJob.spec, auth.client.userId);
  if (shouldPreflightJob(agent)) {
    adapterChecks = await preflightBnbAgentJob(agent, preflightRecord);
  }
  const selectedPreflight = selectBnbJobPreflight(preflightRecord, adapterChecks);
  if (!selectedPreflight) {
    const reason = adapterChecks.find((check) => check.reason)?.reason || "This agent cannot run this job.";
    return NextResponse.json({ error: reason, adapterPreflight: adapterChecks }, { status: 400 });
  }

  const executionTarget = executionTargetFromPreflight(selectedPreflight, normalizedJob.spec.endpointCapability);
  if (!executionTarget) {
    return NextResponse.json({ error: "This agent cannot run this job." }, { status: 409 });
  }
  const executionJobSpec = bindBnbJobSpecToExecutionTarget(normalizedJob.spec, executionTarget);
  const paymentMode = resolveBnbPaymentModeForPreflight(agent, selectedPreflight);
  const paymentRequired = paymentMode !== "none";
  const escrowRequired = paymentMode === "escrow";
  const hireBlocker = getBnbHireBlocker(agent, { paymentMode });
  if (hireBlocker) {
    return NextResponse.json({ error: hireBlocker }, { status: hireBlocker.includes("not configured") ? 503 : 409 });
  }
  if (escrowRequired && !isNativeBnbBudget(spendCap)) {
    return NextResponse.json({ error: "Enter a positive BNB budget." }, { status: 400 });
  }

  const x402Snapshot = paymentMode === "x402"
    ? selectedPreflight.payment
    : undefined;
  if (paymentMode === "x402" && !x402Snapshot) {
    return NextResponse.json({ error: "Payment is not available.", adapterPreflight: adapterChecks }, { status: 409 });
  }
  const x402PaymentRequest = buildBnbX402PaymentRequest(x402Snapshot);
  if (paymentMode === "x402" && x402PaymentRequest.status !== "ready") {
    return NextResponse.json({ error: x402PaymentRequest.reason, paymentRequest: x402PaymentRequest }, { status: 409 });
  }

  try {
    const record = await createBnbActivationRecord({
      agent,
      taskTemplate: executionJobSpec.summary,
      jobSpec: executionJobSpec,
      executionTarget,
      spendCap: escrowRequired
        ? spendCap
        : x402PaymentRequest.status === "ready"
          ? x402PaymentRequest.amountLabel
          : "No payment",
      expiry,
      clientAddress: auth.client.userId,
      walletConfirmationRequired: paymentRequired,
      ...(escrowRequired ? {
        payment: {
          mode: "escrow" as const,
          chainId: getBscChainId(),
          transactionStatus: "pending" as const,
        },
      } : x402Snapshot ? {
        payment: {
          mode: "x402" as const,
          chainId: bnbX402NetworkChainId(x402Snapshot.selectedRequirement.network) || getBscChainId(),
          transactionStatus: "pending" as const,
          x402: x402Snapshot,
        },
      } : {}),
    });
    const paymentRequest = escrowRequired
      ? buildBnbEscrowPaymentRequest(record)
      : x402PaymentRequest.status === "ready"
        ? x402PaymentRequest
        : {
        status: "not_required" as const,
        mode: "none" as const,
        reason: "",
      };
    recordBnbAnalyticsEvent({
      name: "hire.created",
      route: "api.bnb.activate",
      clientAddress: auth.client.userId,
      agent,
      recordId: record.recordId,
      receiptId: record.receiptId,
      status: record.status,
      ok: true,
      metadata: {
        capability: record.jobSpec?.capability || "",
        taskType: record.jobSpec?.taskType || "",
        paymentRequired,
        paymentMode,
      },
    });
    const publicRecord = publicBnbActivationRecord(record);

    return NextResponse.json({
      status: record.status,
      message: paymentRequest.status === "ready" ? "Job ready." : "Job created.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      agent: record.agent,
      limits: record.limits,
      jobSpec: record.jobSpec,
      paymentRequired,
      paymentMode,
      paymentRequest,
      storage: record.storage,
      record: publicRecord,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save hire." }, { status: 500 });
  }
}
