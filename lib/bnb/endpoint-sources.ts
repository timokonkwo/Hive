import { createHash } from "node:crypto";
import {
  BNB_AGENT_CATEGORIES,
  type BnbAgentCategory,
  type BnbAgentProfile,
  type BnbAgentService,
  type BnbAgentSource,
  type BnbExecutionEndpoint,
} from "@/lib/bnb/types";
import { safeFetchJson } from "@/lib/bnb/endpoint-security";

const BSC_CHAIN_ID = 56;
const DEFAULT_REGISTRY = "endpoint-index";
const DEFAULT_QUERY = "BNB Chain DeFi wallet risk yield liquidity PancakeSwap Venus";

type EndpointSourceId = Extract<BnbAgentSource, "agent402" | "402index" | "x402direct" | "the402">;

type EndpointAgentSeed = {
  source: EndpointSourceId;
  externalId: string;
  name: string;
  description: string;
  endpoint: string;
  method?: "GET" | "POST";
  endpointLabel?: string;
  provider?: string;
  providerUrl?: string;
  categoryText?: string;
  tags?: string[];
  networks?: string[];
  price?: string;
  priceUsd?: number;
  inputSchema?: unknown;
  paymentRequired?: boolean;
  verified?: boolean;
  healthScore?: number;
  score?: number;
  lastActivity?: string;
};

const categoryKeywords: Record<BnbAgentCategory, string[]> = {
  Rebalancing: ["rebalance", "range", "lp", "liquidity", "position", "portfolio", "pool", "fee tier", "concentrated"],
  "Grid Trading": ["grid", "strategy", "trading", "volatility", "bot", "market making", "range order", "execution"],
  "Yield Optimisation": ["yield", "apr", "apy", "farm", "vault", "staking", "route", "cake", "pancake", "beefy", "earn"],
  "Health Factor Monitoring": ["health", "liquidation", "borrow", "loan", "venus", "risk", "collateral", "threshold", "alert"],
  Other: [],
};

const bnbChainContextTerms = [
  "bnb",
  "bsc",
  "bnb chain",
  "binance smart chain",
  "eip155:56",
  "bep20",
  "opbnb",
  "pancake",
  "pancakeswap",
  "venus",
  "lista",
];

const bnbAgentDomainTerms = [
  "defi",
  "dex",
  "bep20",
  "swap",
  "liquidity",
  "pool",
  "yield",
  "farm",
  "staking",
  "collateral",
  "borrow",
  "lending",
  "pancake",
  "pancakeswap",
  "venus",
  "lista",
  "aave",
  "health factor",
  "liquidation",
  "trading pair",
  "token pair",
];

export async function listBnbEndpointSourceAgents({
  q,
  category,
  limit = 24,
}: {
  q?: string | null;
  category?: string | null;
  limit?: number;
} = {}) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const query = endpointDiscoveryQuery(q, category);
  const candidates = await Promise.all([
    sourceEnabled("BNB_AGENT402_ENABLED", true) ? fetchAgent402Agents(query, safeLimit) : Promise.resolve([]),
    sourceEnabled("BNB_402INDEX_ENABLED", true) ? fetch402IndexAgents(query, safeLimit) : Promise.resolve([]),
    sourceEnabled("BNB_X402DIRECT_ENABLED", true) ? fetchX402DirectAgents(query, safeLimit) : Promise.resolve([]),
    sourceEnabled("BNB_THE402_ENABLED", true) ? fetchThe402Agents(query, safeLimit) : Promise.resolve([]),
  ]);

  return uniqueEndpointAgents(candidates.flat())
    .filter((agent) => endpointAgentMatchesContext(agent, q, category))
    .slice(0, safeLimit);
}

export async function getBnbEndpointSourceAgent(tokenId: string) {
  const decodedTokenId = decodeTokenId(tokenId);
  const parsed = parseEndpointTokenId(decodedTokenId);
  if (!parsed) return null;

  const query = parsed.slug.replace(/-/g, " ");
  const agents = await listBnbEndpointSourceAgents({ q: query, limit: 50 });
  return agents.find((agent) => agent.tokenId === decodedTokenId) || null;
}

export function getBnbEndpointSourceReadiness() {
  return {
    agent402: sourceEnabled("BNB_AGENT402_ENABLED", true),
    "402index": sourceEnabled("BNB_402INDEX_ENABLED", true),
    x402direct: sourceEnabled("BNB_X402DIRECT_ENABLED", true),
    the402: sourceEnabled("BNB_THE402_ENABLED", true),
  };
}

async function fetchAgent402Agents(query: string, limit: number) {
  const baseUrl = sourceBaseUrl("BNB_AGENT402_API_BASE", "https://agent402.tools");
  if (!baseUrl) return [];

  const routePayload = await fetchDiscoveryJson(`${baseUrl}/api/route`, {
    method: "POST",
    body: JSON.stringify({ query, top: Math.min(limit, 12), include: "external" }),
  });
  const findUrl = new URL(`${baseUrl}/api/find`);
  findUrl.searchParams.set("q", query);
  findUrl.searchParams.set("limit", String(Math.min(limit, 12)));
  const findPayload = await fetchDiscoveryJson(findUrl);

  const routeSeeds = rawArray(routePayload, ["results", "data", "tools"]).map((raw): EndpointAgentSeed => {
    const record = asRecord(raw);
    const endpoint = absoluteEndpoint(textFrom(record.url) || textFrom(record.route), baseUrl);
    const health = numberFrom(record.health);
    return {
      source: "agent402",
      externalId: textFrom(record.slug ?? record.id ?? record.route ?? record.url, endpoint),
      name: endpointServiceName(record.name ?? record.slug, record.description, endpoint),
      description: endpointDescription(record.description),
      endpoint,
      method: methodFrom(record.method, "GET"),
      endpointLabel: "Agent402",
      provider: textFrom(record.sellerName ?? record.seller, "Agent402"),
      providerUrl: textFrom(record.sellerHome, ""),
      categoryText: textFrom(record.category, ""),
      tags: arrayFrom(record.tags),
      networks: arrayFrom(record.networks ?? record.network),
      price: priceLabel(record.price, record.priceUsd ?? record.price_usd),
      priceUsd: numberFrom(record.priceUsd ?? record.price_usd),
      paymentRequired: paymentRequired(record.price ?? record.priceUsd ?? record.price_usd, record.payable ?? record.scheme),
      verified: health !== undefined ? health > 0 : Boolean(endpoint),
      healthScore: health !== undefined ? health * 100 : undefined,
      lastActivity: textFrom(record.lastSeen ?? record.updatedAt ?? record.createdAt, ""),
    };
  });

  const findSeeds = rawArray(findPayload, ["tools", "results", "data"]).map((raw): EndpointAgentSeed => {
    const record = asRecord(raw);
    const endpoint = absoluteEndpoint(textFrom(record.url) || textFrom(record.route), baseUrl);
    const computedPayable = record.computePayable === true || record.payable === true;
    return {
      source: "agent402",
      externalId: textFrom(record.slug ?? record.id ?? record.route ?? record.url, endpoint),
      name: endpointServiceName(record.name ?? record.slug, record.description, endpoint),
      description: endpointDescription(record.description),
      endpoint,
      method: methodFrom(record.method, "GET"),
      endpointLabel: "Agent402",
      provider: textFrom(record.sellerName ?? record.seller, "Agent402"),
      providerUrl: textFrom(record.sellerHome, ""),
      categoryText: textFrom(record.category, ""),
      tags: arrayFrom(record.tags),
      networks: arrayFrom(record.networks ?? record.network),
      price: priceLabel(record.price, record.priceUsd ?? record.price_usd),
      priceUsd: numberFrom(record.priceUsd ?? record.price_usd),
      paymentRequired: computedPayable || paymentRequired(record.price ?? record.priceUsd ?? record.price_usd, record.payable ?? record.scheme),
      verified: Boolean(endpoint),
      lastActivity: textFrom(record.lastSeen ?? record.updatedAt ?? record.createdAt, ""),
    };
  });

  return normalizeEndpointSeeds([...routeSeeds, ...findSeeds], query);
}

async function fetch402IndexAgents(query: string, limit: number) {
  const baseUrl = sourceBaseUrl("BNB_402INDEX_API_BASE", "https://402index.io");
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/v1/services`);
  url.searchParams.set("limit", String(Math.min(limit, 24)));
  url.searchParams.set("q", query);
  const payload = await fetchDiscoveryJson(url);

  return compactAgents(rawArray(payload, ["services", "results", "data"]).map((raw) => {
    const record = asRecord(raw);
    const endpoint = textFrom(record.url);
    const healthStatus = textFrom(record.health_status ?? record.probe_status).toLowerCase();
    const reliability = numberFrom(record.reliability_score);
    return normalizeEndpointAgent({
      source: "402index",
      externalId: textFrom(record.id ?? record.url, endpoint),
      name: endpointServiceName(record.name, record.description, endpoint),
      description: endpointDescription(record.description),
      endpoint,
      method: methodFrom(record.http_method, "GET"),
      endpointLabel: "402Index",
      provider: textFrom(asRecord(record.provider).name ?? record.provider_name ?? record.provider, "402Index"),
      providerUrl: textFrom(asRecord(record.provider).url ?? record.provider_url, ""),
      categoryText: textFrom(record.category, ""),
      tags: arrayFrom(record.tags ?? record.source),
      networks: arrayFrom(record.payment_network ?? record.network),
      price: priceLabel(record.price ?? record.price_usd, record.price_usd),
      priceUsd: numberFrom(record.price_usd),
      paymentRequired: paymentRequired(record.price ?? record.price_usd, record.protocol ?? record.payment_asset),
      verified: healthStatus.includes("healthy") || record.x402_payment_valid === true || Boolean(reliability && reliability > 0.5),
      healthScore: reliability !== undefined ? reliability * 100 : undefined,
      score: numberFrom(record.scout_score ?? record.score),
      lastActivity: textFrom(record.last_checked ?? record.lastSeen ?? record.updatedAt, ""),
    });
  }));
}

async function fetchX402DirectAgents(query: string, limit: number) {
  const baseUrl = sourceBaseUrl("BNB_X402DIRECT_API_BASE", "https://x402.direct");
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/services`);
  url.searchParams.set("limit", String(Math.min(limit, 24)));
  url.searchParams.set("sort", "score");
  url.searchParams.set("q", query);
  const payload = await fetchDiscoveryJson(url);

  return compactAgents(rawArray(payload, ["services", "results", "data"]).map((raw) => {
    const record = asRecord(raw);
    const endpoint = textFrom(record.resourceUrl ?? record.url ?? record.endpoint);
    const score = numberFrom(record.scoutScore ?? record.scout_score);
    return normalizeEndpointAgent({
      source: "x402direct",
      externalId: textFrom(record.id ?? record.resourceUrl ?? record.url, endpoint),
      name: endpointServiceName(record.name ?? record.title, record.description, endpoint),
      description: endpointDescription(record.description),
      endpoint,
      method: methodFrom(record.method ?? record.httpMethod, "GET"),
      endpointLabel: "x402.direct",
      provider: textFrom(record.provider ?? record.providerName, "x402.direct"),
      categoryText: textFrom(record.category, ""),
      tags: arrayFrom(record.tags ?? record.type ?? record.scheme),
      networks: arrayFrom(record.network ?? record.networks),
      price: priceLabel(record.price, record.priceUsd ?? record.price_usd),
      priceUsd: numberFrom(record.priceUsd ?? record.price_usd),
      paymentRequired: paymentRequired(record.price ?? record.priceUsd ?? record.price_usd, record.scheme),
      verified: score !== undefined ? score >= 60 : Boolean(endpoint),
      healthScore: score,
      score,
      lastActivity: textFrom(record.lastSeen ?? record.updatedAt ?? record.last_checked, ""),
    });
  }));
}

async function fetchThe402Agents(query: string, limit: number) {
  const baseUrl = sourceBaseUrl("BNB_THE402_API_BASE", "https://api.the402.ai");
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/v1/services/catalog`);
  url.searchParams.set("limit", String(Math.min(limit, 24)));
  url.searchParams.set("q", query);
  const payload = await fetchDiscoveryJson(url);

  return compactAgents(rawArray(payload, ["services", "results", "data"]).map((raw) => {
    const record = asRecord(raw);
    const endpoint = absoluteEndpoint(textFrom(record.endpoint), baseUrl);
    const automated = textFrom(record.fulfillment_type).toLowerCase() === "automated" || record.webhook_healthy === true;
    return normalizeEndpointAgent({
      source: "the402",
      externalId: textFrom(record.id ?? record.endpoint, endpoint),
      name: endpointServiceName(record.name, record.description, endpoint),
      description: endpointDescription(record.description),
      endpoint,
      method: "POST",
      endpointLabel: "the402",
      provider: textFrom(record.provider_name ?? record.provider, "the402"),
      providerUrl: textFrom(record.provider_url, ""),
      categoryText: textFrom(record.category, ""),
      tags: arrayFrom(record.tags ?? record.service_type),
      price: priceLabel(record.price, record.price_usd),
      priceUsd: numberFrom(record.price_usd ?? record.price),
      inputSchema: record.input_schema,
      paymentRequired: paymentRequired(record.price ?? record.price_usd, record.pricing_model),
      verified: automated && record.webhook_healthy === true,
      healthScore: record.webhook_healthy === true ? 100 : undefined,
      lastActivity: textFrom(record.updated_at ?? record.created_at, ""),
    });
  }));
}

function normalizeEndpointAgent(seed: EndpointAgentSeed): BnbAgentProfile | null {
  if (!seed.endpoint || !isSafeHttpsEndpoint(seed.endpoint) || !seed.name.trim()) return null;

  const fetchedAt = new Date().toISOString();
  const sourceId = `${seed.source}:${seed.externalId || seed.endpoint}`;
  const slug = slugify(seed.externalId || seed.name || seed.endpoint).slice(0, 48) || "service";
  const tokenId = `${seed.source}:${slug}:${shortHash(seed.endpoint || sourceId)}`;
  const category = inferCategory([seed.name, seed.description, seed.categoryText, ...(seed.tags || [])].join(" "));
  if (!category) return null;
  const paymentNeeded = seed.paymentRequired ?? paymentRequired(seed.price, "");
  if (paymentNeeded && isProviderRootEndpoint(seed.endpoint) && !seed.inputSchema) return null;
  const ready = Boolean(seed.verified && !paymentNeeded);
  const adapter: BnbExecutionEndpoint["adapter"] = paymentNeeded ? "x402" : "http";
  const endpoint: BnbExecutionEndpoint = {
    adapter,
    url: seed.endpoint,
    label: seed.endpointLabel || (paymentNeeded ? "x402" : "API"),
    verified: Boolean(seed.verified),
    source: seed.source,
    method: seed.method || "GET",
    ...(seed.inputSchema ? { inputSchema: seed.inputSchema } : {}),
    ...(paymentNeeded ? { paymentRequired: true } : {}),
  };
  const price = seed.price || (seed.priceUsd ? `$${seed.priceUsd}` : "");
  const services: BnbAgentService[] = [{
    name: seed.name,
    type: adapter,
    endpoint: seed.endpoint,
    ...(price ? { price } : {}),
  }];
  const wallet = syntheticAddress(sourceId);
  const capabilities = Array.from(new Set([
    seed.categoryText,
    category,
    ...(seed.tags || []),
    ...(seed.networks || []),
    seed.provider,
    paymentNeeded ? "x402" : "HTTP",
  ].filter((value): value is string => Boolean(value && value.trim()))));

  return {
    chainId: BSC_CHAIN_ID,
    tokenId,
    name: seed.name.trim(),
    description: seed.description.trim(),
    category,
    ownerAddress: wallet,
    agentWallet: wallet,
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: seed.providerUrl || seed.endpoint,
    services,
    capabilities,
    x402Support: paymentNeeded,
    erc8183Support: false,
    mcpSupport: false,
    a2aSupport: false,
    feedback: {
      count: 0,
      positive: 0,
      score: scorePercent(seed.score || seed.healthScore),
      summary: "",
    },
    lastActivity: seed.lastActivity || fetchedAt,
    activationStatus: ready ? "callable" : "request",
    executionStatus: ready ? "ready_to_run" : "connectable",
    executionEndpoints: [endpoint],
    sourceFreshness: {
      source: seed.source,
      fetchedAt,
      stale: false,
      note: "Endpoint index.",
    },
    sourceMetrics: {
      sourceAgentId: seed.externalId,
      verified: Boolean(seed.verified),
      healthScore: seed.healthScore,
      totalScore: seed.score || seed.healthScore,
      updatedAt: seed.lastActivity,
      supportedProtocols: [paymentNeeded ? "x402" : "HTTP"],
    },
  };
}

async function normalizeEndpointSeeds(seeds: EndpointAgentSeed[], query: string) {
  const expanded = await Promise.all(seeds.map((seed) => expandX402DiscoverySeed(seed, query)));
  return compactAgents(expanded.flat().map(normalizeEndpointAgent));
}

async function expandX402DiscoverySeed(seed: EndpointAgentSeed, query: string): Promise<EndpointAgentSeed[]> {
  const paymentNeeded = seed.paymentRequired ?? paymentRequired(seed.price, "");
  if (!paymentNeeded || !isProviderRootEndpoint(seed.endpoint)) return [seed];

  const discoveryUrl = rootRelativeUrl(seed.endpoint, "/.well-known/x402");
  if (!discoveryUrl) return [seed];

  const payload = await fetchDiscoveryJson(discoveryUrl);
  const resources = rawArray(payload, ["resources"])
    .map((resource) => asRecord(resource))
    .filter((resource) => isX402ResourceMatch(resource, query))
    .slice(0, 12);

  if (resources.length === 0) return [seed];

  return resources.map((resource) => {
    const endpoint = textFrom(resource.resource ?? resource.url ?? resource.endpoint);
    const listingId = textFrom(resource.listing_id ?? resource.id, endpoint);
    const priceUsd = numberFrom(resource.price_usd ?? resource.priceUsd ?? seed.priceUsd);
    return {
      ...seed,
      externalId: listingId || seed.externalId,
      name: endpointServiceName(resource.name ?? resource.title ?? seed.name, resource.description, endpoint || seed.endpoint),
      description: endpointDescription(resource.description ?? seed.description),
      endpoint: endpoint || seed.endpoint,
      method: methodFrom(resource.method, seed.method || "GET"),
      price: priceLabel(resource.price ?? resource.price_usd ?? seed.price, priceUsd),
      priceUsd,
      networks: [
        ...arrayFrom(resource.network ?? resource.networks),
        ...arrayFrom(resource.chain ?? resource.chains),
        ...(seed.networks || []),
      ],
      tags: [
        ...arrayFrom(resource.type ?? resource.artifact_type ?? resource.instrument_class),
        ...(seed.tags || []),
      ],
      paymentRequired: true,
      verified: seed.verified,
    };
  });
}

function rootRelativeUrl(endpoint: string, path: string) {
  try {
    return new URL(path, endpoint).href;
  } catch {
    return "";
  }
}

function endpointDiscoveryQuery(q?: string | null, category?: string | null) {
  const cleaned = q?.trim();
  if (cleaned) return cleaned;
  if (category && hasCategory(category)) return `${category} ${categoryKeywords[category].join(" ")}`;
  return DEFAULT_QUERY;
}

function endpointAgentMatchesContext(agent: BnbAgentProfile, q?: string | null, category?: string | null) {
  if (!isBnbEndpointAgent(agent)) return false;
  if (category && hasCategory(category) && agent.category !== category) return false;
  if (q?.trim()) return endpointSearchMatches(agent, q);
  return true;
}

function isBnbEndpointAgent(agent: BnbAgentProfile) {
  const normalized = endpointContextText(agent).toLowerCase();
  return (
    bnbChainContextTerms.some((term) => normalized.includes(term)) &&
    bnbAgentDomainTerms.some((term) => normalized.includes(term))
  );
}

function endpointContextText(agent: BnbAgentProfile) {
  return [
    agent.name,
    agent.description,
    agent.category,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type} ${service.endpoint || ""}`).join(" "),
    agent.executionEndpoints?.map((endpoint) => endpoint.url).join(" ") || "",
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
  ].join(" ");
}

function endpointSearchMatches(agent: BnbAgentProfile, q?: string | null) {
  const terms = tokenize(q || "");
  if (terms.length === 0) return true;
  const normalized = endpointContextText(agent).toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function isX402ResourceMatch(resource: Record<string, unknown>, query: string) {
  const terms = tokenize(query).filter((term) => term !== "bnb" && term !== "bsc" && term !== "chain");
  if (terms.length === 0) return true;
  const text = [
    resource.name,
    resource.title,
    resource.description,
    resource.problem_statement,
    resource.listing_id,
    resource.resource,
    resource.network,
    resource.type,
    resource.artifact_type,
    resource.instrument_class,
  ].map((value) => textFrom(value)).join(" ").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
}

function inferCategory(value: string): BnbAgentCategory | null {
  const normalized = value.toLowerCase();
  const scored = BNB_AGENT_CATEGORIES
    .filter((category) => category !== "Other")
    .map((category) => ({
      category,
      score: categoryKeywords[category].reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].category : null;
}

function hasCategory(value: string | null | undefined): value is BnbAgentCategory {
  return BNB_AGENT_CATEGORIES.includes(value as BnbAgentCategory);
}

function sourceEnabled(name: string, defaultValue: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function sourceBaseUrl(name: string, fallback: string) {
  const raw = process.env[name]?.trim() || fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function fetchDiscoveryJson(url: URL | string, options: { method?: "GET" | "POST"; body?: string } = {}) {
  try {
    const { response, payload } = await safeFetchJson(String(url), {
      method: options.method || "GET",
      ...(options.body ? { body: options.body } : {}),
      timeoutMs: discoveryTimeoutMs(),
      maxBytes: 512 * 1024,
    });
    if (!response.ok) return null;
    return payload;
  } catch {
    return null;
  }
}

function discoveryTimeoutMs() {
  const timeout = Number(process.env.BNB_ENDPOINT_DISCOVERY_TIMEOUT_MS || 4500);
  if (!Number.isFinite(timeout)) return 4500;
  return Math.min(Math.max(timeout, 750), 15000);
}

function rawArray(payload: unknown, keys: string[]) {
  const record = asRecord(payload);
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function textFrom(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberFrom(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function arrayFrom(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function methodFrom(value: unknown, fallback: "GET" | "POST"): "GET" | "POST" {
  const method = textFrom(value).toUpperCase();
  return method === "POST" || method === "GET" ? method : fallback;
}

function absoluteEndpoint(value: string, baseUrl: string) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return "";
  }
}

function isSafeHttpsEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function isProviderRootEndpoint(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "");
    return (!path || path === "") && !url.search;
  } catch {
    return false;
  }
}

function paymentRequired(priceValue: unknown, protocolValue: unknown) {
  const protocol = String(protocolValue || "").toLowerCase();
  if (protocol.includes("x402")) return true;
  return hasPositivePrice(priceValue);
}

function hasPositivePrice(value: unknown) {
  const price = String(value ?? "").trim().toLowerCase();
  if (!price || ["free", "not listed", "not set", "price not set", "price on request"].includes(price)) return false;
  const number = Number(price.replace(/[^0-9.]+/g, ""));
  if (!Number.isFinite(number)) return false;
  return number > 0;
}

function priceLabel(value: unknown, usdValue?: unknown) {
  const raw = textFrom(value);
  if (raw) return raw;
  const usd = numberFrom(usdValue);
  return usd && usd > 0 ? `$${usd}` : "";
}

function scorePercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.max(value > 5 ? value : value * 20, 0), 100);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function syntheticAddress(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

function endpointServiceName(value: unknown, description: unknown, endpoint: string) {
  const raw = textFrom(value);
  const desc = textFrom(description);
  const descriptiveFallback = desc.length >= 12 ? desc : nameFromEndpoint(endpoint);
  const candidate = isGenericEndpointName(raw) ? descriptiveFallback : raw || descriptiveFallback;
  return truncate(cleanEndpointText(candidate), 96) || "Endpoint service";
}

function endpointDescription(value: unknown) {
  return truncate(cleanEndpointText(textFrom(value)), 320);
}

function cleanEndpointText(value: string) {
  return value
    .replace(/\s+-\s+lets agents.+$/i, "")
    .replace(/\s+(?:yield pools|best apy|defi yield|yield farming|highest apy|staking rewards).+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericEndpointName(value: string) {
  return /^(api|available|endpoint|live|service|tool|x402)$/i.test(value.trim());
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  const sliced = value.slice(0, max).trim();
  const boundary = sliced.replace(/\s+\S*$/, "").trim();
  return boundary.length >= max * 0.6 ? boundary : sliced;
}

function nameFromEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const path = url.pathname.split("/").filter(Boolean).slice(-2).join(" ");
    return path ? `${url.hostname} ${path}` : url.hostname;
  } catch {
    return "x402 service";
  }
}

function compactAgents(values: Array<BnbAgentProfile | null>) {
  return values.filter((agent): agent is BnbAgentProfile => Boolean(agent));
}

function uniqueEndpointAgents(agents: BnbAgentProfile[]) {
  const seen = new Set<string>();
  return agents.filter((agent) => {
    const endpoint = agent.executionEndpoints?.[0]?.url || agent.tokenId;
    const key = `${agent.sourceFreshness.source}:${endpoint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseEndpointTokenId(tokenId: string): { source: EndpointSourceId; slug: string } | null {
  const match = tokenId.match(/^(agent402|402index|x402direct|the402):([^:]+):[a-f0-9]{10}$/);
  if (!match) return null;
  return { source: match[1] as EndpointSourceId, slug: match[2] };
}

function decodeTokenId(tokenId: string) {
  try {
    return decodeURIComponent(tokenId);
  } catch {
    return tokenId;
  }
}
