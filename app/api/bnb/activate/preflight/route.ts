import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { preflightBnbAgentJob } from "@/lib/bnb/adapters/registry";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { buildBnbIntentJobSpec, capabilityForBnbAgent, isBnbJobCapabilityAllowedForAgent, unsupportedBnbJobCapabilityReason } from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { getBnbHireBlocker, shouldRequireBnbEscrow } from "@/lib/bnb/runtime";
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
  if (intent.target || !walletAddress) return intent;
  if (intent.capability === "health_factor") return { ...intent, target: walletAddress };
  if (intent.capability === "yield_optimisation" && intent.advancedFields?.yieldSource === "Connected wallet") {
    return {
      ...intent,
      target: walletAddress,
      advancedFields: {
        ...intent.advancedFields,
        walletAddress,
      },
    };
  }
  return intent;
}

function shouldPreflightJob(agent: BnbAgentProfile) {
  return Boolean(agent.executionEndpoints?.some((endpoint) => endpoint.adapter === "mcp" || endpoint.adapter === "a2a"));
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
  const limited = enforceBnbRateLimit(request, "activate:preflight", "write");
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

  const normalizedJob = buildBnbIntentJobSpec(withDefaultWalletTarget(intentWithDefaultCapability, walletAddress));
  if (!normalizedJob.ok) {
    return NextResponse.json({ error: normalizedJob.error }, { status: 400 });
  }

  const adapterPreflight = shouldPreflightJob(agent)
    ? await preflightBnbAgentJob(agent, buildPreflightRecord(agent, normalizedJob.spec, auth.client.userId))
    : [];
  const adapterReady = adapterPreflight.some((result) => result.ok);
  const runnableAgent = agent.executionStatus === "connectable" && adapterReady
    ? { ...agent, executionStatus: "ready_to_run" as const, activationStatus: "callable" as const }
    : agent;
  const paymentRequired = shouldRequireBnbEscrow(runnableAgent);
  const hireBlocker = getBnbHireBlocker(runnableAgent, { requireEscrow: paymentRequired });
  const adapterBlocker = adapterPreflight.length > 0 && !adapterReady
    ? adapterPreflight.find((result) => !result.ok && result.reason)?.reason || "This agent cannot run the selected job."
    : "";
  const blocker = adapterBlocker || hireBlocker;
  const warnings = [
    ...normalizedJob.warnings,
  ];
  const result: BnbJobPreflightResult = {
    status: blocker ? (adapterBlocker ? "needs_input" : "blocked") : "ready",
    canProceed: !blocker,
    paymentRequired,
    jobSpec: normalizedJob.spec,
    missingInputs: normalizedJob.missingInputs,
    warnings,
    assumptions: normalizedJob.assumptions,
    adapterPreflight,
  };

  return NextResponse.json({
    ...result,
    message: blocker || "Job validated.",
    agent: {
      chainId: runnableAgent.chainId,
      tokenId: runnableAgent.tokenId,
      executionStatus: runnableAgent.executionStatus,
      activationStatus: runnableAgent.activationStatus,
    },
  });
}
