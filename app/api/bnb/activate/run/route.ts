import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { runBnbAgentAdapter } from "@/lib/bnb/adapters/registry";
import { runBnbAgentWork } from "@/lib/bnb/agent-runner";
import { formatBnbDeliveryText } from "@/lib/bnb/delivery";
import { withBnbWalletJobContext } from "@/lib/bnb/jobs";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord, updateBnbActivationRecord } from "@/lib/bnb/records";
import { shouldRequireBnbEscrow } from "@/lib/bnb/runtime";
import { hasBnbAgentWorker, runBnbAgentWorkOnWorker } from "@/lib/bnb/worker";
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
    const escrowRequired = agent ? shouldRequireBnbEscrow(agent) : record.limits.walletConfirmationRequired !== false;

    if (escrowRequired && record.payment?.transactionStatus !== "success") {
      return NextResponse.json({ error: "Fund escrow before running this agent." }, { status: 409 });
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
      const executionRecord = withRunWalletContext(record, executionWalletAddress(request, auth.client.address));
      const adapterWork = agent ? await runBnbAgentAdapter(agent, executionRecord) : null;
      const workerResult = adapterWork ? null : hasBnbAgentWorker() ? await runBnbAgentWorkOnWorker(executionRecord) : null;
      const work = adapterWork || (workerResult ? workerResult.work : await runBnbAgentWork(executionRecord));
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
        ...(workerResult?.mode === "async" ? { workerJobId: workerResult.workerJobId } : {}),
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
