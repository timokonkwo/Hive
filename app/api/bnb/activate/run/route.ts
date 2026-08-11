import { NextRequest, NextResponse } from "next/server";
import { authenticateClient } from "@/lib/client-auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { runBnbAgentAdapter } from "@/lib/bnb/adapters/registry";
import { runBnbAgentWork } from "@/lib/bnb/agent-runner";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, getBnbActivationRecord, updateBnbActivationRecord } from "@/lib/bnb/records";
import { hasBnbAgentWorker, runBnbAgentWorkOnWorker } from "@/lib/bnb/worker";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requiresEscrow() {
  return process.env.BNB_AGENT_RUN_REQUIRES_ESCROW !== "false";
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "activate:run", "write");
  if (limited) return limited;

  const client = await authenticateClient(request);
  if (!client) {
    return NextResponse.json({ error: "Sign in to run an agent." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = readString(body.recordId);

    if (!recordId) {
      return NextResponse.json({ error: "recordId is required" }, { status: 400 });
    }

    const record = await getBnbActivationRecord({ recordId, clientAddress: client.userId });
    if (!record) {
      return NextResponse.json({ error: "Hire receipt was not found" }, { status: 404 });
    }

    if (record.work?.status === "completed") {
      return NextResponse.json({
        status: record.status,
        message: "Agent work completed.",
        record,
        work: record.work,
      });
    }

    if (record.work?.status === "running") {
      return NextResponse.json({
        status: record.status,
        message: "Agent work is running.",
        record,
        work: record.work,
      }, { status: 202 });
    }

    if (requiresEscrow() && record.payment?.transactionStatus !== "success") {
      return NextResponse.json({ error: "Fund escrow before running this agent." }, { status: 409 });
    }

    await updateBnbActivationRecord({
      recordId,
      clientAddress: client.userId,
      patch: {
        work: {
          status: "running",
          startedAt: new Date().toISOString(),
        },
      },
    });

    try {
      const agent = await getBnbAgent(record.agent.chainId, record.agent.tokenId);
      const adapterWork = agent ? await runBnbAgentAdapter(agent, record) : null;
      const workerResult = adapterWork ? null : hasBnbAgentWorker() ? await runBnbAgentWorkOnWorker(record) : null;
      const work = adapterWork || (workerResult ? workerResult.work : await runBnbAgentWork(record));
      const isComplete = work.status === "completed";
      const updated = await updateBnbActivationRecord({
        recordId,
        clientAddress: client.userId,
        patch: {
          status: isComplete ? "work_completed" : record.status,
          work,
        },
      });

      return NextResponse.json({
        status: updated?.status || (isComplete ? "work_completed" : record.status),
        message: isComplete ? "Agent work completed." : "Agent work started.",
        record: updated,
        work,
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
        clientAddress: client.userId,
        patch: { work },
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
