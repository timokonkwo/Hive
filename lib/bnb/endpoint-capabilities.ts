import { createHash } from "node:crypto";
import { COLLECTIONS, getDb } from "@/lib/db";
import { isActionableBnbEndpointCapability } from "@/lib/bnb/capability-contracts";
import { getBscChainId } from "@/lib/bnb/chain";
import type {
  BnbAgentProfile,
  BnbEndpointCapabilityContract,
  BnbEndpointCapabilitySnapshot,
  BnbExecutionEndpoint,
} from "@/lib/bnb/types";
import type { BnbAdapterId, BnbAdapterPreflightResult } from "@/lib/bnb/adapters/types";

const DEFAULT_CAPABILITY_TTL_SECONDS = 6 * 60 * 60;
const MIN_CAPABILITY_TTL_SECONDS = 5 * 60;
const MAX_CAPABILITY_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_CAPABILITIES_PER_ENDPOINT = 80;
const MAX_SCHEMA_JSON_BYTES = 48 * 1024;
const CAPABILITY_PROBE_VERSION = "v4";

type SnapshotAdapter = BnbEndpointCapabilitySnapshot["adapter"];
type ApplyCapabilitySnapshotOptions = {
  includeContracts?: boolean;
};

type BnbEndpointCapabilityDocument = Omit<BnbEndpointCapabilitySnapshot, "checkedAt" | "expiresAt"> & {
  _id: string;
  probeContext: string;
  checkedAt: Date;
  expiresAt: Date;
  consecutiveFailures?: number;
  lastFailureAt?: Date;
};

let indexesReady: Promise<void> | null = null;

export function isBnbEndpointCapabilityCacheEnabled() {
  return process.env.BNB_ENDPOINT_CAPABILITY_CACHE_ENABLED !== "false" && Boolean(process.env.MONGODB_URI);
}

export function getBnbEndpointCapabilityTtlMs() {
  const value = Number.parseInt(process.env.BNB_ENDPOINT_CAPABILITY_TTL_SECONDS || String(DEFAULT_CAPABILITY_TTL_SECONDS), 10);
  const seconds = Number.isFinite(value)
    ? Math.min(Math.max(value, MIN_CAPABILITY_TTL_SECONDS), MAX_CAPABILITY_TTL_SECONDS)
    : DEFAULT_CAPABILITY_TTL_SECONDS;
  return seconds * 1000;
}

export function bnbEndpointCapabilityAgentKey(agent: Pick<BnbAgentProfile, "chainId" | "tokenId">) {
  return `${agent.chainId}:${agent.tokenId}`;
}

export async function listBnbCurrentActionableCapabilityAgentKeys(limit = 1_000) {
  const db = await getCapabilityDb();
  if (!db) return [];

  try {
    await ensureCapabilityIndexes();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5_000);
    const docs = await db.collection<BnbEndpointCapabilityDocument>(COLLECTIONS.BNB_ENDPOINT_CAPABILITIES)
      .find({
        probeContext: capabilityProbeContext(),
        ok: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ checkedAt: -1 })
      .limit(safeLimit)
      .toArray();
    return Array.from(new Set(docs
      .filter((doc) => doc.capabilities.some(isActionableBnbEndpointCapability))
      .map((doc) => doc.agentKey)));
  } catch {
    return [];
  }
}

export function bnbEndpointCapabilityAdapter(adapter: BnbAdapterId, endpoint: BnbExecutionEndpoint): SnapshotAdapter {
  if (endpoint.adapter === "x402") return "x402";
  if (adapter === "mcp" || adapter === "a2a" || adapter === "x402") return adapter;
  return "http";
}

export function bnbEndpointCapabilityKey(
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId">,
  adapter: SnapshotAdapter,
  endpoint: Pick<BnbExecutionEndpoint, "url">,
) {
  return `${capabilityProbeContext()}:${bnbEndpointCapabilityAgentKey(agent)}:${adapter}:${hash(endpoint.url)}`;
}

export async function readBnbEndpointCapabilitySnapshot(
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId">,
  adapter: SnapshotAdapter,
  endpoint: BnbExecutionEndpoint,
): Promise<BnbEndpointCapabilitySnapshot | null> {
  const db = await getCapabilityDb();
  if (!db) return null;

  try {
    await ensureCapabilityIndexes();
    const collection = db.collection<BnbEndpointCapabilityDocument>(COLLECTIONS.BNB_ENDPOINT_CAPABILITIES);
    const exact = await collection
      .find({
        probeContext: capabilityProbeContext(),
        agentKey: bnbEndpointCapabilityAgentKey(agent),
        adapter,
        endpointUrl: endpoint.url,
        expiresAt: { $gt: new Date() },
      })
      .sort({ checkedAt: -1 })
      .limit(1)
      .next();
    if (exact) return snapshotFromDocument(exact);
    const doc = await collection
      .find({
        probeContext: capabilityProbeContext(),
        adapter,
        endpointUrl: endpoint.url,
        ok: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ checkedAt: -1 })
      .limit(1)
      .next();
    return doc ? snapshotFromDocument(doc) : null;
  } catch {
    return null;
  }
}

export async function recordBnbEndpointCapabilities(agent: BnbAgentProfile, result: BnbAdapterPreflightResult) {
  if (!result.endpoint) return { stored: false };
  const db = await getCapabilityDb();
  if (!db) return { stored: false };

  try {
    await ensureCapabilityIndexes();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + getBnbEndpointCapabilityTtlMs());
    const endpoint = result.endpoint;
    const capabilities = capabilityContractsFromPreflightResult(result);
    const adapter = result.adapter === "x402" ? "x402" : bnbEndpointCapabilityAdapter(result.adapter, endpoint);
    const id = bnbEndpointCapabilityKey(agent, adapter, endpoint);
    const collection = db.collection<BnbEndpointCapabilityDocument>(COLLECTIONS.BNB_ENDPOINT_CAPABILITIES);
    const existing = await collection.findOne({ _id: id });
    const consecutiveFailures = result.ok ? 0 : (existing?.consecutiveFailures || 0) + 1;
    const retainRecentSuccess = !result.ok
      && existing?.ok === true
      && existing.expiresAt > now
      && consecutiveFailures < 3;

    if (retainRecentSuccess) {
      await collection.updateOne(
        { _id: id },
        { $set: { consecutiveFailures, lastFailureAt: now } },
      );
      return { stored: true };
    }

    const document: BnbEndpointCapabilityDocument = {
      _id: id,
      probeContext: capabilityProbeContext(),
      agentKey: bnbEndpointCapabilityAgentKey(agent),
      chainId: agent.chainId,
      tokenId: agent.tokenId,
      adapter,
      endpointUrl: endpoint.url,
      endpointLabel: truncate(cleanText(endpoint.label || adapter.toUpperCase()), 120),
      endpointSource: endpoint.source,
      endpointVerified: Boolean(endpoint.verified),
      paymentRequired: Boolean(endpoint.paymentRequired),
      ok: Boolean(result.ok),
      capabilities,
      ...(result.reason ? { reason: truncate(cleanText(result.reason), 300) } : {}),
      checkedAt: now,
      expiresAt,
      consecutiveFailures,
      ...(!result.ok ? { lastFailureAt: now } : {}),
    };

    await collection.updateOne(
      { _id: document._id },
      {
        $set: document,
        ...(result.ok ? { $unset: { lastFailureAt: "" } } : {}),
      },
      { upsert: true },
    );
    return { stored: true };
  } catch {
    return { stored: false };
  }
}

export async function applyBnbEndpointCapabilitySnapshots(
  agents: BnbAgentProfile[],
  options: ApplyCapabilitySnapshotOptions = {},
): Promise<BnbAgentProfile[]> {
  if (agents.length === 0) return agents;
  const db = await getCapabilityDb();
  if (!db) return agents;

  try {
    await ensureCapabilityIndexes();
    const agentKeys = Array.from(new Set(agents.map(bnbEndpointCapabilityAgentKey)));
    const endpointUrls = Array.from(new Set(agents.flatMap((agent) => (
      agent.executionEndpoints || []
    ).map((endpoint) => endpoint.url))));
    const docs = await db.collection<BnbEndpointCapabilityDocument>(COLLECTIONS.BNB_ENDPOINT_CAPABILITIES)
      .find({
        probeContext: capabilityProbeContext(),
        expiresAt: { $gt: new Date() },
        $or: [
          { agentKey: { $in: agentKeys } },
          ...(endpointUrls.length > 0 ? [{ endpointUrl: { $in: endpointUrls } }] : []),
        ],
      })
      .sort({ checkedAt: -1 })
      .limit(Math.min(Math.max((agentKeys.length + endpointUrls.length) * 6, 50), 1_000))
      .toArray();
    const snapshotsByAgent = new Map<string, BnbEndpointCapabilitySnapshot[]>();
    const snapshotsByEndpoint = new Map<string, BnbEndpointCapabilitySnapshot[]>();
    for (const doc of docs) {
      const snapshot = snapshotFromDocument(doc);
      const snapshots = snapshotsByAgent.get(doc.agentKey) || [];
      snapshots.push(snapshot);
      snapshotsByAgent.set(doc.agentKey, snapshots);
      if (snapshot.ok) {
        const endpointKey = endpointSnapshotKey(snapshot);
        const endpointSnapshots = snapshotsByEndpoint.get(endpointKey) || [];
        endpointSnapshots.push(snapshot);
        snapshotsByEndpoint.set(endpointKey, endpointSnapshots);
      }
    }

    return agents.map((agent) => {
      const sharedSnapshots = (agent.executionEndpoints || []).flatMap((endpoint) => (
        snapshotsByEndpoint.get(endpointKey(endpoint)) || []
      ));
      return applyCapabilitySnapshotsToAgent(
        agent,
        [...(snapshotsByAgent.get(bnbEndpointCapabilityAgentKey(agent)) || []), ...sharedSnapshots],
        options,
      );
    });
  } catch {
    return agents;
  }
}

function capabilityProbeContext() {
  return `${CAPABILITY_PROBE_VERSION}:eip155:${getBscChainId()}`;
}

export function preflightResultFromCapabilitySnapshot(
  snapshot: BnbEndpointCapabilitySnapshot,
  endpoint?: BnbExecutionEndpoint,
): BnbAdapterPreflightResult {
  const capabilityContracts = sanitizeCapabilityContracts(snapshot.capabilities).map((capability) => ({
    ...capability,
    adapter: snapshot.adapter,
    endpointUrl: snapshot.endpointUrl,
    paymentRequired: capability.paymentRequired ?? Boolean(snapshot.paymentRequired),
  }));
  return {
    ok: snapshot.ok,
    adapter: snapshot.adapter,
    endpoint: endpoint || {
      adapter: snapshot.adapter,
      url: snapshot.endpointUrl,
      label: snapshot.endpointLabel,
      verified: Boolean(snapshot.endpointVerified),
      source: snapshot.endpointSource || "metadata",
      paymentRequired: Boolean(snapshot.paymentRequired),
    },
    ...(snapshot.reason ? { reason: snapshot.reason } : {}),
    capabilities: capabilityContracts.map((capability) => capability.name),
    capabilityContracts,
  };
}

function applyCapabilitySnapshotsToAgent(
  agent: BnbAgentProfile,
  snapshots: BnbEndpointCapabilitySnapshot[],
  options: ApplyCapabilitySnapshotOptions,
): BnbAgentProfile {
  if (snapshots.length === 0) return agent;

  const endpointSnapshots = latestEndpointSnapshots(snapshots);
  const successfulSnapshots = endpointSnapshots.filter((snapshot) => snapshot.ok);
  const failedSnapshots = endpointSnapshots.filter((snapshot) => !snapshot.ok);
  const successfulCapabilities = successfulSnapshots.flatMap((snapshot) => snapshot.capabilities.map((capability) => ({
    ...capability,
    adapter: snapshot.adapter,
    endpointUrl: snapshot.endpointUrl,
    paymentRequired: capability.paymentRequired ?? Boolean(snapshot.paymentRequired),
  })));
  const actionableCapabilities = successfulCapabilities.filter(isActionableBnbEndpointCapability);
  const failedEndpointKeys = new Set(failedSnapshots.map(endpointSnapshotKey));
  const callableEndpoints = (agent.executionEndpoints || []).filter((endpoint) => endpoint.adapter !== "web");
  const allKnownCallableEndpointsFailed = callableEndpoints.length > 0
    && callableEndpoints.every((endpoint) => failedEndpointKeys.has(endpointKey(endpoint)));
  const existingEndpoints = (agent.executionEndpoints || []).map((endpoint) => {
    const snapshot = endpointSnapshots.find((item) => endpointMatchesSnapshot(endpoint, item));
    if (!snapshot) return endpoint;
    return {
      ...endpoint,
      verified: endpoint.verified || snapshot.ok || Boolean(snapshot.endpointVerified),
      paymentRequired: snapshot.paymentRequired ?? endpoint.paymentRequired,
    };
  });
  const knownEndpointKeys = new Set(existingEndpoints.map(endpointKey));
  const restoredEndpoints = successfulSnapshots
    .filter((snapshot) => isPublicCapabilityUrl(snapshot.endpointUrl))
    .filter((snapshot) => !knownEndpointKeys.has(endpointSnapshotKey(snapshot)))
    .map((snapshot): BnbExecutionEndpoint => ({
      adapter: snapshot.adapter,
      url: snapshot.endpointUrl,
      label: snapshot.endpointLabel || snapshot.adapter.toUpperCase(),
      verified: snapshot.ok || Boolean(snapshot.endpointVerified),
      source: snapshot.endpointSource || "metadata",
      paymentRequired: Boolean(snapshot.paymentRequired),
    }));
  const executionEndpoints = [...existingEndpoints, ...restoredEndpoints];
  const hasKnownSuccessfulCapabilities = successfulCapabilities.length > 0;
  const hasActionableEndpointCapabilities = hasKnownSuccessfulCapabilities ? actionableCapabilities.length > 0 : undefined;
  const executionStatus = hasActionableEndpointCapabilities
    ? "ready_to_run"
    : allKnownCallableEndpointsFailed && agent.executionStatus === "ready_to_run"
      ? "connectable"
      : agent.executionStatus;
  const capabilities = uniqueText([
    ...agent.capabilities,
    ...actionableCapabilities.map((capability) => capability.name),
  ]).slice(0, 120);

  return {
    ...agent,
    ...(executionEndpoints.length > 0 ? { executionEndpoints } : {}),
    ...(executionStatus ? { executionStatus, activationStatus: activationFromExecution(executionStatus) } : {}),
    ...(hasActionableEndpointCapabilities !== undefined ? { hasActionableEndpointCapabilities } : {}),
    ...(options.includeContracts ? { endpointCapabilities: uniqueCapabilityContracts(actionableCapabilities) } : {}),
    capabilities,
  };
}

export function capabilityContractsFromPreflightResult(result: BnbAdapterPreflightResult) {
  if (result.capabilityContracts && result.capabilityContracts.length > 0) {
    return sanitizeCapabilityContracts(result.capabilityContracts.map((capability) => ({
      ...capability,
      adapter: result.adapter,
      endpointUrl: result.endpoint?.url,
      paymentRequired: capability.paymentRequired ?? Boolean(result.endpoint?.paymentRequired),
    })));
  }

  const kind = capabilityKindForAdapter(result.adapter);
  return sanitizeCapabilityContracts((result.capabilities || []).map((capability) => ({
    name: capability,
    kind,
    adapter: result.adapter,
    endpointUrl: result.endpoint?.url,
    paymentRequired: Boolean(result.endpoint?.paymentRequired),
  })));
}

function sanitizeCapabilityContracts(contracts: BnbEndpointCapabilityContract[]) {
  return contracts
    .slice(0, MAX_CAPABILITIES_PER_ENDPOINT)
    .map((contract) => sanitizeCapabilityContract(contract))
    .filter((contract): contract is BnbEndpointCapabilityContract => Boolean(contract));
}

function uniqueCapabilityContracts(contracts: BnbEndpointCapabilityContract[]) {
  const byName = new Map<string, BnbEndpointCapabilityContract>();
  for (const contract of sanitizeCapabilityContracts(contracts)) {
    const key = `${contract.adapter || ""}:${contract.endpointUrl || ""}:${contract.kind}:${contract.name.toLowerCase()}`;
    const previous = byName.get(key);
    if (!previous || (!previous.inputSchema && contract.inputSchema)) {
      byName.set(key, contract);
    }
  }
  return Array.from(byName.values()).slice(0, MAX_CAPABILITIES_PER_ENDPOINT);
}

function sanitizeCapabilityContract(contract: BnbEndpointCapabilityContract): BnbEndpointCapabilityContract | null {
  const name = truncate(cleanText(contract.name), 140);
  if (!name) return null;

  const description = contract.description ? truncate(cleanText(contract.description), 800) : "";
  const tags = Array.isArray(contract.tags)
    ? Array.from(new Set(contract.tags.map(cleanText).filter(Boolean))).slice(0, 30)
    : [];
  const inputSchema = safeJsonValue(contract.inputSchema, MAX_SCHEMA_JSON_BYTES);

  return {
    name,
    kind: contract.kind,
    ...(isCapabilityAdapter(contract.adapter) ? { adapter: contract.adapter } : {}),
    ...(isPublicCapabilityUrl(contract.endpointUrl) ? { endpointUrl: contract.endpointUrl } : {}),
    ...(description ? { description } : {}),
    ...(inputSchema !== undefined ? { inputSchema } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(contract.paymentRequired !== undefined ? { paymentRequired: Boolean(contract.paymentRequired) } : {}),
  };
}

function isCapabilityAdapter(value: unknown): value is NonNullable<BnbEndpointCapabilityContract["adapter"]> {
  return value === "mcp" || value === "a2a" || value === "x402" || value === "http";
}

function isPublicCapabilityUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function capabilityKindForAdapter(adapter: BnbAdapterId): BnbEndpointCapabilityContract["kind"] {
  if (adapter === "mcp") return "tool";
  if (adapter === "a2a") return "skill";
  return "http";
}

function latestEndpointSnapshots(snapshots: BnbEndpointCapabilitySnapshot[]) {
  const byEndpoint = new Map<string, BnbEndpointCapabilitySnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.adapter}:${snapshot.endpointUrl}`;
    const previous = byEndpoint.get(key);
    if (!previous || Date.parse(snapshot.checkedAt) > Date.parse(previous.checkedAt)) {
      byEndpoint.set(key, snapshot);
    }
  }
  return Array.from(byEndpoint.values());
}

function endpointMatchesSnapshot(endpoint: BnbExecutionEndpoint, snapshot: BnbEndpointCapabilitySnapshot) {
  return endpointKey(endpoint) === endpointSnapshotKey(snapshot);
}

function endpointKey(endpoint: BnbExecutionEndpoint) {
  return `${endpoint.adapter === "x402" ? "x402" : endpoint.adapter}:${endpoint.url}`;
}

function endpointSnapshotKey(snapshot: BnbEndpointCapabilitySnapshot) {
  return `${snapshot.adapter}:${snapshot.endpointUrl}`;
}

function activationFromExecution(status: BnbAgentProfile["executionStatus"]) {
  if (status === "ready_to_run") return "callable";
  if (status === "connectable") return "request";
  return "discoverable";
}

function uniqueText(values: string[]) {
  const seen = new Set<string>();
  return values
    .map(cleanText)
    .filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function getCapabilityDb() {
  if (!isBnbEndpointCapabilityCacheEnabled()) return null;
  try {
    return await getDb();
  } catch {
    return null;
  }
}

async function ensureCapabilityIndexes() {
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const db = await getCapabilityDb();
    if (!db) return;
    const collection = db.collection<BnbEndpointCapabilityDocument>(COLLECTIONS.BNB_ENDPOINT_CAPABILITIES);
    await Promise.all([
      collection.createIndex({ agentKey: 1, adapter: 1 }),
      collection.createIndex({ probeContext: 1, adapter: 1, endpointUrl: 1, expiresAt: 1 }),
      collection.createIndex({ probeContext: 1, ok: 1, expiresAt: 1, checkedAt: -1 }),
      collection.createIndex({ ok: 1, checkedAt: -1 }),
      collection.createIndex({ "capabilities.name": 1 }),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
  })().catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function snapshotFromDocument(doc: BnbEndpointCapabilityDocument): BnbEndpointCapabilitySnapshot {
  return {
    agentKey: doc.agentKey,
    chainId: doc.chainId,
    tokenId: doc.tokenId,
    adapter: doc.adapter,
    endpointUrl: doc.endpointUrl,
    endpointLabel: doc.endpointLabel,
    endpointSource: doc.endpointSource,
    endpointVerified: doc.endpointVerified,
    paymentRequired: doc.paymentRequired,
    ok: doc.ok,
    capabilities: sanitizeCapabilityContracts(doc.capabilities || []),
    reason: doc.reason,
    checkedAt: doc.checkedAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}

function safeJsonValue(value: unknown, maxBytes: number): unknown {
  if (value === undefined || value === null) return undefined;
  try {
    const json = JSON.stringify(value);
    if (!json || json.length > maxBytes) return undefined;
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
