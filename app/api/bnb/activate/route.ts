import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { hasRunnableBnbAdapter, preflightBnbAgentJob } from "@/lib/bnb/adapters/registry";
import { buildBnbEscrowPaymentRequest, isNativeBnbBudget } from "@/lib/bnb/escrow";
import {
  buildBnbIntentJobSpec,
  buildBnbJobSpec,
  capabilityForBnbAgent,
  isBnbJobCapabilityAllowedForAgent,
  legacyBnbJobSpec,
  unsupportedBnbJobCapabilityReason,
} from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, createBnbActivationRecord } from "@/lib/bnb/records";
import { getBnbHireBlocker, shouldRequireBnbEscrow } from "@/lib/bnb/runtime";
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
  const limited = enforceBnbRateLimit(request, "activate", "write");
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

  let agent = await getBnbAgent(chainId, tokenId);
  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found" }, { status: 404 });
  }

  if (agent.executionStatus === "connectable") {
    const runnable = await hasRunnableBnbAdapter(agent);
    if (runnable) {
      agent = { ...agent, executionStatus: "ready_to_run", activationStatus: "callable" };
    }
  }

  const escrowRequired = shouldRequireBnbEscrow(agent);
  const hireBlocker = getBnbHireBlocker(agent, { requireEscrow: escrowRequired });
  if (hireBlocker) {
    return NextResponse.json({ error: hireBlocker }, { status: hireBlocker.includes("not configured") ? 503 : 409 });
  }

  if (escrowRequired && !isNativeBnbBudget(spendCap)) {
    return NextResponse.json({ error: "Enter a positive BNB budget." }, { status: 400 });
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

  if (shouldPreflightJob(agent)) {
    const adapterChecks = await preflightBnbAgentJob(agent, buildPreflightRecord(agent, normalizedJob.spec, auth.client.userId));
    if (!adapterChecks.some((check) => check.ok)) {
      const reason = adapterChecks.find((check) => check.reason)?.reason || "This agent endpoint cannot run the supplied job.";
      return NextResponse.json({ error: reason, adapterPreflight: adapterChecks }, { status: 400 });
    }
  }

  try {
    const record = await createBnbActivationRecord({
      agent,
      taskTemplate: normalizedJob.spec.summary,
      jobSpec: normalizedJob.spec,
      spendCap: escrowRequired ? spendCap : "No payment",
      expiry,
      clientAddress: auth.client.userId,
      walletConfirmationRequired: escrowRequired,
    });
    const paymentRequest = escrowRequired
      ? buildBnbEscrowPaymentRequest(record)
      : {
        status: "not_required" as const,
        reason: "This job does not require payment.",
      };

    return NextResponse.json({
      status: record.status,
      message: paymentRequest.status === "ready" ? "Job ready for escrow funding." : "Job created.",
      receiptId: record.receiptId,
      recordId: record.recordId,
      agent: record.agent,
      limits: record.limits,
      jobSpec: record.jobSpec,
      paymentRequired: escrowRequired,
      paymentRequest,
      storage: record.storage,
      record,
    });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save hire." }, { status: 500 });
  }
}
