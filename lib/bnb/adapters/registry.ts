import type {
  BnbActivationRecord,
  BnbAgentProfile,
  BnbAgentWork,
  BnbEndpointCapabilityContract,
  BnbExecutionEndpoint,
  BnbExecutionTarget,
  BnbJobSpec,
} from "@/lib/bnb/types";
import { a2aAdapter } from "@/lib/bnb/adapters/a2a";
import { httpAdapter } from "@/lib/bnb/adapters/http";
import { mcpAdapter } from "@/lib/bnb/adapters/mcp";
import {
  bnbEndpointCapabilityAdapter,
  preflightResultFromCapabilitySnapshot,
  readBnbEndpointCapabilitySnapshot,
  recordBnbEndpointCapabilities,
} from "@/lib/bnb/endpoint-capabilities";
import { recordBnbEndpointProbeResult } from "@/lib/bnb/endpoint-observability";
import { isActionableBnbEndpointCapability } from "@/lib/bnb/capability-contracts";
import type { BnbAdapterPreflightResult, BnbAgentExecutionAdapter } from "@/lib/bnb/adapters/types";

const ENDPOINT_PREFLIGHT_CACHE_TTL_MS = 5 * 60 * 1000;
const RUNTIME_PROBE_CONCURRENCY = 6;
const MAX_EXECUTION_ENDPOINTS_PER_AGENT = 12;

const adapters: BnbAgentExecutionAdapter[] = [
  mcpAdapter,
  a2aAdapter,
  httpAdapter,
];

const endpointPreflightCache = new Map<string, { expiresAt: number; result: BnbAdapterPreflightResult }>();

export async function preflightBnbAgentAdapters(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult[]> {
  const candidates = endpointCandidates(agent);
  if (candidates.length === 0) {
    return [{
      ok: false,
      adapter: "http",
      reason: "This agent is not available for jobs.",
    }];
  }

  return Promise.all(candidates.map(({ adapter, endpoint }) => preflightAdapterEndpoint(adapter, agent, endpoint)));
}

export async function preflightBnbAgentJob(agent: BnbAgentProfile, record: BnbActivationRecord): Promise<BnbAdapterPreflightResult[]> {
  const candidates = candidatesForRecord(agent, record);
  if (candidates.length === 0) {
    return [{
      ok: false,
      adapter: "http",
      reason: "This agent is not available for jobs.",
    }];
  }

  return Promise.all(candidates.map(async ({ adapter, endpoint }) => {
    const endpointPreflight = await preflightAdapterEndpoint(adapter, agent, endpoint);
    if (!endpointPreflight.ok || !adapter.preflightJob) return endpointPreflight;
    return withCapabilityProvenance(await adapter.preflightJob({ agent, record, endpoint }), endpoint);
  }));
}

export function selectBnbJobPreflight(record: BnbActivationRecord, results: BnbAdapterPreflightResult[]) {
  const ready = results.filter((result) => result.ok && result.endpoint);
  if (ready.length === 0) return undefined;

  const target = record.executionTarget;
  if (target) {
    return ready.find((result) => resultMatchesTarget(result, target));
  }

  const capability = record.jobSpec?.endpointCapability;
  if (capability?.endpointUrl) {
    const exact = ready.find((result) => (
      result.endpoint?.url === capability.endpointUrl
      && (!capability.adapter || result.adapter === capability.adapter)
    ));
    if (exact) return exact;
  }

  if (capability) {
    const contractMatch = ready.find((result) => result.capabilityContracts?.some((candidate) => (
      candidate.kind === capability.kind
      && normalizeCapabilityName(candidate.name) === normalizeCapabilityName(capability.name)
    )));
    if (contractMatch) return contractMatch;
  }

  return ready[0];
}

export function executionTargetFromPreflight(
  result: BnbAdapterPreflightResult | undefined,
  capability?: BnbEndpointCapabilityContract,
): BnbExecutionTarget | undefined {
  if (!result?.ok || !result.endpoint) return undefined;
  const discoveredCapability = result.capabilityContracts?.find((candidate) => (
    candidate.endpointUrl === result.endpoint?.url
    && (!capability || (
      candidate.kind === capability.kind
      && normalizeCapabilityName(candidate.name) === normalizeCapabilityName(capability.name)
    ))
  )) || result.capabilityContracts?.[0];
  const sourceCapability = capability || discoveredCapability;
  const selectedCapability: BnbEndpointCapabilityContract | undefined = sourceCapability
    ? {
        ...sourceCapability,
        adapter: result.adapter,
        endpointUrl: result.endpoint.url,
        paymentRequired: capability?.paymentRequired
          ?? discoveredCapability?.paymentRequired
          ?? result.endpoint.paymentRequired,
      }
    : undefined;
  return {
    adapter: result.adapter,
    endpoint: result.endpoint,
    ...(selectedCapability ? { capability: selectedCapability } : {}),
    selectedAt: new Date().toISOString(),
  };
}

export function bindBnbJobSpecToExecutionTarget(spec: BnbJobSpec, target: BnbExecutionTarget | undefined): BnbJobSpec {
  if (!target?.capability) return spec;
  return {
    ...spec,
    endpointCapability: target.capability,
  };
}

export function preflightFromExecutionTarget(record: BnbActivationRecord): BnbAdapterPreflightResult | undefined {
  const target = record.executionTarget;
  if (!target) return undefined;
  return {
    ok: true,
    adapter: target.adapter,
    endpoint: target.endpoint,
    ...(target.capability ? {
      capabilities: [target.capability.name],
      capabilityContracts: [target.capability],
    } : {}),
    ...(target.adapter === "x402" && record.payment?.x402 ? { payment: record.payment.x402 } : {}),
  };
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
  const endpointCapabilities = uniqueRuntimeCapabilities(results
    .filter((result) => result.ok)
    .flatMap((result) => result.capabilityContracts || [])
    .filter(isActionableBnbEndpointCapability));
  const executionStatus = endpointCapabilities.length > 0 ? "ready_to_run" : "connectable";
  return {
    ...agent,
    executionStatus,
    activationStatus: executionStatus === "ready_to_run" ? "callable" : "request",
    endpointCapabilities,
    hasActionableEndpointCapabilities: endpointCapabilities.length > 0,
  };
}

function uniqueRuntimeCapabilities(capabilities: BnbEndpointCapabilityContract[]) {
  const unique = new Map<string, BnbEndpointCapabilityContract>();
  for (const capability of capabilities) {
    const key = `${capability.adapter || ""}:${capability.endpointUrl || ""}:${capability.kind}:${normalizeCapabilityName(capability.name)}`;
    const previous = unique.get(key);
    if (!previous || (!previous.inputSchema && capability.inputSchema)) unique.set(key, capability);
  }
  return Array.from(unique.values()).slice(0, 80);
}

export async function resolveBnbAgentsRuntime(agents: BnbAgentProfile[]) {
  return mapWithConcurrency(agents, RUNTIME_PROBE_CONCURRENCY, resolveBnbAgentRuntime);
}

export async function runBnbAgentAdapter(
  agent: BnbAgentProfile,
  record: BnbActivationRecord,
  selectedPreflight?: BnbAdapterPreflightResult,
): Promise<BnbAgentWork | null> {
  const preflight = selectedPreflight || selectBnbJobPreflight(record, await preflightBnbAgentJob(agent, record));
  if (!preflight?.ok || !preflight.endpoint) return null;
  if (record.executionTarget && !resultMatchesTarget(preflight, record.executionTarget)) return null;

  const adapter = adapterForEndpoint(preflight.endpoint);
  if (!adapter) return null;
  const startedAt = Date.now();
  try {
    const work = await adapter.run({ agent, record, endpoint: preflight.endpoint });
    await recordBnbEndpointProbeResult(agent, {
      ok: true,
      adapter: preflight.adapter,
      endpoint: preflight.endpoint,
      capabilities: preflight.capabilities,
      capabilityContracts: preflight.capabilityContracts,
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

async function preflightAdapterEndpoint(
  adapter: BnbAgentExecutionAdapter,
  agent: BnbAgentProfile,
  endpoint: BnbExecutionEndpoint,
) {
  const key = endpointCacheKey(adapter, agent, endpoint);
  const cached = endpointPreflightCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;

  const snapshot = await readBnbEndpointCapabilitySnapshot(
    agent,
    bnbEndpointCapabilityAdapter(adapter.id, endpoint),
    endpoint,
  );
  if (snapshot) {
    const result = preflightResultFromCapabilitySnapshot(snapshot, endpoint);
    endpointPreflightCache.set(key, {
      result,
      expiresAt: boundedInMemoryExpiry(now, snapshot.expiresAt),
    });
    return result;
  }

  const result = withCapabilityProvenance(await adapter.preflight(agent, endpoint), endpoint);
  await Promise.all([
    recordBnbEndpointProbeResult(agent, result, "endpoint_preflight", now),
    recordBnbEndpointCapabilities(agent, result),
  ]);
  endpointPreflightCache.set(key, {
    result,
    expiresAt: now + ENDPOINT_PREFLIGHT_CACHE_TTL_MS,
  });
  return result;
}

function boundedInMemoryExpiry(now: number, snapshotExpiresAt: string) {
  const snapshotExpiry = Date.parse(snapshotExpiresAt);
  if (!Number.isFinite(snapshotExpiry)) return now + ENDPOINT_PREFLIGHT_CACHE_TTL_MS;
  return Math.min(snapshotExpiry, now + ENDPOINT_PREFLIGHT_CACHE_TTL_MS);
}

function endpointCacheKey(adapter: BnbAgentExecutionAdapter, agent: BnbAgentProfile, endpoint: BnbExecutionEndpoint) {
  return `${adapter.id}:${agent.chainId}:${agent.tokenId}:${endpoint.adapter}:${endpoint.url}:${endpoint.verified ? "1" : "0"}`;
}

function hasCallableEndpoint(agent: BnbAgentProfile) {
  return Boolean(agent.executionEndpoints?.some((endpoint) => (
    endpoint.adapter === "mcp" ||
    endpoint.adapter === "a2a" ||
    endpoint.adapter === "x402" ||
    endpoint.adapter === "http"
  )));
}

function endpointCandidates(agent: BnbAgentProfile) {
  const seen = new Set<string>();
  return (agent.executionEndpoints || [])
    .filter((endpoint) => endpoint.adapter !== "web")
    .map((endpoint) => ({ endpoint, adapter: adapterForEndpoint(endpoint) }))
    .filter((candidate): candidate is { endpoint: BnbExecutionEndpoint; adapter: BnbAgentExecutionAdapter } => Boolean(candidate.adapter))
    .filter(({ endpoint }) => {
      const key = `${endpoint.adapter}:${endpoint.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_EXECUTION_ENDPOINTS_PER_AGENT);
}

function candidatesForRecord(agent: BnbAgentProfile, record: BnbActivationRecord) {
  const candidates = endpointCandidates(agent);
  const target = record.executionTarget;
  if (target) {
    return candidates.filter(({ endpoint }) => endpointMatchesTarget(endpoint, target));
  }
  const capability = record.jobSpec?.endpointCapability;
  if (capability?.endpointUrl) {
    const exact = candidates.filter(({ endpoint }) => (
      endpoint.url === capability.endpointUrl
      && (!capability.adapter || endpoint.adapter === capability.adapter)
    ));
    if (exact.length > 0) return exact;
  }
  return candidates;
}

function adapterForEndpoint(endpoint: BnbExecutionEndpoint) {
  if (endpoint.adapter === "mcp") return mcpAdapter;
  if (endpoint.adapter === "a2a") return a2aAdapter;
  if (endpoint.adapter === "http" || endpoint.adapter === "x402") return httpAdapter;
  return undefined;
}

function withCapabilityProvenance(result: BnbAdapterPreflightResult, endpoint: BnbExecutionEndpoint): BnbAdapterPreflightResult {
  const adapter = endpoint.adapter === "x402" ? "x402" : result.adapter;
  return {
    ...result,
    adapter,
    endpoint,
    ...(result.capabilityContracts ? {
      capabilityContracts: result.capabilityContracts.map((capability) => ({
        ...capability,
        adapter,
        endpointUrl: endpoint.url,
        paymentRequired: capability.paymentRequired ?? Boolean(endpoint.paymentRequired),
      })),
    } : {}),
  };
}

function resultMatchesTarget(result: BnbAdapterPreflightResult, target: BnbExecutionTarget) {
  return result.adapter === target.adapter && result.endpoint?.url === target.endpoint.url;
}

function endpointMatchesTarget(endpoint: BnbExecutionEndpoint, target: BnbExecutionTarget) {
  return endpoint.adapter === target.endpoint.adapter && endpoint.url === target.endpoint.url;
}

function normalizeCapabilityName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
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
