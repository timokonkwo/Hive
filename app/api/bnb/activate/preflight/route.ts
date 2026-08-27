import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { bindBnbJobSpecToExecutionTarget, executionTargetFromPreflight, preflightBnbAgentJob, selectBnbJobPreflight } from "@/lib/bnb/adapters/registry";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { buildBnbIntentJobSpec, capabilityForBnbAgent, isBnbJobCapabilityAllowedForAgent, unsupportedBnbJobCapabilityReason } from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { getBnbHireBlocker, resolveBnbPaymentModeForPreflight } from "@/lib/bnb/runtime";
import type { BnbActivationRecord, BnbAgentProfile, BnbHireIntentInput, BnbJobPreflightResult } from "@/lib/bnb/types";

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

function buildPreflightRecord(agent: BnbAgentProfile, jobSpec: BnbJobPreflightResult["jobSpec"], clientAddress: string): BnbActivationRecord {
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
    ...(jobSpec ? { jobSpec } : {}),
    delivery: { status: "pending" },
    limits: {
      task: jobSpec?.summary || "",
      budget: "preflight",
      expires: "preflight",
      walletConfirmationRequired: true,
    },
  };
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "activate:preflight", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "check and hire an agent");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const chainId = readString(body.chainId);
  const tokenId = readString(body.tokenId);
  const intent = readIntent(body.intent);

  if (!chainId || !tokenId) {
    return NextResponse.json({ error: "chainId and tokenId are required." }, { status: 400 });
  }
  if (!intent) {
    return NextResponse.json({ error: "Job intent is required." }, { status: 400 });
  }

  const agent = await getBnbAgent(chainId, tokenId);
  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found." }, { status: 404 });
  }

  const walletAddress = executionWalletAddress(request, auth.client.address);
  const intentWithDefaultCapability = { ...intent, capability: intent.capability || capabilityForBnbAgent(agent) };
  if (!isBnbJobCapabilityAllowedForAgent(agent, intentWithDefaultCapability.capability)) {
    return NextResponse.json({ error: unsupportedBnbJobCapabilityReason(agent, intentWithDefaultCapability.capability) }, { status: 400 });
  }

  const normalizedJob = buildBnbIntentJobSpec(withDefaultWalletTarget(intentWithDefaultCapability, walletAddress), agent);
  if (!normalizedJob.ok) {
    return NextResponse.json({ error: normalizedJob.error }, { status: 400 });
  }

  const preflightRecord = buildPreflightRecord(agent, normalizedJob.spec, auth.client.userId);
  const adapterPreflight = shouldPreflightJob(agent)
    ? await preflightBnbAgentJob(agent, preflightRecord)
    : [];
  const selectedPreflight = selectBnbJobPreflight(preflightRecord, adapterPreflight);
  const adapterReady = Boolean(selectedPreflight);
  const runnableAgent = agent.executionStatus === "connectable" && adapterReady
    ? { ...agent, executionStatus: "ready_to_run" as const, activationStatus: "callable" as const }
    : agent;
  const paymentMode = resolveBnbPaymentModeForPreflight(runnableAgent, selectedPreflight);
  const paymentRequired = paymentMode !== "none";
  const hireBlocker = getBnbHireBlocker(runnableAgent, { paymentMode });
  const adapterBlocker = adapterPreflight.length > 0 && !adapterReady
    ? adapterPreflight.find((result) => !result.ok && result.reason)?.reason || "This agent cannot run the selected job."
    : "";
  const blocker = adapterBlocker || hireBlocker;
  const warnings = [
    ...normalizedJob.warnings,
  ];
  const selectedExecution = executionTargetFromPreflight(selectedPreflight, normalizedJob.spec.endpointCapability);
  const result: BnbJobPreflightResult = {
    status: blocker ? (adapterBlocker ? "needs_input" : "blocked") : "ready",
    canProceed: !blocker,
    paymentRequired,
    paymentMode,
    jobSpec: bindBnbJobSpecToExecutionTarget(normalizedJob.spec, selectedExecution),
    missingInputs: normalizedJob.missingInputs,
    warnings,
    assumptions: normalizedJob.assumptions,
    selectedExecution,
    adapterPreflight,
  };
  recordBnbAnalyticsEvent({
    name: "job.validation",
    route: "api.bnb.activate.preflight",
    clientAddress: auth.client.userId,
    agent: runnableAgent,
    status: result.status,
    ok: result.canProceed,
    metadata: {
      capability: normalizedJob.spec.capability,
      taskType: normalizedJob.spec.taskType,
      paymentRequired,
      paymentMode,
      missingInputs: normalizedJob.missingInputs.length,
      warnings: warnings.length,
      adapterChecks: adapterPreflight.length,
      adapterReady,
    },
  });

  return NextResponse.json({
    ...result,
    message: blocker || "Ready.",
    agent: {
      chainId: runnableAgent.chainId,
      tokenId: runnableAgent.tokenId,
      executionStatus: runnableAgent.executionStatus,
      activationStatus: runnableAgent.activationStatus,
    },
  });
}
