import type { BnbActivationRecord, BnbAgentProfile, BnbAgentWork } from "@/lib/bnb/types";
import { a2aAdapter } from "@/lib/bnb/adapters/a2a";
import { httpAdapter } from "@/lib/bnb/adapters/http";
import { mcpAdapter } from "@/lib/bnb/adapters/mcp";
import { recordBnbEndpointProbeResult } from "@/lib/bnb/endpoint-observability";
import type { BnbAdapterPreflightResult, BnbAgentExecutionAdapter } from "@/lib/bnb/adapters/types";

const ENDPOINT_PREFLIGHT_CACHE_TTL_MS = 5 * 60 * 1000;
const RUNTIME_PROBE_CONCURRENCY = 6;

const adapters: BnbAgentExecutionAdapter[] = [
  mcpAdapter,
  a2aAdapter,
  httpAdapter,
];

const endpointPreflightCache = new Map<string, { expiresAt: number; result: BnbAdapterPreflightResult }>();

export async function preflightBnbAgentAdapters(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult[]> {
  const candidates = adapters.filter((adapter) => adapter.canHandle(agent));
  if (candidates.length === 0) {
    return [{
      ok: false,
      adapter: "http",
      reason: "No supported execution endpoint is listed for this agent.",
    }];
  }

  return Promise.all(candidates.map((adapter) => preflightAdapterEndpoint(adapter, agent)));
}

export async function preflightBnbAgentJob(agent: BnbAgentProfile, record: BnbActivationRecord): Promise<BnbAdapterPreflightResult[]> {
  const candidates = adapters.filter((adapter) => adapter.canHandle(agent));
  if (candidates.length === 0) {
    return [{
      ok: false,
      adapter: "http",
      reason: "No supported execution endpoint is listed for this agent.",
    }];
  }

  return Promise.all(candidates.map(async (adapter) => {
    const endpointPreflight = await preflightAdapterEndpoint(adapter, agent);
    if (!endpointPreflight.ok || !adapter.preflightJob) return endpointPreflight;
    return adapter.preflightJob({ agent, record });
  }));
}

export async function hasRunnableBnbAdapter(agent: BnbAgentProfile) {
  const results = await preflightBnbAgentAdapters(agent);
  return results.some((result) => result.ok);
}

export async function resolveBnbAgentRuntime(agent: BnbAgentProfile): Promise<BnbAgentProfile> {
  if (!hasCallableEndpoint(agent)) {
    return {
      ...agent,
      executionStatus: agent.executionStatus === "unavailable" ? "unavailable" : "listed_only",
      activationStatus: agent.executionStatus === "unavailable" ? "discoverable" : "discoverable",
    };
  }

  const results = await preflightBnbAgentAdapters(agent).catch(() => []);
  const executionStatus = results.some((result) => result.ok) ? "ready_to_run" : "connectable";
  return {
    ...agent,
    executionStatus,
    activationStatus: executionStatus === "ready_to_run" ? "callable" : "request",
  };
}

export async function resolveBnbAgentsRuntime(agents: BnbAgentProfile[]) {
  return mapWithConcurrency(agents, RUNTIME_PROBE_CONCURRENCY, resolveBnbAgentRuntime);
}

export async function runBnbAgentAdapter(agent: BnbAgentProfile, record: BnbActivationRecord): Promise<BnbAgentWork | null> {
  for (const adapter of adapters) {
    if (!adapter.canHandle(agent)) continue;
    const preflight = await preflightAdapterEndpoint(adapter, agent);
    if (!preflight.ok) continue;
    if (adapter.preflightJob) {
      const jobPreflight = await adapter.preflightJob({ agent, record });
      if (!jobPreflight.ok) continue;
    }
    const startedAt = Date.now();
    try {
      const work = await adapter.run({ agent, record });
      await recordBnbEndpointProbeResult(agent, {
        ok: true,
        adapter: preflight.adapter,
        endpoint: preflight.endpoint,
        capabilities: preflight.capabilities,
      }, "run", startedAt);
      return work;
    } catch (error) {
      await recordBnbEndpointProbeResult(agent, {
        ok: false,
        adapter: preflight.adapter,
        endpoint: preflight.endpoint,
        reason: error instanceof Error ? error.message : "Agent run failed.",
      }, "run", startedAt);
      throw error;
    }
  }

  return null;
}

async function preflightAdapterEndpoint(adapter: BnbAgentExecutionAdapter, agent: BnbAgentProfile) {
  const key = endpointCacheKey(adapter, agent);
  const cached = endpointPreflightCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;

  const result = await adapter.preflight(agent);
  await recordBnbEndpointProbeResult(agent, result, "endpoint_preflight", now);
  endpointPreflightCache.set(key, {
    result,
    expiresAt: now + ENDPOINT_PREFLIGHT_CACHE_TTL_MS,
  });
  return result;
}

function endpointCacheKey(adapter: BnbAgentExecutionAdapter, agent: BnbAgentProfile) {
  const urls = (agent.executionEndpoints || [])
    .filter((endpoint) => endpoint.adapter === adapter.id || (adapter.id === "http" && endpoint.adapter === "x402"))
    .map((endpoint) => `${endpoint.adapter}:${endpoint.url}:${endpoint.verified ? "1" : "0"}`)
    .sort()
    .join("|");
  return `${adapter.id}:${agent.chainId}:${agent.tokenId}:${urls}`;
}

function hasCallableEndpoint(agent: BnbAgentProfile) {
  return Boolean(agent.executionEndpoints?.some((endpoint) => (
    endpoint.adapter === "mcp" ||
    endpoint.adapter === "a2a" ||
    endpoint.adapter === "x402" ||
    endpoint.adapter === "http"
  )));
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}
