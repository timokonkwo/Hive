import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { preflightBnbAgentJob, runBnbAgentAdapter } from "@/lib/bnb/adapters/registry";
import { formatBnbDeliveryText } from "@/lib/bnb/delivery";
import { withBnbWalletJobContext } from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord, updateBnbActivationRecord } from "@/lib/bnb/records";
import { shouldRequireBnbEscrow } from "@/lib/bnb/runtime";
import type { BnbActivationRecord } from "@/lib/bnb/types";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readEvmAddress(value: unknown) {
  const text = readString(value);
  return /^0x[a-fA-F0-9]{40}$/.test(text) ? text : "";
}

function executionWalletAddress(request: NextRequest, authAddress: string) {
  return readEvmAddress(authAddress) || readEvmAddress(request.headers.get("x-hive-bnb-wallet-address"));
}

function withRunWalletContext(record: BnbActivationRecord, walletAddress: string): BnbActivationRecord {
  if (!record.jobSpec || !walletAddress) return record;
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

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:run", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "run an agent");
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId);

    if (!recordId) {
      return NextResponse.json({ error: "recordId is required" }, { status: 400 });
    }

    const record = await getBnbActivationRecord({ recordId, clientAddress: auth.client.userId });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found" }, { status: 404 });
    }

    if (record.work?.status === "completed") {
      return NextResponse.json({
        status: record.status === "work_completed" ? "delivered" : record.status,
        message: "Agent delivery is ready.",
        record,
        work: record.work,
        delivery: record.delivery,
      });
    }

    if (record.work?.status === "running") {
      return NextResponse.json({
        status: record.status,
        message: "Run in progress.",
        record,
        work: record.work,
        delivery: record.delivery,
      }, { status: 202 });
    }

    const agent = await getBnbAgent(record.agent.chainId, record.agent.tokenId);
    if (!agent) {
      return NextResponse.json({ error: "Agent is no longer available." }, { status: 409 });
    }

    const escrowRequired = shouldRequireBnbEscrow(agent);

    if (escrowRequired && record.payment?.transactionStatus !== "success") {
      return NextResponse.json({ error: "Fund escrow before running this agent." }, { status: 409 });
    }

    const executionRecord = withRunWalletContext(record, executionWalletAddress(request, auth.client.address));
    const adapterPreflight = await preflightBnbAgentJob(agent, executionRecord);
    if (!adapterPreflight.some((result) => result.ok)) {
      const reason = adapterPreflight.find((result) => result.reason)?.reason || "This agent endpoint cannot run the supplied job.";
      const now = new Date().toISOString();
      const work = {
        status: "failed" as const,
        startedAt: record.work?.startedAt || now,
        completedAt: now,
        error: reason,
      };
      const updated = await updateBnbActivationRecord({
        recordId,
        clientAddress: auth.client.userId,
        patch: {
          status: "failed",
          work,
          delivery: {
            status: "failed",
            startedAt: work.startedAt,
            completedAt: work.completedAt,
            error: work.error,
          },
        },
      });

      return NextResponse.json({
        status: "failed",
        error: reason,
        record: updated,
        work,
        delivery: updated?.delivery,
        adapterPreflight,
      }, { status: 409 });
    }

    await updateBnbActivationRecord({
      recordId,
      clientAddress: auth.client.userId,
      patch: {
        status: "running",
        work: {
          status: "running",
          startedAt: new Date().toISOString(),
        },
        delivery: {
          status: "running",
          startedAt: new Date().toISOString(),
        },
      },
    });

    try {
      const work = await runBnbAgentAdapter(agent, executionRecord);
      if (!work) {
        throw new Error("This agent endpoint did not return work.");
      }
      const isComplete = work.status === "completed";
      const deliveryText = formatBnbDeliveryText(work.output, executionRecord.jobSpec);
      const updated = await updateBnbActivationRecord({
        recordId,
        clientAddress: auth.client.userId,
        patch: {
          status: isComplete ? "delivered" : "running",
          work,
          delivery: {
            status: isComplete ? "delivered" : "running",
            summary: deliveryText.split("\n").find(Boolean),
            rawOutput: work.output,
            dataSources: work.dataSources,
            adapter: work.adapter,
            runId: work.runId,
            startedAt: work.startedAt,
            completedAt: work.completedAt,
            error: work.error,
          },
        },
      });

      return NextResponse.json({
        status: updated?.status || (isComplete ? "delivered" : "running"),
        message: isComplete ? "Delivery is ready." : "Run in progress.",
        record: updated,
        work,
        delivery: updated?.delivery,
      });
    } catch (error) {
      const work = {
        status: "failed" as const,
        startedAt: record.work?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Agent work failed.",
      };
      const updated = await updateBnbActivationRecord({
        recordId,
        clientAddress: auth.client.userId,
        patch: {
          status: "failed",
          work,
          delivery: {
            status: "failed",
            startedAt: work.startedAt,
            completedAt: work.completedAt,
            error: work.error,
          },
        },
      });

      return NextResponse.json({
        status: updated?.status || record.status,
        error: work.error,
        record: updated,
        work,
      }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run agent." }, { status: 500 });
  }
}
