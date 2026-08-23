import { createHash } from "node:crypto";
import { COLLECTIONS, getDb } from "@/lib/db";
import type { BnbAgentProfile, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAdapterId, BnbAdapterPreflightResult } from "@/lib/bnb/adapters/types";

type BnbEndpointProbeContext = "endpoint_preflight" | "run";

type BnbEndpointProbeDocument = {
  _id: string;
  agentKey: string;
  chainId: number;
  tokenId: string;
  agentName: string;
  category: string;
  source: string;
  adapter: BnbAdapterId;
  endpointUrl: string;
  endpointLabel: string;
  endpointSource?: string;
  endpointVerified?: boolean;
  paymentRequired?: boolean;
  ok: boolean;
  lastReason: string;
  lastContext: BnbEndpointProbeContext;
  lastCapabilities: string[];
  latencyMs?: number;
  totalChecks: number;
  totalSuccesses: number;
  totalFailures: number;
  consecutiveFailures: number;
  firstSeenAt: Date;
  checkedAt: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
};

export type BnbEndpointProbeSummary = {
  ready: boolean;
  total: number;
  healthy: number;
  failing: number;
  recent: Array<{
    agent: string;
    chainId: number;
    tokenId: string;
    adapter: BnbAdapterId;
    ok: boolean;
    reason: string;
    checkedAt: string;
    endpoint: string;
    latencyMs?: number;
  }>;
};

type ProbeHealth = {
  hasSuccess: boolean;
  maxConsecutiveFailures: number;
};

let indexesReady: Promise<void> | null = null;

export async function recordBnbEndpointProbeResult(
  agent: BnbAgentProfile,
  result: BnbAdapterPreflightResult,
  context: BnbEndpointProbeContext,
  startedAt?: number,
) {
  if (!result.endpoint) return;
  try {
    const db = await getProbeDb();
    if (!db) return;
    await ensureProbeIndexes();

    const now = new Date();
    const endpoint = result.endpoint;
    const ok = Boolean(result.ok);
    const update: Record<string, unknown> = {
      $set: {
        agentKey: agentKey(agent),
        chainId: agent.chainId,
        tokenId: agent.tokenId,
        agentName: truncate(agent.name || `Agent #${agent.tokenId}`, 120),
        category: agent.category,
        source: agent.sourceFreshness.source,
        adapter: result.adapter,
        endpointUrl: endpoint.url,
        endpointLabel: truncate(endpoint.label || result.adapter.toUpperCase(), 80),
        endpointSource: endpoint.source,
        endpointVerified: endpoint.verified,
        paymentRequired: Boolean(endpoint.paymentRequired),
        ok,
        lastReason: ok ? "" : truncate(result.reason || "Endpoint probe failed.", 280),
        lastContext: context,
        lastCapabilities: (result.capabilities || []).slice(0, 30).map((capability) => truncate(capability, 80)),
        checkedAt: now,
        ...(startedAt ? { latencyMs: Math.max(0, Date.now() - startedAt) } : {}),
        ...(ok ? { lastSuccessAt: now, consecutiveFailures: 0 } : { lastFailureAt: now }),
      },
      $inc: {
        totalChecks: 1,
        ...(ok ? { totalSuccesses: 1 } : { totalFailures: 1, consecutiveFailures: 1 }),
      },
      $setOnInsert: {
        firstSeenAt: now,
      },
    };

    await db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES).updateOne(
      { _id: probeId(agent, result.adapter, endpoint) },
      update,
      { upsert: true },
    );
  } catch {
    // Observability must never block agent discovery, validation, or execution.
  }
}

export async function getBnbEndpointProbeSummary(limit = 8): Promise<BnbEndpointProbeSummary> {
  const db = await getProbeDb();
  if (!db) {
    return {
      ready: false,
      total: 0,
      healthy: 0,
      failing: 0,
      recent: [],
    };
  }

  try {
    await ensureProbeIndexes();
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
    const [total, healthy, failing, recent] = await Promise.all([
      db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES).countDocuments(),
      db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES).countDocuments({ ok: true }),
      db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES).countDocuments({ ok: false }),
      db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES)
        .find({})
        .sort({ checkedAt: -1 })
        .limit(boundedLimit)
        .toArray(),
    ]);

    return {
      ready: true,
      total,
      healthy,
      failing,
      recent: recent.map((probe) => ({
        agent: probe.agentName,
        chainId: probe.chainId,
        tokenId: probe.tokenId,
        adapter: probe.adapter,
        ok: probe.ok,
        reason: probe.lastReason || "",
        checkedAt: probe.checkedAt.toISOString(),
        endpoint: probe.endpointUrl,
        ...(probe.latencyMs !== undefined ? { latencyMs: probe.latencyMs } : {}),
      })),
    };
  } catch {
    return {
      ready: false,
      total: 0,
      healthy: 0,
      failing: 0,
      recent: [],
    };
  }
}

export async function applyBnbEndpointProbeHealth(agents: BnbAgentProfile[]): Promise<BnbAgentProfile[]> {
  if (agents.length === 0) return agents;
  const db = await getProbeDb();
  if (!db) return agents;

  try {
    await ensureProbeIndexes();
    const keys = Array.from(new Set(agents.map(agentKey)));
    const probes = await db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES)
      .find({ agentKey: { $in: keys } })
      .sort({ checkedAt: -1 })
      .limit(Math.min(keys.length * 4, 400))
      .toArray();
    const healthByAgent = new Map<string, ProbeHealth>();
    for (const probe of probes) {
      const current = healthByAgent.get(probe.agentKey) || { hasSuccess: false, maxConsecutiveFailures: 0 };
      healthByAgent.set(probe.agentKey, {
        hasSuccess: current.hasSuccess || probe.ok,
        maxConsecutiveFailures: Math.max(current.maxConsecutiveFailures, probe.consecutiveFailures || 0),
      });
    }

    return agents.map((agent) => {
      const health = healthByAgent.get(agentKey(agent));
      if (!health || health.hasSuccess || health.maxConsecutiveFailures < 3) return agent;
      return penalizeAgent(agent, health.maxConsecutiveFailures);
    });
  } catch {
    return agents;
  }
}

async function getProbeDb() {
  if (!process.env.MONGODB_URI) return null;
  try {
    return await getDb();
  } catch {
    return null;
  }
}

async function ensureProbeIndexes() {
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const db = await getProbeDb();
    if (!db) return;
    const collection = db.collection<BnbEndpointProbeDocument>(COLLECTIONS.BNB_ENDPOINT_PROBES);
    await Promise.all([
      collection.createIndex({ agentKey: 1, adapter: 1 }),
      collection.createIndex({ ok: 1, checkedAt: -1 }),
      collection.createIndex({ checkedAt: -1 }),
      collection.createIndex({ source: 1, adapter: 1, ok: 1 }),
    ]);
  })().catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function probeId(agent: BnbAgentProfile, adapter: BnbAdapterId, endpoint: BnbExecutionEndpoint) {
  return `${agentKey(agent)}:${adapter}:${hash(endpoint.url)}`;
}

function agentKey(agent: Pick<BnbAgentProfile, "chainId" | "tokenId">) {
  return `${agent.chainId}:${agent.tokenId}`;
}

function penalizeAgent(agent: BnbAgentProfile, failures: number): BnbAgentProfile {
  const penalty = Math.min(24, failures * 4);
  const scoreBreakdown = agent.scoreBreakdown
    ? {
      ...agent.scoreBreakdown,
      total: Math.max(0, agent.scoreBreakdown.total - penalty),
      activation: Math.max(0, agent.scoreBreakdown.activation - Math.min(10, penalty)),
      explanations: agent.scoreBreakdown.explanations.filter((item) => item !== "Protocol support detected."),
    }
    : agent.scoreBreakdown;

  return {
    ...agent,
    executionStatus: agent.executionStatus === "ready_to_run" ? "connectable" : agent.executionStatus,
    activationStatus: agent.activationStatus === "callable" ? "request" : agent.activationStatus,
    ...(scoreBreakdown ? { scoreBreakdown } : {}),
  };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
