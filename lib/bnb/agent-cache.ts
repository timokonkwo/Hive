import { createHash } from "node:crypto";
import type { Filter } from "mongodb";
import { COLLECTIONS, getDb } from "@/lib/db";
import {
  applyBnbEndpointCapabilitySnapshots,
  listBnbCurrentActionableCapabilityAgentKeys,
} from "@/lib/bnb/endpoint-capabilities";
import { applyBnbEndpointProbeHealth } from "@/lib/bnb/endpoint-observability";
import { validatePublicHttpsUrl } from "@/lib/bnb/endpoint-security";
import { withBnbAgentImage } from "@/lib/bnb/agent-media";
import { activeBnbListingModerationKeys, isBnbListingModerated } from "@/lib/bnb/moderation";
import { getBscChainId } from "@/lib/bnb/chain";
import { isStrictBscAgentDiscoveryEnabled } from "@/lib/bnb/discovery-policy";
import type {
  BnbAgentPageResult,
  BnbAgentProfile,
  BnbAgentQuery,
  BnbAgentSource,
  BnbExecutionEndpoint,
  BnbExecutionStatus,
} from "@/lib/bnb/types";

type BnbAgentCacheDocument = {
  _id: string;
  chainId: number;
  tokenId: string;
  agent: BnbAgentProfile;
  source: BnbAgentSource;
  category: string;
  activationStatus: string;
  executionStatus: BnbExecutionStatus;
  hasCallableEndpoint: boolean;
  needsHydration: boolean;
  hydrationStatus: "none" | "pending" | "hydrating" | "hydrated" | "failed";
  hydrateAttempts: number;
  hydrateAfter: Date;
  hydrateLockedUntil?: Date;
  hydrateError?: string;
  searchTokens: string[];
  sort: {
    readyRank: number;
    sourceRank: number;
    totalScore: number;
    feedbackCount: number;
    feedbackScore: number;
    lastActivityMs: number;
  };
  cachedAt: Date;
  refreshedAt: Date;
  hydratedAt?: Date;
  runtimeProofAt?: Date;
  runtimeProofVersion?: number;
  runtimeProofChainId?: number;
  runtimeMetadataFingerprint?: string;
  inspectedRuntimeMetadataFingerprint?: string;
  lastSeenAt: Date;
};

type CachedAgentPage = BnbAgentPageResult & {
  cache: {
    status: "hit";
    stale: boolean;
    newestCachedAt?: string;
  };
};

type CacheUpsertOptions = {
  hydrated?: boolean;
  runtimeProbed?: boolean;
  queueHydration?: boolean;
  fetchedAt?: Date;
};

let indexesReady: Promise<void> | null = null;
const RUNTIME_PROOF_VERSION = 4;

export function isBnbAgentCacheEnabled() {
  return process.env.BNB_AGENT_CACHE_ENABLED !== "false" && Boolean(process.env.MONGODB_URI);
}

export function getBnbAgentCacheTtlMs() {
  return boundedMs("BNB_AGENT_CACHE_TTL_SECONDS", 15 * 60, 60, 24 * 60 * 60);
}

export function getBnbAgentCacheStaleMs() {
  return boundedMs("BNB_AGENT_CACHE_STALE_SECONDS", 24 * 60 * 60, 5 * 60, 7 * 24 * 60 * 60);
}

export function getBnbAgentHydrationBatchSize() {
  const value = Number.parseInt(process.env.BNB_AGENT_CACHE_HYDRATION_BATCH || "6", 10);
  if (!Number.isFinite(value)) return 6;
  return Math.min(Math.max(value, 1), 24);
}

export async function readCachedBnbAgentsPage(query: BnbAgentQuery = {}): Promise<CachedAgentPage | null> {
  const db = await getBnbAgentCacheDb();
  if (!db) return null;
  await ensureBnbAgentCacheIndexes();

  const limit = Math.min(Math.max(Math.trunc(query.limit || 24), 1), 100);
  const page = Math.max(Math.trunc(query.page || 1), 1);
  const filter = cacheFilter(query);
  const moderatedKeys = await activeBnbListingModerationKeys();
  const moderationFilter = moderatedKeys.length > 0 ? { _id: { $nin: moderatedKeys } } : {};
  const maxStaleAt = new Date(Date.now() - getBnbAgentCacheStaleMs());
  const finalFilter = { ...filter, ...moderationFilter, cachedAt: { $gte: maxStaleAt } };
  const sort = cacheSort(query.sort);
  const defaultMarketplaceBrowse = !query.q?.trim() && !query.category && !query.integration;
  const readPage = defaultMarketplaceBrowse
    ? readDefaultMarketplaceCachePage(db, finalFilter, sort, limit, page)
    : db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
      .find(finalFilter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
  const countPage = defaultMarketplaceBrowse
    ? countDefaultMarketplaceCachePage(db, finalFilter)
    : db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).countDocuments(finalFilter);

  const [docs, total, newest] = await Promise.all([
    readPage,
    countPage,
    db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
      .find(finalFilter)
      .sort({ cachedAt: -1 })
      .limit(1)
      .next(),
  ]);

  if (!cacheHitIsUsable(query, docs, total, limit, page)) return null;

  const newestCachedAt = newest?.cachedAt;
  const stale = newestCachedAt ? Date.now() - newestCachedAt.getTime() > getBnbAgentCacheTtlMs() : true;
  const capabilityAgents = await applyBnbEndpointCapabilitySnapshots(docs.map(agentFromCacheDocument));
  const agents = await applyBnbEndpointProbeHealth(capabilityAgents);
  return {
    agents,
    page,
    pageSize: limit,
    total,
    hasMore: page * limit < total,
    source: Array.from(new Set(docs.map((doc) => doc.source))).join("+") || "cache",
    cache: {
      status: "hit",
      stale,
      newestCachedAt: newestCachedAt?.toISOString(),
    },
  };
}

export async function readCachedBnbPromotionCandidates(limit = 12): Promise<BnbAgentProfile[]> {
  if (isStrictBscAgentDiscoveryEnabled()) return [];
  const db = await getBnbAgentCacheDb();
  if (!db) return [];
  await ensureBnbAgentCacheIndexes();

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const moderatedKeys = await activeBnbListingModerationKeys();
  const docs = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
    .find({
      source: { $ne: "8004scan" },
      category: { $ne: "Other" },
      executionStatus: "ready_to_run",
      hasCallableEndpoint: true,
      "agent.hasActionableEndpointCapabilities": true,
      runtimeProofVersion: RUNTIME_PROOF_VERSION,
      runtimeProofChainId: getBscChainId(),
      runtimeProofAt: { $gte: new Date(Date.now() - runtimeProofTtlMs()) },
      ...(moderatedKeys.length > 0 ? { _id: { $nin: moderatedKeys } } : {}),
    })
    .sort(cacheSort("recommended"))
    .limit(safeLimit)
    .toArray();
  const capabilityAgents = await applyBnbEndpointCapabilitySnapshots(docs.map(agentFromCacheDocument));
  return applyBnbEndpointProbeHealth(capabilityAgents);
}

export async function readCachedBnbRuntimeCandidates(limit = 50): Promise<BnbAgentProfile[]> {
  const db = await getBnbAgentCacheDb();
  if (!db) return [];
  await ensureBnbAgentCacheIndexes();

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const moderatedKeys = await activeBnbListingModerationKeys();
  const docs = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
    .find({
      ...(isStrictBscAgentDiscoveryEnabled() ? { source: "8004scan" } : {}),
      category: { $ne: "Other" },
      hasCallableEndpoint: true,
      ...(moderatedKeys.length > 0 ? { _id: { $nin: moderatedKeys } } : {}),
    })
    .sort(cacheSort("recommended"))
    .limit(safeLimit)
    .toArray();
  const capabilityAgents = await applyBnbEndpointCapabilitySnapshots(docs.map(agentFromCacheDocument));
  return applyBnbEndpointProbeHealth(capabilityAgents);
}

export async function overlayCachedBnbAgentDetails(agents: BnbAgentProfile[]): Promise<BnbAgentProfile[]> {
  if (agents.length === 0) return agents;
  const db = await getBnbAgentCacheDb();
  if (!db) return agents;
  await ensureBnbAgentCacheIndexes();

  const docs = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
    .find({
      _id: { $in: agents.map((agent) => cacheKey(agent.chainId, agent.tokenId)) },
      cachedAt: { $gte: new Date(Date.now() - getBnbAgentCacheStaleMs()) },
    })
    .toArray();
  const cachedById = new Map(docs.map((doc) => [doc._id, agentFromCacheDocument(doc)]));

  return agents.map((agent) => {
    const cached = cachedById.get(cacheKey(agent.chainId, agent.tokenId));
    if (!cached?.executionEndpoints?.length) return agent;
    return {
      ...agent,
      services: cached.services,
      capabilities: Array.from(new Set([...agent.capabilities, ...cached.capabilities])),
      executionEndpoints: cached.executionEndpoints,
      executionStatus: cached.executionStatus,
      activationStatus: cached.activationStatus,
      ...(cached.endpointCapabilities ? { endpointCapabilities: cached.endpointCapabilities } : {}),
      ...(cached.hasActionableEndpointCapabilities !== undefined
        ? { hasActionableEndpointCapabilities: cached.hasActionableEndpointCapabilities }
        : {}),
    };
  });
}

async function readDefaultMarketplaceCachePage(
  db: Awaited<ReturnType<typeof getDb>>,
  filter: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  limit: number,
  page: number,
) {
  if (!db) return [];
  const offset = (page - 1) * limit;
  const relevantFilter = { ...filter, category: { $ne: "Other" } };
  const otherFilter = { ...filter, category: "Other" };
  const relevantTotal = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).countDocuments(relevantFilter);
  const relevantSkip = Math.min(offset, relevantTotal);
  const relevantLimit = Math.max(Math.min(limit, relevantTotal - relevantSkip), 0);
  const relevantDocs = relevantLimit > 0
    ? await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
      .find(relevantFilter)
      .sort(sort)
      .skip(relevantSkip)
      .limit(relevantLimit)
      .toArray()
    : [];
  const remaining = limit - relevantDocs.length;
  if (remaining <= 0) return relevantDocs;

  const otherSkip = Math.max(offset - relevantTotal, 0);
  const otherDocs = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
    .find(otherFilter)
    .sort(sort)
    .skip(otherSkip)
    .limit(remaining)
    .toArray();
  return [...relevantDocs, ...otherDocs];
}

async function countDefaultMarketplaceCachePage(
  db: Awaited<ReturnType<typeof getDb>>,
  filter: Record<string, unknown>,
) {
  if (!db) return 0;
  const [relevantTotal, otherTotal] = await Promise.all([
    db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).countDocuments({ ...filter, category: { $ne: "Other" } }),
    db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).countDocuments({ ...filter, category: "Other" }),
  ]);
  return relevantTotal + otherTotal;
}

export async function getCachedBnbAgent(chainId: string | number, tokenId: string): Promise<BnbAgentProfile | null> {
  const db = await getBnbAgentCacheDb();
  if (!db) return null;
  if (await isBnbListingModerated(chainId, tokenId)) return null;
  await ensureBnbAgentCacheIndexes();

  const doc = await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE)
    .findOne({ _id: cacheKey(chainId, tokenId), cachedAt: { $gte: new Date(Date.now() - getBnbAgentCacheStaleMs()) } });
  if (!doc) return null;
  const capabilityAgents = await applyBnbEndpointCapabilitySnapshots([agentFromCacheDocument(doc)]);
  const [agent] = await applyBnbEndpointProbeHealth(capabilityAgents);
  return agent || null;
}

export async function upsertBnbAgentCache(agents: BnbAgentProfile[], options: CacheUpsertOptions = {}) {
  const db = await getBnbAgentCacheDb();
  if (!db || agents.length === 0) return { stored: 0 };
  await ensureBnbAgentCacheIndexes();

  const now = options.fetchedAt || new Date();
  const collection = db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE);
  const agentKeys = agents.map((agent) => cacheKey(agent.chainId, agent.tokenId));
  const existingDocs = await collection.find({ _id: { $in: agentKeys } }).toArray();
  const existingById = new Map(existingDocs.map((doc) => [doc._id, doc]));
  const writes = agents.map((agent) => {
    const existing = existingById.get(cacheKey(agent.chainId, agent.tokenId));
    const mergedAgent = mergeCachedAgentProfile(existing, agent, options, now);
    const doc = cacheDocument(mergedAgent, now, options);
    const update: Record<string, unknown> = {
      $set: {
        chainId: doc.chainId,
        tokenId: doc.tokenId,
        agent: doc.agent,
        source: doc.source,
        category: doc.category,
        activationStatus: doc.activationStatus,
        executionStatus: doc.executionStatus,
        hasCallableEndpoint: doc.hasCallableEndpoint,
        needsHydration: doc.needsHydration,
        searchTokens: doc.searchTokens,
        sort: doc.sort,
        runtimeMetadataFingerprint: doc.runtimeMetadataFingerprint,
        cachedAt: doc.cachedAt,
        refreshedAt: doc.refreshedAt,
        lastSeenAt: doc.lastSeenAt,
        ...(options.hydrated ? { hydrationStatus: "hydrated", hydratedAt: now } : {}),
        ...(options.runtimeProbed ? { runtimeProofAt: now } : {}),
        ...(options.runtimeProbed ? { runtimeProofVersion: RUNTIME_PROOF_VERSION } : {}),
        ...(options.runtimeProbed ? { runtimeProofChainId: getBscChainId() } : {}),
        ...(options.hydrated ? {
          inspectedRuntimeMetadataFingerprint: doc.runtimeMetadataFingerprint,
        } : {}),
      },
      $setOnInsert: {
        hydrateAttempts: 0,
        hydrateAfter: doc.hydrateAfter,
        ...(!options.hydrated ? { hydrationStatus: doc.hydrationStatus } : {}),
      },
    };

    if (options.hydrated) {
      update.$unset = { hydrateError: "", hydrateLockedUntil: "" };
    }

    return {
      updateOne: {
        filter: { _id: doc._id },
        update,
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(writes, { ordered: false });
  if (options.queueHydration) {
    await collection.updateMany(
      {
        _id: { $in: agents.map((agent) => cacheKey(agent.chainId, agent.tokenId)) },
        needsHydration: true,
        $or: [
          { runtimeProofVersion: { $ne: RUNTIME_PROOF_VERSION } },
          { runtimeProofChainId: { $ne: getBscChainId() } },
          { runtimeProofAt: { $lt: new Date(now.getTime() - runtimeProofTtlMs()) } },
          { runtimeProofAt: { $exists: false } },
          { inspectedRuntimeMetadataFingerprint: { $exists: false } },
          {
            $expr: {
              $ne: ["$runtimeMetadataFingerprint", "$inspectedRuntimeMetadataFingerprint"],
            },
          },
        ],
      },
      { $set: { hydrationStatus: "pending", hydrateAfter: now } },
    );
  }
  return { stored: writes.length };
}

export async function claimBnbAgentHydrationBatch(limit = getBnbAgentHydrationBatchSize()) {
  const db = await getBnbAgentCacheDb();
  if (!db) return [];
  await ensureBnbAgentCacheIndexes();

  const now = new Date();
  const lockUntil = new Date(now.getTime() + 2 * 60 * 1000);
  const expiredProofAt = new Date(now.getTime() - runtimeProofTtlMs());
  const collection = db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 24);
  const claimableFilter: Filter<BnbAgentCacheDocument> = {
    hydrateAfter: { $lte: now },
    $and: [
      {
        $or: [
          {
            needsHydration: true,
            hydrationStatus: { $in: ["pending", "failed"] },
            $or: [
              { hasCallableEndpoint: false },
              { runtimeProofVersion: { $ne: RUNTIME_PROOF_VERSION } },
              { runtimeProofChainId: { $ne: getBscChainId() } },
              { runtimeProofAt: { $lt: expiredProofAt } },
              { runtimeProofAt: { $exists: false } },
            ],
          },
          {
            hasCallableEndpoint: true,
            $or: [
              { runtimeProofVersion: { $ne: RUNTIME_PROOF_VERSION } },
              { runtimeProofChainId: { $ne: getBscChainId() } },
              { runtimeProofAt: { $lt: expiredProofAt } },
              { runtimeProofAt: { $exists: false } },
            ],
          },
          {
            hasCallableEndpoint: false,
            $and: [
              {
                $or: [
                  { "agent.services.type": { $in: ["mcp", "a2a", "x402", "http"] } },
                  { "agent.mcpSupport": true },
                  { "agent.a2aSupport": true },
                  { "agent.x402Support": true },
                ],
              },
              {
                $or: [
                  { inspectedRuntimeMetadataFingerprint: { $exists: false } },
                  {
                    $expr: {
                      $ne: ["$runtimeMetadataFingerprint", "$inspectedRuntimeMetadataFingerprint"],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        $or: [
          { hydrateLockedUntil: { $exists: false } },
          { hydrateLockedUntil: { $lte: now } },
        ],
      },
    ],
  };
  const priorityKeys = await listBnbCurrentActionableCapabilityAgentKeys();
  const candidateSort = { "sort.readyRank": -1 as const, runtimeProofAt: -1 as const, hydrateAttempts: 1 as const, lastSeenAt: -1 as const };
  const priorityCandidates = priorityKeys.length > 0
    ? await collection
      .find({ ...claimableFilter, _id: { $in: priorityKeys } })
      .sort(candidateSort)
      .limit(safeLimit)
      .toArray()
    : [];
  const remaining = safeLimit - priorityCandidates.length;
  const candidates = remaining > 0
    ? [
      ...priorityCandidates,
      ...await collection
        .find({
          ...claimableFilter,
          ...(priorityCandidates.length > 0 ? { _id: { $nin: priorityCandidates.map((candidate) => candidate._id) } } : {}),
        })
        .sort(candidateSort)
        .limit(remaining)
        .toArray(),
    ]
    : priorityCandidates;

  const claimed: BnbAgentProfile[] = [];
  for (const candidate of candidates) {
    const result = await collection.findOneAndUpdate(
      {
        _id: candidate._id,
        $or: [
          { hydrateLockedUntil: { $exists: false } },
          { hydrateLockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          hydrationStatus: "hydrating",
          hydrateLockedUntil: lockUntil,
        },
        $inc: { hydrateAttempts: 1 },
      },
      { returnDocument: "after" },
    );
    if (result) claimed.push(result.agent);
  }

  return claimed;
}

export async function completeBnbAgentHydration(agent: BnbAgentProfile, hydrated?: BnbAgentProfile, error?: string) {
  const db = await getBnbAgentCacheDb();
  if (!db) return;
  await ensureBnbAgentCacheIndexes();

  const now = new Date();
  const key = cacheKey(agent.chainId, agent.tokenId);
  if (hydrated) {
    await upsertBnbAgentCache([hydrated], { hydrated: true, runtimeProbed: true, fetchedAt: now });
    await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).updateOne(
      { _id: key },
      {
        $set: {
          hydrationStatus: "hydrated",
          needsHydration: false,
          hydratedAt: now,
          runtimeProofAt: now,
          runtimeProofVersion: RUNTIME_PROOF_VERSION,
          runtimeProofChainId: getBscChainId(),
          inspectedRuntimeMetadataFingerprint: runtimeMetadataFingerprint(hydrated),
        },
        $unset: { hydrateError: "", hydrateLockedUntil: "" },
      },
    );
    return;
  }

  await db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE).updateOne(
    { _id: key },
    {
      $set: {
        hydrationStatus: "failed",
        hydrateError: truncate(error || "Hydration failed", 280),
        hydrateAfter: new Date(now.getTime() + 30 * 60 * 1000),
      },
      $unset: { hydrateLockedUntil: "" },
    },
  );
}

export async function recordBnbAgentCacheRun(type: "refresh" | "hydrate", payload: Record<string, unknown>) {
  const db = await getBnbAgentCacheDb();
  if (!db) return;
  await db.collection(COLLECTIONS.BNB_AGENT_CACHE_RUNS).insertOne({
    type,
    ...payload,
    createdAt: new Date(),
  });
}

async function getBnbAgentCacheDb() {
  if (!isBnbAgentCacheEnabled()) return null;
  try {
    return await getDb();
  } catch {
    return null;
  }
}

async function ensureBnbAgentCacheIndexes() {
  if (indexesReady) return indexesReady;
  indexesReady = (async () => {
    const db = await getBnbAgentCacheDb();
    if (!db) return;
    const collection = db.collection<BnbAgentCacheDocument>(COLLECTIONS.BNB_AGENT_CACHE);
    await Promise.all([
      collection.createIndex({ chainId: 1, tokenId: 1 }, { unique: true }),
      collection.createIndex({ source: 1, cachedAt: -1 }),
      collection.createIndex({ category: 1, executionStatus: 1, "sort.readyRank": -1, "sort.totalScore": -1 }),
      collection.createIndex({ searchTokens: 1 }),
      collection.createIndex({ needsHydration: 1, hydrationStatus: 1, hydrateAfter: 1 }),
      collection.createIndex({ hasCallableEndpoint: 1, inspectedRuntimeMetadataFingerprint: 1 }),
      db.collection(COLLECTIONS.BNB_AGENT_CACHE_RUNS).createIndex({ type: 1, createdAt: -1 }),
    ]);
  })().catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function cacheDocument(agent: BnbAgentProfile, now: Date, options: CacheUpsertOptions): BnbAgentCacheDocument {
  const executionStatus = agent.executionStatus || "listed_only";
  const hasCallableEndpoint = Boolean(agent.executionEndpoints?.some((endpoint) => (
    endpoint.adapter === "mcp" ||
    endpoint.adapter === "a2a" ||
    endpoint.adapter === "x402" ||
    endpoint.adapter === "http"
  )));
  const needsHydration = !options.hydrated && (
    agent.sourceFreshness.source === "8004scan"
      ? mayNeedHydration(agent)
      : Boolean(options.queueHydration && hasCallableEndpoint)
  );
  const runtimeHydrated = Boolean(options.hydrated || options.runtimeProbed);

  return {
    _id: cacheKey(agent.chainId, agent.tokenId),
    chainId: agent.chainId,
    tokenId: agent.tokenId,
    agent,
    source: agent.sourceFreshness.source,
    category: agent.category,
    activationStatus: agent.activationStatus,
    executionStatus,
    hasCallableEndpoint,
    needsHydration: needsHydration && !options.hydrated,
    hydrationStatus: runtimeHydrated ? "hydrated" : needsHydration ? "pending" : "none",
    hydrateAttempts: 0,
    hydrateAfter: now,
    searchTokens: tokenizeAgent(agent),
    runtimeMetadataFingerprint: runtimeMetadataFingerprint(agent),
    sort: {
      readyRank: readyRank(agent),
      sourceRank: sourceRank(agent.sourceFreshness.source),
      totalScore: normalizedRankingScore(agent.scoreBreakdown?.total ?? agent.sourceMetrics?.totalScore),
      feedbackCount: agent.feedback.count || 0,
      feedbackScore: agent.feedback.score || 0,
      lastActivityMs: Date.parse(agent.lastActivity) || 0,
    },
    cachedAt: now,
    refreshedAt: now,
    lastSeenAt: now,
    ...(options.hydrated ? { hydratedAt: now } : {}),
    ...(options.runtimeProbed ? { runtimeProofAt: now } : {}),
    ...(options.runtimeProbed ? { runtimeProofVersion: RUNTIME_PROOF_VERSION } : {}),
    ...(options.runtimeProbed ? { runtimeProofChainId: getBscChainId() } : {}),
  };
}

function runtimeMetadataFingerprint(agent: BnbAgentProfile) {
  const revision = {
    chainId: agent.chainId,
    tokenId: agent.tokenId,
    metadataUri: agent.metadataUri || "",
    sourceAgentId: agent.sourceMetrics?.sourceAgentId || "",
    sourceUpdatedAt: agent.sourceMetrics?.updatedAt || "",
    supportedProtocols: [...(agent.sourceMetrics?.supportedProtocols || [])]
      .map((protocol) => protocol.trim().toLowerCase())
      .filter(Boolean)
      .sort(),
    mcpSupport: agent.mcpSupport,
    a2aSupport: agent.a2aSupport,
    x402Support: agent.x402Support,
  };
  return createHash("sha256").update(JSON.stringify(revision)).digest("hex");
}

function mergeCachedAgentProfile(
  existing: BnbAgentCacheDocument | undefined,
  incoming: BnbAgentProfile,
  options: CacheUpsertOptions,
  now: Date,
): BnbAgentProfile {
  if (!existing) return incoming;

  const cached = existing.agent;
  const incomingHasCallableEndpoint = Boolean(incoming.executionEndpoints?.length);
  const cachedProofCurrent = existing.runtimeProofVersion === RUNTIME_PROOF_VERSION
    && existing.runtimeProofChainId === getBscChainId()
    && Boolean(existing.runtimeProofAt)
    && now.getTime() - existing.runtimeProofAt!.getTime() <= runtimeProofTtlMs();
  const preserveLastKnownRuntime = !incomingHasCallableEndpoint
    && Boolean(cached.executionEndpoints?.length)
    && cachedProofCurrent;
  if ((options.hydrated || options.runtimeProbed) && !preserveLastKnownRuntime) return incoming;

  const executionEndpoints = mergeExecutionEndpoints(cached.executionEndpoints || [], incoming.executionEndpoints || []);
  const preserveRuntimeProof = Boolean(
    cached.hasActionableEndpointCapabilities !== undefined
    || cached.endpointCapabilities?.length
    || cached.executionEndpoints?.length,
  );

  return {
    ...cached,
    ...incoming,
    ...((incoming.imageUrl || cached.imageUrl) ? { imageUrl: incoming.imageUrl || cached.imageUrl } : {}),
    services: mergeAgentServices(cached.services, incoming.services),
    capabilities: Array.from(new Set([...cached.capabilities, ...incoming.capabilities])),
    executionEndpoints,
    ...(preserveRuntimeProof ? {
      executionStatus: cached.executionStatus,
      activationStatus: cached.activationStatus,
      ...(cached.endpointCapabilities ? { endpointCapabilities: cached.endpointCapabilities } : {}),
      ...(cached.hasActionableEndpointCapabilities !== undefined
        ? { hasActionableEndpointCapabilities: cached.hasActionableEndpointCapabilities }
        : {}),
    } : {}),
  };
}

function mergeExecutionEndpoints(
  cached: NonNullable<BnbAgentProfile["executionEndpoints"]>,
  incoming: NonNullable<BnbAgentProfile["executionEndpoints"]>,
) {
  const endpoints = new Map<string, BnbExecutionEndpoint>();
  for (const endpoint of [...cached, ...incoming]) {
    const key = `${endpoint.adapter}:${endpoint.url}`;
    const previous = endpoints.get(key);
    endpoints.set(key, previous ? {
      ...previous,
      ...endpoint,
      verified: previous.verified || endpoint.verified,
    } : endpoint);
  }
  return Array.from(endpoints.values());
}

function mergeAgentServices(cached: BnbAgentProfile["services"], incoming: BnbAgentProfile["services"]) {
  const services = new Map<string, BnbAgentProfile["services"][number]>();
  for (const service of [...cached, ...incoming]) {
    const key = `${service.type}:${service.name.toLowerCase()}`;
    const previous = services.get(key);
    services.set(key, previous ? {
      ...previous,
      ...service,
      endpoint: service.endpoint || previous.endpoint,
      price: service.price || previous.price,
    } : service);
  }
  return Array.from(services.values());
}

function cacheFilter(query: BnbAgentQuery) {
  const filter: Record<string, unknown> = {};
  if (isStrictBscAgentDiscoveryEnabled()) filter.source = "8004scan";
  if (query.category) filter.category = query.category;
  if (query.activation) filter.activationStatus = query.activation;
  if (query.execution === "hireable") {
    filter.executionStatus = "ready_to_run";
    filter["agent.hasActionableEndpointCapabilities"] = true;
    filter.runtimeProofVersion = RUNTIME_PROOF_VERSION;
    filter.runtimeProofChainId = getBscChainId();
    filter.runtimeProofAt = { $gte: new Date(Date.now() - runtimeProofTtlMs()) };
  } else if (query.execution) {
    filter.executionStatus = query.execution;
  }
  const tokens = tokenize(`${query.q || ""} ${integrationSearchText(query.integration)}`).slice(0, 4);
  if (tokens.length > 0) filter.searchTokens = { $all: tokens };
  return filter;
}

function cacheSort(sort?: string | null): Record<string, 1 | -1> {
  if (sort === "freshness" || sort === "newest") {
    return { "sort.readyRank": -1, "sort.lastActivityMs": -1, "sort.totalScore": -1, _id: 1 };
  }
  if (sort === "feedback") {
    return { "sort.readyRank": -1, "sort.feedbackScore": -1, "sort.feedbackCount": -1, "sort.totalScore": -1, _id: 1 };
  }
  if (sort === "reviews") {
    return { "sort.readyRank": -1, "sort.feedbackCount": -1, "sort.feedbackScore": -1, "sort.totalScore": -1, _id: 1 };
  }
  return { "sort.readyRank": -1, "sort.totalScore": -1, "sort.feedbackCount": -1, "sort.feedbackScore": -1, "sort.sourceRank": -1, "sort.lastActivityMs": -1, _id: 1 };
}

function cacheHitIsUsable(query: BnbAgentQuery, docs: BnbAgentCacheDocument[], total: number, limit: number, page: number) {
  if (docs.length === 0) return false;

  const hasNarrowFilter = Boolean(
    query.q?.trim() ||
    query.category ||
    query.activation ||
    query.execution ||
    query.integration,
  );
  if (!hasNarrowFilter && page === 1 && total < Math.min(limit, 12)) return false;
  return true;
}

function agentFromCacheDocument(doc: BnbAgentCacheDocument) {
  const cachedAgent = withBnbAgentImage(doc.agent);
  const executionEndpoints = (cachedAgent.executionEndpoints || [])
    .filter((endpoint) => validatePublicHttpsUrl(endpoint.url).ok);
  const proofExpired = !doc.runtimeProofAt
    || Date.now() - doc.runtimeProofAt.getTime() > runtimeProofTtlMs();
  const proofCurrent = doc.runtimeProofVersion === RUNTIME_PROOF_VERSION
    && doc.runtimeProofChainId === getBscChainId()
    && !proofExpired;
  if (
    !proofCurrent &&
    cachedAgent.executionStatus === "ready_to_run"
  ) {
    const agent = withoutRuntimeCapabilityProof(cachedAgent);
    return {
      ...agent,
      executionEndpoints,
      executionStatus: executionEndpoints.length > 0 ? "connectable" as const : "listed_only" as const,
      activationStatus: executionEndpoints.length > 0 ? "request" as const : "discoverable" as const,
    };
  }
  if (!proofCurrent && cachedAgent.hasActionableEndpointCapabilities !== undefined) {
    const agent = withoutRuntimeCapabilityProof(cachedAgent);
    return {
      ...agent,
      executionEndpoints,
      executionStatus: executionEndpoints.length > 0 ? "connectable" as const : "listed_only" as const,
      activationStatus: executionEndpoints.length > 0 ? "request" as const : "discoverable" as const,
    };
  }
  if (executionEndpoints.length !== (cachedAgent.executionEndpoints || []).length) {
    return {
      ...cachedAgent,
      executionEndpoints,
      executionStatus: executionEndpoints.length > 0 ? cachedAgent.executionStatus : "listed_only" as const,
      activationStatus: executionEndpoints.length > 0 ? cachedAgent.activationStatus : "discoverable" as const,
    };
  }
  return cachedAgent;
}

function withoutRuntimeCapabilityProof(agent: BnbAgentProfile) {
  const result = { ...agent };
  delete result.endpointCapabilities;
  delete result.hasActionableEndpointCapabilities;
  return result;
}

function runtimeProofTtlMs() {
  const seconds = Number.parseInt(process.env.BNB_ENDPOINT_CAPABILITY_TTL_SECONDS || String(6 * 60 * 60), 10);
  const bounded = Number.isFinite(seconds)
    ? Math.min(Math.max(seconds, 5 * 60), 7 * 24 * 60 * 60)
    : 6 * 60 * 60;
  return bounded * 1000;
}

function cacheKey(chainId: string | number, tokenId: string | number) {
  return `${chainId}:${tokenId}`;
}

function boundedMs(name: string, fallbackSeconds: number, minSeconds: number, maxSeconds: number) {
  const value = Number.parseInt(process.env[name] || String(fallbackSeconds), 10);
  const seconds = Number.isFinite(value) ? Math.min(Math.max(value, minSeconds), maxSeconds) : fallbackSeconds;
  return seconds * 1000;
}

function tokenizeAgent(agent: BnbAgentProfile) {
  return tokenize([
    agent.name,
    agent.description,
    agent.category,
    agent.ownerAddress,
    agent.agentWallet,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type} ${service.endpoint || ""}`).join(" "),
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
  ].join(" "));
}

function tokenize(value: string) {
  return Array.from(new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && word.length <= 48),
  ));
}

function mayNeedHydration(agent: BnbAgentProfile) {
  const text = [
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
    agent.x402Support ? "x402" : "",
  ].join(" ").toLowerCase();
  return /\b(mcp|a2a|x402|http|api)\b/.test(text);
}

function readyRank(agent: BnbAgentProfile) {
  if (agent.executionStatus === "ready_to_run" && agent.hasActionableEndpointCapabilities === true) return 6;
  if (agent.executionStatus === "ready_to_run") return 5;
  if (agent.executionStatus === "connectable" && agent.hasActionableEndpointCapabilities !== false && agent.executionEndpoints?.length) return 4;
  if (agent.executionStatus === "listed_only") return 2;
  return 0;
}

function normalizedRankingScore(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Number(value), 0), 100);
}

function sourceRank(source: BnbAgentSource) {
  if (source === "agent402" || source === "402index" || source === "x402direct" || source === "the402") return 3;
  if (source === "8004scan") return 2;
  if (source === "configured") return 1;
  return 0;
}

function integrationSearchText(value?: string | null) {
  const integration = String(value || "").trim().toLowerCase();
  if (integration === "pancakeswap") return "pancakeswap pancake cake lp farm swap liquidity";
  if (integration === "altana") return "altana wallet health permission session risk";
  if (integration === "8004scan") return "8004scan";
  return "";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
