import {
  BNB_AGENT_CATEGORIES,
  type BnbActivationStatus,
  type BnbAgentPageResult,
  type BnbAltanaSessionTemplate,
  type BnbAgentCategory,
  type BnbExecutionEndpoint,
  type BnbExecutionStatus,
  type BnbAgentProfile,
  type BnbAgentQuery,
  type BnbAgentService,
  type BnbPancakeSwapUtility,
  type BnbPartnerTrackSummary,
  type BnbScoreBreakdown,
  type BnbTermixCapture,
} from "@/lib/bnb/types";
import { resolveBnbAgentRuntime, resolveBnbAgentsRuntime } from "@/lib/bnb/adapters/registry";
import {
  claimBnbAgentHydrationBatch,
  completeBnbAgentHydration,
  getCachedBnbAgent,
  overlayCachedBnbAgentDetails,
  readCachedBnbAgentsPage,
  readCachedBnbPromotionCandidates,
  readCachedBnbRuntimeCandidates,
  recordBnbAgentCacheRun,
  upsertBnbAgentCache,
} from "@/lib/bnb/agent-cache";
import { applyBnbEndpointCapabilitySnapshots } from "@/lib/bnb/endpoint-capabilities";
import { applyBnbEndpointProbeHealth } from "@/lib/bnb/endpoint-observability";
import { safeFetchJson, validatePublicHttpsUrl } from "@/lib/bnb/endpoint-security";
import { getBnbEndpointSourceAgent, listBnbEndpointSourceAgents } from "@/lib/bnb/endpoint-sources";
import { applyBnbListingModeration, isBnbListingModerated } from "@/lib/bnb/moderation";
import { isBnbAgentHireable } from "@/lib/bnb/readiness";
import {
  isBnbAgentVisibleInDiscovery,
  isStrictBscAgentDiscoveryEnabled,
} from "@/lib/bnb/discovery-policy";

const BSC_CHAIN_ID = 56;
export const BNB_REGISTERED_AGENT_FLOOR = 200_000;
const DEFAULT_PROMOTED_AGENT_LIMIT = 12;
const DEFAULT_RECOMMENDATION_WINDOW = 50;
const MAX_8004_MEMORY_CACHE_ENTRIES = 200;
const DEFAULT_REGISTRY = "0x8004scan-bsc-registry";
const DEFAULT_FETCHED_AT = "2026-08-06T00:00:00.000Z";

export type BnbAgentNetworkStats = {
  totalAgents: number;
  totalFeedbacks: number;
  averageFeedbackScore?: number;
  updatedAt: string;
};

type Bnb8004PageResult = {
  agents: BnbAgentProfile[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

type Bnb8004Protocol = "MCP" | "A2A" | "OASF" | "Web" | "Email";

type Bnb8004MemoryCacheEntry = {
  payload: unknown;
  expiresAt: number;
};

type StableRecommendationRank = {
  relevance: number;
  fit: number;
  promotion: number;
  reputation: number;
  sourceQuality: number;
  freshness: number;
  family: string;
  key: string;
};

const bnb8004MemoryCache = new Map<string, Bnb8004MemoryCacheEntry>();
const bnb8004InFlight = new Map<string, Promise<unknown | null>>();

const categoryKeywords: Record<BnbAgentCategory, string[]> = {
  Rebalancing: ["rebalance", "range", "lp", "liquidity", "position", "portfolio", "pool", "fee tier", "concentrated"],
  "Grid Trading": ["grid", "strategy", "trading", "volatility", "bot", "market making", "range order", "execution"],
  "Yield Optimisation": ["yield", "apr", "apy", "farm", "vault", "staking", "route", "cake", "pancake", "beefy", "earn"],
  "Health Factor Monitoring": ["health", "liquidation", "borrow", "loan", "venus", "risk", "collateral", "threshold", "alert"],
  Other: [],
};

const categoryInferenceKeywords: Record<BnbAgentCategory, string[]> = {
  Rebalancing: ["rebalance", "lp", "liquidity", "liquidity position", "pool", "fee tier", "concentrated liquidity"],
  "Grid Trading": ["grid", "grid trading", "trading bot", "market making", "range order", "execution strategy"],
  "Yield Optimisation": ["yield", "apr", "apy", "farm", "vault", "staking", "cake", "pancake", "pancakeswap", "beefy", "earn"],
  "Health Factor Monitoring": ["health factor", "liquidation", "borrow", "loan", "venus", "aave", "lista", "collateral", "wallet monitoring", "risk alert"],
  Other: [],
};
const marketplaceCategories = BNB_AGENT_CATEGORIES.filter((category) => category !== "Other");
const categorySearchSeeds: Record<BnbAgentCategory, string> = {
  Rebalancing: "liquidity rebalance",
  "Grid Trading": "grid",
  "Yield Optimisation": "yield",
  "Health Factor Monitoring": "health liquidation",
  Other: "",
};

const searchAliases: Record<string, string[]> = {
  lp: ["liquidity", "pool", "position", "range", "pancakeswap", "fee tier", "concentrated liquidity"],
  liquidity: ["lp", "pool", "range", "rebalance", "pancakeswap", "infinity", "stableswap"],
  liquidation: ["health", "borrow", "loan", "venus", "collateral"],
  venus: ["health", "borrow", "loan", "liquidation", "collateral", "lending"],
  lending: ["health", "borrow", "loan", "venus", "collateral"],
  farm: ["yield", "apr", "apy", "vault", "staking", "pancakeswap", "cake"],
  route: ["yield", "swap", "pancakeswap", "routing"],
  swap: ["route", "pancakeswap", "token", "price", "slippage"],
  grid: ["strategy", "trading", "range", "volatility", "market making"],
  bnb: ["bsc", "bnb chain", "defi", "wallet"],
  bsc: ["bnb", "bnb chain", "defi", "wallet"],
};

const bnbMarketKeywords = [
  "bnb",
  "bsc",
  "bnb chain",
  "defi",
  "yield",
  "farm",
  "vault",
  "staking",
  "liquidity",
  "pool",
  "swap",
  "route",
  "pancake",
  "pancakeswap",
  "venus",
  "health factor",
  "liquidation",
  "collateral",
  "borrow",
  "wallet",
  "crypto",
  "risk",
  "oasf",
];

const bnbMarketplaceDomainKeywords = [
  "aave",
  "amm",
  "apy",
  "apr",
  "bep20",
  "borrow",
  "btcb",
  "cake",
  "collateral",
  "concentrated liquidity",
  "defi",
  "dex",
  "farm",
  "fee tier",
  "health factor",
  "lending",
  "liquidation",
  "liquidity",
  "liquidity pool",
  "lp",
  "pancake",
  "pancakeswap",
  "pool",
  "rebalance",
  "staking",
  "swap",
  "token pair",
  "trading pair",
  "uniswap",
  "venus",
  "vault",
  "wagmi",
  "yield",
];

export const bnbPartnerTracks: BnbPartnerTrackSummary[] = [
  {
    id: "pancakeswap",
    name: "PancakeSwap",
    href: "/bnb/pancakeswap",
    productFit: "Find yield and LP agents.",
    userProblem: "Rank farms, review LP ranges, and save the result.",
    hiveSurface: "Yield and LP jobs.",
  },
  {
    id: "termix",
    name: "TermiX",
    href: "/bnb/termix",
    productFit: "Compare manual work with agent work.",
    userProblem: "Save the target, result, time spent, and final decision.",
    hiveSurface: "Comparison records.",
  },
  {
    id: "altana",
    name: "Altana",
    href: "/bnb/altana",
    productFit: "Set wallet alerts.",
    userProblem: "Let an agent watch a wallet or position and save the alert.",
    hiveSurface: "Wallet alerts.",
  },
];

export const bnbPancakeSwapUtilities: BnbPancakeSwapUtility[] = [
  {
    id: "rank-yield-routes",
    title: "Rank BSC yield routes",
    agentName: "Yield agents",
    agentTokenId: "",
    userInput: "Stablecoin amount, minimum liquidity, risk tolerance, lockup preference.",
    agentOutput: "Ranked PancakeSwap farms and pools with net APR, liquidity depth, volatility notes, and risk flags.",
    decisionMetric: "Best route must include a risk-adjusted APR and a reason to reject at least one tempting pool.",
    activationHref: "/bnb/agents?category=Yield%20Optimisation&q=PancakeSwap%20yield",
    scoring: [
      { label: "Target time", value: "Under 60 sec" },
      { label: "Target cost", value: "User budget" },
      { label: "Saved result", value: "Route ranking" },
    ],
  },
  {
    id: "review-lp-range",
    title: "Review LP range",
    agentName: "Liquidity agents",
    agentTokenId: "",
    userInput: "Pool address, current range, position size, preferred rebalance threshold.",
    agentOutput: "Hold, widen, narrow, or reset recommendation with impermanent-loss and fee capture notes.",
    decisionMetric: "Recommendation must state the current price distance from range edge and the action threshold.",
    activationHref: "/bnb/agents?category=Rebalancing&q=PancakeSwap%20liquidity%20range",
    scoring: [
      { label: "Target time", value: "Under 2 min" },
      { label: "Target cost", value: "User budget" },
      { label: "Saved result", value: "LP decision" },
    ],
  },
  {
    id: "watch-farm-route",
    title: "Watch a farm route",
    agentName: "Yield agents",
    agentTokenId: "",
    userInput: "Wallet or position label, farm route, minimum APR delta, alert destination.",
    agentOutput: "Route watch plan with alert trigger, expected review cadence, and safe-stop condition.",
    decisionMetric: "Watch plan must include a trigger that avoids noisy alerts and stale APR reactions.",
    activationHref: "/bnb/agents?category=Yield%20Optimisation&q=PancakeSwap%20farm%20alert",
    scoring: [
      { label: "Target time", value: "Under 90 sec" },
      { label: "Target cost", value: "User budget" },
      { label: "Saved result", value: "Watch receipt" },
    ],
  },
];

export const bnbTermixCaptures: BnbTermixCapture[] = [
  {
    id: "token-pool-risk",
    title: "Token and pool risk comparison",
    target: "Token contract or PancakeSwap pool address",
  },
  {
    id: "trader-route-review",
    title: "Trader route review",
    target: "Swap route or token pair",
  },
  {
    id: "agent-response-quality",
    title: "Agent result review",
    target: "Any TermiX task prompt",
  },
];

export const bnbAltanaSessionTemplates: BnbAltanaSessionTemplate[] = [
  {
    id: "health-factor-watch",
    title: "Health factor alert",
    agentTokenId: "",
    summary: "Watch a lending position and alert when the health factor gets too low.",
    spendCap: "0.001 BNB",
    expiry: "7 days",
  },
  {
    id: "yield-scan-only",
    title: "Yield route alert",
    agentTokenId: "",
    summary: "Watch selected farms and alert when a route needs review.",
    spendCap: "0.001 BNB",
    expiry: "24 hours",
  },
  {
    id: "lp-rebalance-request",
    title: "LP range alert",
    agentTokenId: "",
    summary: "Watch an LP position and alert when the range needs review.",
    spendCap: "0.001 BNB",
    expiry: "48 hours",
  },
];

function hasCategory(value: string | null | undefined): value is BnbAgentCategory {
  return BNB_AGENT_CATEGORIES.includes(value as BnbAgentCategory);
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

function positiveNumberFrom(...values: unknown[]) {
  for (const value of values) {
    const number = numberFrom(value);
    if (number !== undefined && number > 0) return number;
  }
  return 0;
}

function firstNumberFrom(...values: unknown[]) {
  for (const value of values) {
    const number = numberFrom(value);
    if (number !== undefined) return number;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scorePercent(value: number | undefined) {
  if (!Number.isFinite(value || NaN) || value === undefined || value <= 0) return 0;
  return clamp(value > 5 ? value : value * 20, 0, 100);
}

function arrayFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function inferCategory(text: string): BnbAgentCategory | null {
  const normalized = text.toLowerCase();
  if (/\bhealth\s*factor\b|\bliquidation\b|\bcollateral\b|\bborrow\b|\blending\b/.test(normalized)) return "Health Factor Monitoring";
  if (/\bgrid(?:\s+(?:trading|trader|strategy|bot|plan|planning))?\b|\bbuy\s+and\s+sell\s+ladders?\b|\bmarket\s+making\b/.test(normalized)) return "Grid Trading";
  if (/\bconcentrated\s+liquidity\b|\blp\s+range\b|\brebalance\b|\bfee\s+tier\b|\bv3\s+pool\b|\bliquidity\s+position\b/.test(normalized)) return "Rebalancing";
  if (/\byield\b|\bapy\b|\bapr\b|\bfarm\b|\bvault\b|\bstaking\b|\bbeefy\b|\bearn\b/.test(normalized)) return "Yield Optimisation";
  const scored = BNB_AGENT_CATEGORIES
    .filter((category) => category !== "Other")
    .map((category) => ({
      category,
      score: categoryInferenceKeywords[category].reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].category : null;
}

function marketplaceCategoryFromText(categoryText: string, text: string, options: { allowOther?: boolean } = {}): BnbAgentCategory | null {
  const explicitCategory: BnbAgentCategory | null = hasCategory(categoryText) && categoryText !== "Other" ? categoryText : null;
  const category = explicitCategory || inferCategory(text);
  if (category && category !== "Other" && isBnbMarketplaceAgentText(text)) return category;
  return options.allowOther ? "Other" : null;
}

function isBnbMarketplaceAgentText(text: string) {
  const normalized = text.toLowerCase();
  return bnbMarketplaceDomainKeywords.some((keyword) => normalized.includes(keyword));
}

function expandSearchText(value: string) {
  const normalized = value.toLowerCase();
  const words = normalized
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const aliases = words.flatMap((word) => searchAliases[word] || []);
  return Array.from(new Set([...words, ...aliases])).join(" ");
}

function serviceType(name: string): BnbAgentService["type"] {
  const normalized = name.toLowerCase();
  if (normalized.includes("erc8183") || normalized.includes("8183")) return "erc8183";
  if (normalized.includes("a2a")) return "a2a";
  if (normalized.includes("mcp")) return "mcp";
  if (normalized.includes("x402")) return "x402";
  if (normalized === "web" || normalized.includes("web-interface")) return "web";
  if (normalized.includes("http") || normalized.includes("api")) return "http";
  return "unknown";
}

function normalizeServices(value: unknown): BnbAgentService[] {
  if (!Array.isArray(value)) {
    const record = asRecord(value);
    return Object.entries(record).map(([key, item]) => {
      if (typeof item === "string") {
        return {
          name: key || item,
          type: serviceType(key || item),
          endpoint: item,
        };
      }

      const serviceRecord = asRecord(item);
      const name = textFrom(serviceRecord.name ?? serviceRecord.type ?? serviceRecord.service, key || "agent_service");
      const endpoint = textFrom(serviceRecord.endpoint ?? serviceRecord.url, "");
      return {
        name,
        type: serviceType(`${key} ${name}`),
        ...(endpoint ? { endpoint } : {}),
        ...(serviceRecord.price ? { price: String(serviceRecord.price) } : {}),
      };
    });
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return {
        name: item,
        type: serviceType(item),
      };
    }

    const record = asRecord(item);
    const name = textFrom(record.name ?? record.type ?? record.service, "agent_service");
    const endpoint = textFrom(record.endpoint ?? record.url, "");
    return {
      name,
      type: serviceType(name),
      ...(endpoint ? { endpoint } : {}),
      ...(record.price ? { price: String(record.price) } : {}),
    };
  });
}

function isPotentiallySafeEndpoint(value: string) {
  return validatePublicHttpsUrl(value).ok;
}

function endpointSource(source: BnbAgentProfile["sourceFreshness"]["source"] | "metadata") {
  if (source === "configured" || source === "8004scan") return source;
  return "metadata";
}

function endpointLabel(type: BnbExecutionEndpoint["adapter"]) {
  if (type === "mcp") return "MCP";
  if (type === "a2a") return "A2A";
  if (type === "x402") return "x402";
  if (type === "http") return "API";
  return "Web";
}

function endpointAdapter(type: BnbAgentService["type"]): BnbExecutionEndpoint["adapter"] | null {
  if (type === "mcp" || type === "a2a" || type === "x402" || type === "http") return type;
  return null;
}

function serviceEndpoint(service: BnbAgentService, source: BnbExecutionEndpoint["source"], verified = false): BnbExecutionEndpoint | null {
  if (!service.endpoint || !isPotentiallySafeEndpoint(service.endpoint)) return null;
  const adapter = endpointAdapter(service.type);
  if (!adapter) return null;
  return {
    adapter,
    url: service.endpoint,
    label: endpointLabel(adapter),
    verified,
    source,
  };
}

function dedupeServices(services: BnbAgentService[]) {
  const seen = new Set<string>();
  return services.filter((service) => {
    const key = `${service.type}:${service.name.toLowerCase()}:${service.endpoint || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeEndpoints(endpoints: BnbExecutionEndpoint[]) {
  const seen = new Map<string, BnbExecutionEndpoint>();
  for (const endpoint of endpoints) {
    const key = `${endpoint.adapter}:${endpoint.url}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, endpoint);
      continue;
    }
    seen.set(key, {
      ...previous,
      verified: previous.verified || endpoint.verified,
      method: previous.method || endpoint.method,
      inputSchema: previous.inputSchema || endpoint.inputSchema,
      paymentRequired: previous.paymentRequired || endpoint.paymentRequired || undefined,
    });
  }
  return Array.from(seen.values());
}

function endpointsFromHealthStatus(record: Record<string, unknown>): BnbExecutionEndpoint[] {
  const healthStatus = asRecord(record.health_status);
  const services = asRecord(healthStatus.services);
  return Object.entries(services).flatMap(([key, raw]) => {
    const service = asRecord(raw);
    const status = textFrom(service.status, "").toLowerCase();
    const verificationStatus = textFrom(service.verification_status, "").toLowerCase();
    const endpoint = textFrom(service.endpoint ?? service.url, "");
    const type = serviceType(`${key} ${textFrom(service.type, "")}`);
    const adapter = endpointAdapter(type);
    if (!endpoint || !isPotentiallySafeEndpoint(endpoint)) return [];
    if (!adapter) return [];
    return [{
      adapter,
      url: endpoint,
      label: endpointLabel(adapter),
      verified: status === "healthy" && (adapter === "mcp" || adapter === "a2a" || verificationStatus === "verified"),
      source: "8004scan" as const,
    }];
  });
}

function healthVerifiedServiceEndpoint(record: Record<string, unknown>, service: BnbAgentService) {
  const serviceAdapter = endpointAdapter(service.type);
  if (!serviceAdapter) return false;

  const healthStatus = asRecord(record.health_status);
  const services = asRecord(healthStatus.services);
  return Object.entries(services).some(([key, raw]) => {
    const healthService = asRecord(raw);
    const healthType = serviceType(`${key} ${textFrom(healthService.type, "")}`);
    const healthAdapter = endpointAdapter(healthType);
    if (healthAdapter !== serviceAdapter) return false;
    const status = textFrom(healthService.status, "").toLowerCase();
    const verificationStatus = textFrom(healthService.verification_status, "").toLowerCase();
    return status === "healthy" && (healthAdapter === "mcp" || healthAdapter === "a2a" || verificationStatus === "verified");
  });
}

function endpointsFromRecord(record: Record<string, unknown>, services: BnbAgentService[], source: BnbExecutionEndpoint["source"]) {
  const directServices = services
    .map((service) => serviceEndpoint(service, source, source === "configured" || healthVerifiedServiceEndpoint(record, service)))
    .filter((endpoint): endpoint is BnbExecutionEndpoint => Boolean(endpoint));
  const directEndpointServices = [
    { name: "MCP", type: "mcp" as const, endpoint: textFrom(record.mcp_server ?? record.mcpServer, "") },
    { name: "A2A", type: "a2a" as const, endpoint: textFrom(record.a2a_endpoint ?? record.a2aEndpoint, "") },
    { name: "x402", type: "x402" as const, endpoint: textFrom(record.x402_endpoint ?? record.x402Endpoint ?? record.payment_endpoint, "") },
  ];
  const directEndpoints = directEndpointServices
    .map((service) => serviceEndpoint(service, source, false))
    .filter((endpoint): endpoint is BnbExecutionEndpoint => Boolean(endpoint));
  return dedupeEndpoints([...directServices, ...directEndpoints, ...endpointsFromHealthStatus(record)]);
}

function deriveExecutionStatus(endpoints: BnbExecutionEndpoint[]): BnbExecutionStatus {
  const runnable = endpoints.filter(isCallableExecutionEndpoint);
  if (runnable.some((endpoint) => endpoint.verified)) return "ready_to_run";
  if (runnable.length > 0) return "connectable";
  return "listed_only";
}

function initial8004ExecutionStatus(endpoints: BnbExecutionEndpoint[]): BnbExecutionStatus {
  const derived = deriveExecutionStatus(endpoints);
  return derived === "ready_to_run" ? "connectable" : derived;
}

function isCallableExecutionEndpoint(endpoint: BnbExecutionEndpoint) {
  return endpoint.adapter === "mcp" || endpoint.adapter === "a2a" || endpoint.adapter === "x402" || endpoint.adapter === "http";
}

function activationFromExecution(status: BnbExecutionStatus): BnbActivationStatus {
  if (status === "ready_to_run") return "callable";
  if (status === "connectable") return "request";
  return "discoverable";
}

function get8004Headers() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.BNB_8004SCAN_PRO_API_KEY?.trim() || process.env.BNB_8004SCAN_API_KEY?.trim();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

function get8004BaseUrl() {
  return (process.env.BNB_8004SCAN_API_BASE || "https://8004scan.io/api/v1/public").replace(/\/$/, "");
}

function get8004TimeoutMs() {
  const timeout = Number(process.env.BNB_8004SCAN_TIMEOUT_MS || 8000);
  if (!Number.isFinite(timeout)) return 8000;
  return Math.min(Math.max(timeout, 500), 20000);
}

function get8004ExecutionScanPages() {
  const pages = Number.parseInt(process.env.BNB_8004SCAN_EXECUTION_SCAN_PAGES || "1", 10);
  if (!Number.isFinite(pages)) return 1;
  return Math.min(Math.max(pages, 1), 12);
}

function get8004DetailHydrationLimit() {
  const limit = Number.parseInt(process.env.BNB_8004SCAN_DETAIL_HYDRATION_LIMIT || "4", 10);
  if (!Number.isFinite(limit)) return 4;
  return Math.min(Math.max(limit, 0), 12);
}

async function fetch8004Json(url: URL | string) {
  const key = String(url);
  const cached = bnb8004MemoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  if (cached) bnb8004MemoryCache.delete(key);

  const activeRequest = bnb8004InFlight.get(key);
  if (activeRequest) return activeRequest;

  const request = (async () => {
    try {
      const { response, payload } = await safeFetchJson(key, {
        headers: get8004Headers(),
        timeoutMs: get8004TimeoutMs(),
        maxBytes: 768 * 1024,
      });
      if (!response.ok) return null;
      prune8004MemoryCache();
      bnb8004MemoryCache.set(key, {
        payload,
        expiresAt: Date.now() + get8004MemoryCacheTtlMs(key),
      });
      return payload;
    } catch {
      return null;
    } finally {
      bnb8004InFlight.delete(key);
    }
  })();
  bnb8004InFlight.set(key, request);
  return request;
}

function get8004MemoryCacheTtlMs(url: string) {
  if (url.includes("/stats")) return 5 * 60 * 1000;
  if (/\/agents\/[^/?]+\/[^/?]+/.test(url)) return 3 * 60 * 1000;
  return 60 * 1000;
}

function prune8004MemoryCache() {
  if (bnb8004MemoryCache.size < MAX_8004_MEMORY_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of bnb8004MemoryCache) {
    if (entry.expiresAt <= now || bnb8004MemoryCache.size >= MAX_8004_MEMORY_CACHE_ENTRIES) {
      bnb8004MemoryCache.delete(key);
    }
    if (bnb8004MemoryCache.size < MAX_8004_MEMORY_CACHE_ENTRIES) break;
  }
}

function rawAgentsFromPayload(payload: unknown) {
  const record = asRecord(payload);
  return Array.isArray(payload)
    ? payload
    : Array.isArray(record.agents)
      ? record.agents
      : Array.isArray(record.data)
        ? record.data
        : Array.isArray(record.items)
          ? record.items
          : Array.isArray(record.results)
            ? record.results
            : [];
}

function normalize8004Agent(raw: unknown): BnbAgentProfile | null {
  const outerRecord = asRecord(raw);
  const record = asRecord(outerRecord.agent ?? outerRecord.item ?? outerRecord.result ?? raw);
  const chainId = Number(record.chainId ?? record.chain_id ?? record.chain ?? BSC_CHAIN_ID);
  const tokenId = textFrom(record.tokenId ?? record.token_id ?? record.id, "");
  const name = textFrom(record.name ?? record.title, "");
  if (!tokenId || !name) return null;

  const description = textFrom(record.description ?? record.bio ?? record.summary, "ERC-8004 BSC agent indexed through 8004scan.");
  const capabilities = arrayFrom(record.capabilities ?? record.skills ?? record.tags);
  const supportedProtocols = arrayFrom(record.supported_protocols ?? record.supportedProtocols);
  const rawMetadata = asRecord(record.raw_metadata);
  const offchainContent = asRecord(rawMetadata.offchain_content);
  const protocolServices = normalizeServices(supportedProtocols);
  const metadataServices = normalizeServices(offchainContent.services);
  const x402Service: BnbAgentService[] = record.x402_supported === true || record.x402Support === true
    ? [{ name: "x402", type: "x402" as const }]
    : [];
  const services: BnbAgentService[] = dedupeServices([
    ...normalizeServices(record.services ?? record.endpoints),
    ...metadataServices,
    ...protocolServices,
    ...x402Service,
  ]);
  const combinedText = [
    name,
    description,
    capabilities.join(" "),
    supportedProtocols.join(" "),
    services.map((service) => `${service.name} ${service.type} ${service.endpoint || ""}`).join(" "),
  ].join(" ");
  const category = marketplaceCategoryFromText(textFrom(record.category, ""), combinedText, { allowOther: true });
  if (!category) return null;
  const fetchedAt = new Date().toISOString();
  const serviceNames = services.map((service) => `${service.name} ${service.type}`).join(" ").toLowerCase();
  const ownerAddress = textFrom(record.ownerAddress ?? record.owner ?? record.owner_address ?? record.creator_address, "Unknown");
  const registryAddress = textFrom(record.identityRegistry ?? record.registry ?? record.contract_address, DEFAULT_REGISTRY);
  const agentWallet = textFrom(record.agentWallet ?? record.agent_wallet ?? record.wallet ?? record.walletAddress ?? record.owner_address, ownerAddress);
  const feedbackCount = positiveNumberFrom(
    record.feedbackCount,
    record.feedback_count,
    record.total_feedbacks,
    record.totalFeedbacks,
    record.review_count,
    record.reviews_count,
    record.ratings_count,
  );
  const averageScore = scorePercent(firstNumberFrom(
    record.feedbackScore,
    record.average_score,
    record.averageScore,
    record.rating,
    record.rating_score,
  ));
  const estimatedPositive = feedbackCount > 0 && averageScore > 0
    ? Math.round(feedbackCount * (averageScore / 100))
    : feedbackCount;
  const updatedAt = textFrom(record.lastActivity ?? record.updatedAt ?? record.updated_at, fetchedAt);
  const executionEndpoints = endpointsFromRecord(record, services, "8004scan");
  const executionStatus = initial8004ExecutionStatus(executionEndpoints);

  return {
    chainId: Number.isFinite(chainId) ? chainId : BSC_CHAIN_ID,
    tokenId,
    name,
    description,
    category,
    ownerAddress,
    agentWallet,
    identityRegistry: registryAddress,
    metadataUri: textFrom(record.metadataUri ?? record.metadata_uri, undefined),
    services,
    capabilities: capabilities.length > 0 ? capabilities : supportedProtocols,
    x402Support: serviceNames.includes("x402"),
    erc8183Support: serviceNames.includes("erc8183") || serviceNames.includes("8183"),
    mcpSupport: serviceNames.includes("mcp"),
    a2aSupport: serviceNames.includes("a2a"),
    feedback: {
      count: feedbackCount,
      positive: positiveNumberFrom(record.positiveFeedback, record.positive_feedback, estimatedPositive),
      score: averageScore,
      summary: textFrom(record.feedbackSummary ?? record.feedback_summary, "No feedback summary yet."),
    },
    lastActivity: updatedAt,
    activationStatus: activationFromExecution(executionStatus),
    executionStatus,
    executionEndpoints,
    sourceFreshness: {
      source: "8004scan",
      fetchedAt,
      stale: false,
      note: "Live record normalized from 8004scan public API.",
    },
    sourceMetrics: {
      sourceAgentId: textFrom(record.agent_id ?? record.agentId ?? record.id, undefined),
      verified: Boolean(record.is_verified ?? record.verified),
      starCount: numberFrom(record.star_count ?? record.starCount),
      rank: numberFrom(record.rank),
      networkRank: numberFrom(record.network_rank ?? record.networkRank),
      healthScore: numberFrom(record.health_score ?? record.healthScore),
      totalScore: numberFrom(record.total_score ?? record.totalScore),
      averageScore,
      createdAt: textFrom(record.created_at ?? record.createdAt, undefined),
      updatedAt: textFrom(record.updated_at ?? record.updatedAt, undefined),
      supportedProtocols,
    },
  };
}

function normalizeConfiguredAgent(raw: unknown): BnbAgentProfile | null {
  const record = asRecord(raw);
  const tokenId = textFrom(record.tokenId ?? record.token_id ?? record.id, "");
  const name = textFrom(record.name ?? record.title, "");
  const agentWallet = textFrom(record.agentWallet ?? record.wallet ?? record.walletAddress, "");
  if (!tokenId || !name || !agentWallet) return null;

  const description = textFrom(record.description, "Configured BSC agent.");
  const capabilities = arrayFrom(record.capabilities ?? record.skills ?? record.tags);
  const services = dedupeServices(normalizeServices(record.services ?? record.endpoints));
  const categoryText = textFrom(record.category, "");
  const combinedText = [
    name,
    description,
    capabilities.join(" "),
    services.map((service) => `${service.name} ${service.type} ${service.endpoint || ""}`).join(" "),
  ].join(" ");
  const category = marketplaceCategoryFromText(categoryText, combinedText);
  if (!category) return null;
  const fetchedAt = new Date().toISOString();
  const serviceNames = services.map((service) => `${service.name} ${service.type}`).join(" ").toLowerCase();
  const feedbackRecord = asRecord(record.feedback);
  const executionEndpoints = endpointsFromRecord(record, services, endpointSource("configured"));
  const executionStatus = deriveExecutionStatus(executionEndpoints);

  return {
    chainId: Number(record.chainId ?? record.chain_id ?? BSC_CHAIN_ID) || BSC_CHAIN_ID,
    tokenId,
    name,
    description,
    category,
    ownerAddress: textFrom(record.ownerAddress ?? record.owner ?? record.owner_address, agentWallet),
    agentWallet,
    identityRegistry: textFrom(record.identityRegistry ?? record.registry, DEFAULT_REGISTRY),
    metadataUri: textFrom(record.metadataUri ?? record.metadata_uri, undefined),
    services,
    capabilities,
    x402Support: Boolean(record.x402Support) || serviceNames.includes("x402"),
    erc8183Support: Boolean(record.erc8183Support) || serviceNames.includes("erc8183") || serviceNames.includes("8183"),
    mcpSupport: Boolean(record.mcpSupport) || serviceNames.includes("mcp"),
    a2aSupport: Boolean(record.a2aSupport) || serviceNames.includes("a2a"),
    feedback: {
      count: Number(record.feedbackCount ?? feedbackRecord.count ?? 0) || 0,
      positive: Number(record.positiveFeedback ?? feedbackRecord.positive ?? 0) || 0,
      score: Number(record.feedbackScore ?? feedbackRecord.score ?? 0) || 0,
      summary: textFrom(record.feedbackSummary ?? feedbackRecord.summary, "No feedback summary yet."),
    },
    lastActivity: textFrom(record.lastActivity ?? record.updatedAt ?? record.updated_at, fetchedAt),
    activationStatus: activationFromExecution(executionStatus),
    executionStatus,
    executionEndpoints,
    sourceFreshness: {
      source: "configured",
      fetchedAt,
      stale: false,
      note: "Configured BNB agent.",
    },
  };
}

type ConfiguredBnbAgentEnvName = "BNB_REFERENCE_AGENTS_JSON" | "BNB_HIVE_AGENTS_JSON";

function getConfiguredBnbAgentsFromEnv(envName: ConfiguredBnbAgentEnvName) {
  const rawJson = process.env[envName]?.trim();
  if (!rawJson) return [];

  try {
    const payload = JSON.parse(rawJson);
    const items = Array.isArray(payload) ? payload : rawAgentsFromPayload(payload);
    return items
      .map(normalizeConfiguredAgent)
      .filter((agent): agent is BnbAgentProfile => Boolean(agent));
  } catch {
    return [];
  }
}

function getConfiguredBnbAgents() {
  return uniqueAgents([
    ...getConfiguredBnbAgentsFromEnv("BNB_REFERENCE_AGENTS_JSON"),
    ...getConfiguredBnbAgentsFromEnv("BNB_HIVE_AGENTS_JSON"),
  ]);
}

function withDerivedExecution(agent: BnbAgentProfile): BnbAgentProfile {
  if (agent.executionStatus && agent.executionEndpoints) return agent;
  const executionEndpoints = endpointsFromRecord({}, agent.services, endpointSource(agent.sourceFreshness.source));
  const executionStatus = deriveExecutionStatus(executionEndpoints);
  return {
    ...agent,
    executionStatus,
    executionEndpoints,
    activationStatus: activationFromExecution(executionStatus),
  };
}

function getBaseBnbAgents() {
  const configuredAgents = getConfiguredBnbAgents().map(withDerivedExecution);
  if (configuredAgents.length > 0) return configuredAgents;
  return [];
}

type Bnb8004SortBy = "created_at" | "stars" | "name" | "token_id" | "total_score";

function sourceSortForCatalog(sort?: string | null): Bnb8004SortBy {
  if (sort === "newest" || sort === "freshness") return "created_at";
  if (sort === "reviews" || sort === "feedback") return "total_score";
  return "total_score";
}

async function fetch8004AgentPage({
  limit,
  sortBy,
  search,
  protocol,
  page = 1,
}: {
  limit: number;
  sortBy?: Bnb8004SortBy;
  search?: string | null;
  protocol?: Bnb8004Protocol;
  page?: number;
}): Promise<Bnb8004PageResult> {
  const safePage = Math.max(Math.trunc(page), 1);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  if (process.env.BNB_8004SCAN_LIVE !== "true") {
    return { agents: [], page: safePage, limit: safeLimit, total: 0, hasMore: false };
  }

  const url = new URL(`${get8004BaseUrl()}/agents`);
  url.searchParams.set("chainId", String(BSC_CHAIN_ID));
  url.searchParams.set("isTestnet", "false");
  url.searchParams.set("page", String(safePage));
  url.searchParams.set("limit", String(safeLimit));
  if (sortBy) {
    url.searchParams.set("sortBy", sortBy);
    url.searchParams.set("sortOrder", "desc");
  }
  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }
  if (protocol) {
    url.searchParams.set("protocol", protocol);
  }

  try {
    let payload = await fetch8004Json(url);
    if (!isUsable8004AgentPage(payload) && sortBy) {
      const fallbackUrl = new URL(url);
      fallbackUrl.searchParams.delete("sortBy");
      fallbackUrl.searchParams.delete("sortOrder");
      payload = await fetch8004Json(fallbackUrl);
    }
    if (!payload) return { agents: [], page: safePage, limit: safeLimit, total: 0, hasMore: false };
    const pagination = asRecord(asRecord(payload).meta).pagination;
    const paginationRecord = asRecord(pagination);
    const agents = rawAgentsFromPayload(payload)
      .map(normalize8004Agent)
      .filter((agent): agent is BnbAgentProfile => Boolean(agent));
    const total = Number(paginationRecord.total ?? agents.length);
    const hasMore = Boolean(paginationRecord.hasMore ?? (Number.isFinite(total) ? safePage * safeLimit < total : agents.length >= safeLimit));

    return {
      agents,
      page: Number(paginationRecord.page ?? safePage) || safePage,
      limit: Number(paginationRecord.limit ?? safeLimit) || safeLimit,
      total: Number.isFinite(total) && total >= 0 ? total : agents.length,
      hasMore,
    };
  } catch {
    return { agents: [], page: safePage, limit: safeLimit, total: 0, hasMore: false };
  }
}

function isUsable8004AgentPage(payload: unknown) {
  const record = asRecord(payload);
  if (record.success === false) return false;
  const pagination = asRecord(asRecord(record.meta).pagination);
  return Array.isArray(record.data)
    && (record.data.length > 0 || Number(pagination.total ?? 0) === 0);
}

async function fetch8004NetworkStats(): Promise<BnbAgentNetworkStats | null> {
  if (process.env.BNB_8004SCAN_LIVE !== "true") return null;

  try {
    const payload = await fetch8004Json(`${get8004BaseUrl()}/stats`);
    if (!payload) return null;
    const data = asRecord(asRecord(payload).data);
    const chainStats = Array.isArray(data.chain_stats) ? data.chain_stats : [];
    const bscStats = asRecord(chainStats.find((item) => Number(asRecord(item).chain_id) === BSC_CHAIN_ID));
    const totalAgents = Number(bscStats.total_agents ?? 0);
    const totalFeedbacks = Number(bscStats.total_feedbacks ?? 0);
    const averageFeedbackScore = Number(bscStats.average_feedback_score ?? 0);

    if (!Number.isFinite(totalAgents) || totalAgents <= 0) return null;

    return {
      totalAgents,
      totalFeedbacks: Number.isFinite(totalFeedbacks) ? totalFeedbacks : 0,
      ...(Number.isFinite(averageFeedbackScore) && averageFeedbackScore > 0 ? { averageFeedbackScore } : {}),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetch8004SearchAgents(q: string, limit: number): Promise<BnbAgentProfile[]> {
  const query = q.trim();
  if (process.env.BNB_8004SCAN_LIVE !== "true" || !query) return [];

  const url = new URL(`${get8004BaseUrl()}/agents/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("chainId", String(BSC_CHAIN_ID));
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 50)));
  url.searchParams.set("semanticWeight", "0.65");

  try {
    const payload = await fetch8004Json(url);
    if (!payload) return [];

    return rawAgentsFromPayload(payload)
      .map(normalize8004Agent)
      .filter((agent): agent is BnbAgentProfile => Boolean(agent));
  } catch {
    return [];
  }
}

async function fetch8004AgentDetail(chainId: string | number, tokenId: string): Promise<BnbAgentProfile | null> {
  if (process.env.BNB_8004SCAN_LIVE !== "true") return null;

  const url = new URL(`${get8004BaseUrl()}/agents/${encodeURIComponent(String(chainId))}/${encodeURIComponent(tokenId)}`);
  const payload = await fetch8004Json(url);
  if (!payload) return null;

  const data = asRecord(payload).data ?? payload;
  return normalize8004Agent(data);
}

function mayExposeExecutionEndpoint(agent: BnbAgentProfile) {
  const protocolText = [
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
    agent.capabilities.join(" "),
    agent.x402Support ? "x402" : "",
  ].join(" ").toLowerCase();
  return /\b(mcp|a2a|x402|http|api)\b/.test(protocolText);
}

async function mapCatalogWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
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

async function hydrate8004AgentDetails(agents: BnbAgentProfile[], options: { onlyLikelyExecution?: boolean; limit?: number } = {}) {
  if (process.env.BNB_8004SCAN_LIVE !== "true") return agents;
  let remaining = options.limit === undefined ? agents.length : Math.max(Math.trunc(options.limit), 0);
  if (remaining === 0) return agents;

  const hydrated = await mapCatalogWithConcurrency(agents, 2, async (agent) => {
    if (agent.sourceFreshness.source !== "8004scan") return agent;
    if (options.onlyLikelyExecution && !mayExposeExecutionEndpoint(agent)) return agent;
    if (options.onlyLikelyExecution && agent.executionEndpoints?.some(isCallableExecutionEndpoint)) return agent;
    if (remaining <= 0) return agent;
    remaining -= 1;
    const detail = await fetch8004AgentDetail(agent.chainId, agent.tokenId).catch(() => null);
    return detail || agent;
  });
  return hydrated;
}

async function fetch8004ExecutionCandidates({
  limit,
  page,
  sortBy,
  search,
}: {
  limit: number;
  page: number;
  sortBy?: Bnb8004SortBy;
  search?: string | null;
}): Promise<Bnb8004PageResult> {
  const scanPages = get8004ExecutionScanPages();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const scanLimit = Math.min(Math.max(safeLimit, 24), 100);
  const firstPage = Math.max(((Math.max(Math.trunc(page), 1) - 1) * scanPages) + 1, 1);
  const executionProtocols: Bnb8004Protocol[] = ["MCP", "A2A"];
  const pages = await Promise.all(executionProtocols.flatMap((protocol) => (
    Array.from({ length: scanPages }, (_, index) => fetch8004AgentPage({
      limit: scanLimit,
      page: firstPage + index,
      sortBy,
      search,
      protocol,
    }))
  )));
  const candidates = uniqueAgents(pages.flatMap((result) => result.agents));
  const hydrated = await hydrate8004AgentDetails(candidates, { limit: get8004DetailHydrationLimit() });

  return {
    agents: hydrated,
    page,
    limit: safeLimit,
    total: pages.reduce((sum, result) => sum + result.total, 0) || hydrated.length,
    hasMore: pages.some((result) => result.hasMore),
  };
}

async function fetch8004ProfileCandidates({
  limit,
  page,
  sortBy,
  search,
}: {
  limit: number;
  page: number;
  sortBy?: Bnb8004SortBy;
  search?: string | null;
}): Promise<Bnb8004PageResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const safePage = Math.max(Math.trunc(page), 1);
  const sourcePage = await fetch8004AgentPage({
    limit: safeLimit,
    page: safePage,
    sortBy,
    search,
  });
  const candidates = uniqueAgents(sourcePage.agents);

  return {
    agents: candidates,
    page,
    limit: safeLimit,
    total: sourcePage.total || candidates.length,
    hasMore: sourcePage.hasMore,
  };
}

async function fetch8004AgentRange({
  offset,
  limit,
  sortBy,
}: {
  offset: number;
  limit: number;
  sortBy?: Bnb8004SortBy;
}): Promise<Bnb8004PageResult> {
  const safeOffset = Math.max(Math.trunc(offset), 0);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const sourcePageSize = 50;
  const firstPage = Math.floor(safeOffset / sourcePageSize) + 1;
  const lastIndex = safeOffset + safeLimit - 1;
  const lastPage = Math.floor(lastIndex / sourcePageSize) + 1;
  const pages = await Promise.all(
    Array.from({ length: lastPage - firstPage + 1 }, (_, index) => fetch8004AgentPage({
      limit: sourcePageSize,
      page: firstPage + index,
      sortBy,
    })),
  );
  const relativeOffset = safeOffset - ((firstPage - 1) * sourcePageSize);
  const agents = uniqueAgents(pages.flatMap((result) => result.agents))
    .slice(relativeOffset, relativeOffset + safeLimit);
  const total = pages.find((result) => result.total > 0)?.total || agents.length;

  return {
    agents,
    page: Math.floor(safeOffset / safeLimit) + 1,
    limit: safeLimit,
    total,
    hasMore: safeOffset + agents.length < total,
  };
}

async function fetchDefaultMarketplaceCandidates({
  limit,
  page,
  sortBy,
}: {
  limit: number;
  page: number;
  sortBy?: Bnb8004SortBy;
}): Promise<Bnb8004PageResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const needed = Math.min(Math.max(Math.trunc(page), 1) * safeLimit, marketplaceCategories.length * 100);
  const perCategoryLimit = Math.min(Math.max(Math.ceil(needed / marketplaceCategories.length), safeLimit), 100);
  const pages = await Promise.all(marketplaceCategories.map((category) => fetch8004ProfileCandidates({
    limit: perCategoryLimit,
    page: 1,
    sortBy,
    search: categorySearchText(category),
  })));
  const agents = uniqueAgents(pages.flatMap((result) => result.agents));

  return {
    agents,
    page,
    limit: safeLimit,
    total: pages.reduce((sum, result) => sum + result.total, 0) || agents.length,
    hasMore: pages.some((result) => result.hasMore),
  };
}

function empty8004Page(page: number, limit: number): Bnb8004PageResult {
  return {
    agents: [],
    page,
    limit,
    total: 0,
    hasMore: false,
  };
}

function isDefaultRecommendedBrowse(query: BnbAgentQuery) {
  return !query.q?.trim()
    && !query.category
    && !query.activation
    && !query.execution
    && !query.integration
    && (!query.sort || query.sort === "recommended");
}

async function listDefaultRecommendedBnbAgentsPage(query: BnbAgentQuery): Promise<BnbAgentPageResult | null> {
  const limit = Math.min(Math.max(Math.trunc(query.limit || 24), 1), 100);
  const page = Math.max(Math.trunc(query.page || 1), 1);
  const strictBscOnly = isStrictBscAgentDiscoveryEnabled();
  const cachedPromotions = strictBscOnly
    ? []
    : await readCachedBnbPromotionCandidates(DEFAULT_PROMOTED_AGENT_LIMIT);
  const cachedRuntimeCandidates = await readCachedBnbRuntimeCandidates(DEFAULT_PROMOTED_AGENT_LIMIT * 4);
  const discoveredPromotions = !strictBscOnly && cachedPromotions.length === 0
    ? await listBnbEndpointSourceAgents({ limit: 50 })
    : [];
  const promotedCandidates = await applyBnbListingModeration(uniqueAgents([
    ...getBaseBnbAgents(),
    ...cachedPromotions,
    ...cachedRuntimeCandidates,
    ...discoveredPromotions,
  ]));
  const promotedWithCapabilities = await ensureBnbRuntimeProofs(promotedCandidates, get8004DetailHydrationLimit());
  const promotedWithHealth = await applyBnbEndpointProbeHealth(promotedWithCapabilities.map((agent) => ({
    ...agent,
    scoreBreakdown: scoreBnbAgent(agent),
  })));
  const eligiblePromotions = promotedWithHealth
    .filter(isBnbAgentVisibleInDiscovery)
    .filter((agent) => agent.category !== "Other" && isBnbAgentHireable(agent));
  const promoted = sortStableRecommendationWindow(
    eligiblePromotions,
    stableRecommendationRanks(eligiblePromotions),
  ).slice(0, DEFAULT_PROMOTED_AGENT_LIMIT);

  const offset = (page - 1) * limit;
  const rankedPrefixLength = promoted.length + DEFAULT_RECOMMENDATION_WINDOW;
  let sourceTotal = 0;
  let sourceAgents: BnbAgentProfile[] = [];
  let agents: BnbAgentProfile[] = [];

  if (offset < rankedPrefixLength) {
    const topSourcePage = await fetch8004AgentRange({
      offset: 0,
      limit: DEFAULT_RECOMMENDATION_WINDOW,
    });
    if (topSourcePage.total === 0 && topSourcePage.agents.length === 0) return null;
    sourceTotal = topSourcePage.total;
    const stableRanks = stableRecommendationRanks(uniqueAgents([
      ...promoted,
      ...topSourcePage.agents,
    ]));

    const topWithCachedDetails = await overlayCachedBnbAgentDetails(topSourcePage.agents);
    const topWithCapabilities = await applyBnbEndpointCapabilitySnapshots(topWithCachedDetails);
    const initiallyRankedTop = sortStableRecommendationWindow(topWithCapabilities, stableRanks);
    const hydratedTop = await hydrate8004AgentDetails(initiallyRankedTop, {
      onlyLikelyExecution: true,
      limit: get8004DetailHydrationLimit(),
    });
    const refreshedTop = await ensureBnbRuntimeProofs(hydratedTop, get8004DetailHydrationLimit());
    sourceAgents = await applyBnbEndpointProbeHealth(refreshedTop.map((agent) => ({
      ...agent,
      scoreBreakdown: scoreBnbAgent(agent),
    })));

    const prefix = diversifyRecommendedAgents(sortStableRecommendationWindow(uniqueAgents([
      ...promoted,
      ...sourceAgents,
    ]), stableRanks), stableRanks);
    agents = prefix.slice(offset, offset + limit);

    if (agents.length < limit && topSourcePage.agents.length < sourceTotal) {
      const tail = await fetchScored8004Range(topSourcePage.agents.length, limit - agents.length);
      sourceTotal = Math.max(sourceTotal, tail.total);
      sourceAgents = uniqueAgents([...sourceAgents, ...tail.agents]);
      agents = [...agents, ...tail.agents].slice(0, limit);
    }
  } else {
    const sourceOffset = Math.max(offset - promoted.length, 0);
    const sourcePage = await fetchScored8004Range(sourceOffset, limit);
    if (sourcePage.total === 0 && sourcePage.agents.length === 0) return null;
    sourceTotal = sourcePage.total;
    sourceAgents = sourcePage.agents;
    agents = sourceAgents;
  }

  await upsertBnbAgentCache(uniqueAgents([...promoted, ...sourceAgents])).catch(() => undefined);
  const total = promoted.length + sourceTotal;

  return {
    agents,
    page,
    pageSize: limit,
    total,
    hasMore: offset + agents.length < total,
    source: Array.from(new Set(agents.map((agent) => agent.sourceFreshness.source))).join("+") || "8004scan",
  };
}

async function fetchScored8004Range(offset: number, limit: number) {
  const sourcePage = await fetch8004AgentRange({ offset, limit });
  const visibleAgents = await applyBnbListingModeration(sourcePage.agents);
  const cachedAgents = await overlayCachedBnbAgentDetails(visibleAgents);
  const capabilityAgents = await applyBnbEndpointCapabilitySnapshots(cachedAgents);
  const agents = await applyBnbEndpointProbeHealth(capabilityAgents.map((agent) => ({
    ...agent,
    scoreBreakdown: scoreBnbAgent(agent),
  })));
  return { ...sourcePage, agents };
}

function stableRecommendationRanks(agents: BnbAgentProfile[]) {
  return new Map(agents.map((agent) => [stableAgentKey(agent), stableRecommendationRank(agent)]));
}

function stableRecommendationRank(agent: BnbAgentProfile): StableRecommendationRank {
  const text = `${agent.name} ${agent.description}`.toLowerCase();
  return {
    relevance: marketplaceRelevanceRank(agent),
    fit: countKeywordHits(text, categoryKeywords[agent.category]),
    promotion: agent.sourceFreshness.source !== "8004scan" && endpointRank(agent) > 0 ? 1 : 0,
    reputation: scoreReputation(agent),
    sourceQuality: scorePercent(agent.sourceMetrics?.totalScore),
    freshness: scoreFreshness(agent),
    family: recommendationFamilyKey(agent),
    key: stableAgentKey(agent),
  };
}

function sortStableRecommendationWindow(
  agents: BnbAgentProfile[],
  ranks: Map<string, StableRecommendationRank>,
) {
  return [...agents].sort((a, b) => {
    const aRank = ranks.get(stableAgentKey(a)) || stableRecommendationRank(a);
    const bRank = ranks.get(stableAgentKey(b)) || stableRecommendationRank(b);
    return bRank.relevance - aRank.relevance
      || bRank.fit - aRank.fit
      || bRank.promotion - aRank.promotion
      || bRank.reputation - aRank.reputation
      || bRank.sourceQuality - aRank.sourceQuality
      || bRank.freshness - aRank.freshness
      || aRank.key.localeCompare(bRank.key);
  });
}

function diversifyRecommendedAgents(
  agents: BnbAgentProfile[],
  ranks: Map<string, StableRecommendationRank>,
) {
  const tiers = new Map<number, BnbAgentProfile[]>();
  for (const agent of agents) {
    const relevance = ranks.get(stableAgentKey(agent))?.relevance
      ?? stableRecommendationRank(agent).relevance;
    const tier = tiers.get(relevance) || [];
    tier.push(agent);
    tiers.set(relevance, tier);
  }

  return Array.from(tiers.keys())
    .sort((a, b) => b - a)
    .flatMap((relevance) => diversifyRecommendationTier(tiers.get(relevance) || [], ranks));
}

function diversifyRecommendationTier(
  agents: BnbAgentProfile[],
  ranks: Map<string, StableRecommendationRank>,
) {
  const selected: BnbAgentProfile[] = [];
  const deferred: BnbAgentProfile[] = [];
  const families = new Set<string>();
  for (const agent of agents) {
    const family = ranks.get(stableAgentKey(agent))?.family || recommendationFamilyKey(agent);
    if (families.has(family)) {
      deferred.push(agent);
      continue;
    }
    families.add(family);
    selected.push(agent);
  }
  return [...selected, ...deferred];
}

function recommendationFamilyKey(agent: BnbAgentProfile) {
  const endpoint = agent.executionEndpoints?.find((item) => item.adapter !== "web");
  if (endpoint) {
    try {
      return `${endpoint.adapter}:${new URL(endpoint.url).hostname.toLowerCase()}`;
    } catch {
      // URL safety is validated before this stage; fall through to identity.
    }
  }
  return `${agent.chainId}:${agent.ownerAddress.toLowerCase()}`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function agentSearchText(agent: BnbAgentProfile) {
  return [
    agent.name,
    agent.description,
    agent.ownerAddress,
    agent.agentWallet,
    agent.category,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type} ${service.endpoint || ""}`).join(" "),
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
  ].join(" ").toLowerCase();
}

function categorySearchText(category?: string | null) {
  if (!category || !hasCategory(category)) return "";
  return categorySearchSeeds[category] || category;
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function countQueryHits(text: string, intent: string) {
  if (!intent.trim()) return 0;
  const expanded = expandSearchText(intent);
  const terms = Array.from(new Set(tokenize(`${intent} ${expanded}`)));
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function scoreFit(agent: BnbAgentProfile, intent: string, category?: string | null) {
  const text = agentSearchText(agent);
  const queryHits = countQueryHits(text, intent);
  const domainHits = countKeywordHits(text, bnbMarketKeywords);
  const agentCategoryHits = countKeywordHits(text, categoryKeywords[agent.category]);
  const requestedCategoryHits = hasCategory(category)
    ? countKeywordHits(text, categoryKeywords[category])
    : 0;

  if (intent.trim()) {
    const nameHit = agent.name.toLowerCase().includes(intent.trim().toLowerCase()) ? 8 : 0;
    const categoryHit = hasCategory(category) && agent.category === category ? 10 : 0;
    return Math.round(clamp(nameHit + queryHits * 4 + categoryHit + requestedCategoryHits * 3, 0, 40));
  }

  if (hasCategory(category)) {
    const exactCategory = agent.category === category ? 16 : 0;
    return Math.round(clamp(exactCategory + requestedCategoryHits * 4 + domainHits * 1.5, 0, 40));
  }

  return Math.round(clamp(agentCategoryHits * 4 + domainHits * 2, 0, 40));
}

function scoreReputation(agent: BnbAgentProfile) {
  const reviewCount = agent.feedback.count;
  const average = scorePercent(agent.feedback.score);
  const starCount = agent.sourceMetrics?.starCount || 0;
  const sourceScore = scorePercent(agent.sourceMetrics?.totalScore);
  const countScore = reviewCount > 0 ? clamp((Math.log10(reviewCount + 1) / Math.log10(50)) * 9, 1, 9) : 0;
  const averageScore = average > 0 ? (average / 100) * 8 : 0;
  const starScore = starCount > 0 ? clamp((Math.log10(starCount + 1) / Math.log10(30)) * 5, 1, 5) : 0;
  const sourceScorePart = sourceScore > 0 ? (sourceScore / 100) * 3 : 0;

  return Math.round(clamp(countScore + averageScore + starScore + sourceScorePart, 0, 25));
}

function scoreReadiness(agent: BnbAgentProfile) {
  const protocolCount = [agent.a2aSupport, agent.erc8183Support, agent.mcpSupport, agent.x402Support].filter(Boolean).length;
  const hasEndpoint = Boolean(agent.executionEndpoints?.some(isCallableExecutionEndpoint));
  const validWallet = /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
  const statusScore = agent.executionStatus === "ready_to_run"
    ? 8
    : agent.executionStatus === "connectable"
      ? 5
      : agent.activationStatus === "callable"
        ? 6
        : 0;

  return Math.round(clamp(statusScore + protocolCount * 2 + (hasEndpoint ? 2 : 0) + (validWallet ? 1 : 0), 0, 15));
}

function scoreFreshness(agent: BnbAgentProfile) {
  const lastActivityMs = Date.parse(agent.lastActivity);
  if (!Number.isFinite(lastActivityMs)) return 0;
  const days = Math.floor((Date.now() - lastActivityMs) / (24 * 60 * 60 * 1000));
  if (days <= 1) return 10;
  if (days <= 7) return 8;
  if (days <= 30) return 6;
  if (days <= 90) return 4;
  return 2;
}

function scoreCompleteness(agent: BnbAgentProfile) {
  const description = agent.description.trim();
  const hasUsefulDescription = description && !/^erc-8004 bsc agent indexed through 8004scan\.?$/i.test(description);
  const owner = /^0x[a-fA-F0-9]{40}$/.test(agent.ownerAddress);
  const wallet = /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
  const protocol = Boolean(agent.sourceMetrics?.supportedProtocols?.length || agent.services.length);
  const sourceScore = scorePercent(agent.sourceMetrics?.healthScore || agent.sourceMetrics?.totalScore);

  return Math.round(clamp(
    (hasUsefulDescription ? 3 : 0) +
    (owner ? 2 : 0) +
    (wallet ? 2 : 0) +
    (protocol ? 2 : 0) +
    (agent.sourceFreshness.source === "8004scan" ? 1 : 0) +
    (sourceScore > 0 ? 1 : 0),
    0,
    10,
  ));
}

export function scoreBnbAgent(agent: BnbAgentProfile, intent = "", category?: string | null): BnbScoreBreakdown {
  const fit = scoreFit(agent, intent.toLowerCase(), category);
  const trust = scoreReputation(agent);
  const activation = scoreReadiness(agent);
  const activity = scoreFreshness(agent);
  const risk = scoreCompleteness(agent);
  const total = Math.min(100, fit + trust + activation + activity + risk);
  const explanations = [
    fit >= 25 ? `Strong match for ${agent.category}.` : "",
    agent.feedback.count > 0 ? `${agent.feedback.count} review${agent.feedback.count === 1 ? "" : "s"} on the source marketplace.` : "",
    agent.sourceMetrics?.starCount ? `${agent.sourceMetrics.starCount} saved by source users.` : "",
    activity >= 8 ? "Recently active." : "",
    activation >= 8 ? "Protocol support detected." : "",
  ].filter(Boolean);

  return { total, fit, trust, activation, activity, risk, explanations };
}

function matchesQuery(agent: BnbAgentProfile, query: BnbAgentQuery) {
  if (!isBnbAgentVisibleInDiscovery(agent)) return false;
  if (query.category && hasCategory(query.category) && agent.category !== query.category) return false;
  if (query.activation && agent.activationStatus !== query.activation) return false;
  if (query.execution === "hireable" && !isBnbAgentHireable(agent)) return false;
  if (query.execution && query.execution !== "hireable" && agent.executionStatus !== query.execution) return false;
  if (!supportsBnbIntegration(agent, query.integration)) return false;
  if (!query.q) return true;

  const needle = query.q.toLowerCase();
  const expandedNeedle = expandSearchText(needle);
  const haystack = agentSearchText(agent);

  if (haystack.includes(needle)) return true;
  const directTerms = Array.from(new Set(tokenize(needle)));
  const directHits = directTerms.filter((word) => haystack.includes(word)).length;
  if (directTerms.length > 1) {
    return directHits >= Math.min(directTerms.length, 2);
  }
  if (directHits > 0) return true;

  return expandedNeedle
    .split(" ")
    .filter((word) => word.length >= 2 && !directTerms.includes(word))
    .some((word) => haystack.includes(word));
}

function supportsBnbIntegration(agent: BnbAgentProfile, integration?: string | null) {
  const normalized = normalizeIntegration(integration);
  if (!normalized) return true;
  const haystack = agentSearchText(agent);

  if (normalized === "pancakeswap") {
    return haystack.includes("pancake") || haystack.includes("cake") || haystack.includes("pcs");
  }
  if (normalized === "altana") {
    return haystack.includes("altana") || (agent.a2aSupport && (haystack.includes("wallet") || haystack.includes("health") || haystack.includes("permission")));
  }
  if (normalized === "8004scan") return agent.sourceFreshness.source === "8004scan";
  return true;
}

function normalizeIntegration(value?: string | null) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "pancakeswap" || text === "pancake" || text === "pcs") return "pancakeswap";
  if (text === "altana") return "altana";
  if (text === "8004scan") return "8004scan";
  return "";
}

function sortAgents(agents: BnbAgentProfile[], sort?: string | null, context: Pick<BnbAgentQuery, "q" | "category"> = {}) {
  const sorted = [...agents];
  const prioritizeMarketplaceFit = !context.q?.trim() && !context.category;
  const byMarketplaceFit = (a: BnbAgentProfile, b: BnbAgentProfile) => (
    prioritizeMarketplaceFit ? marketplaceRelevanceRank(b) - marketplaceRelevanceRank(a) : 0
  );
  const byHiveUse = (a: BnbAgentProfile, b: BnbAgentProfile) => (
    byMarketplaceFit(a, b) ||
    hiveUsableRank(b) - hiveUsableRank(a) ||
    executionRank(b) - executionRank(a) ||
    endpointRank(b) - endpointRank(a)
  );
  const bySourceQuality = (a: BnbAgentProfile, b: BnbAgentProfile) => (
    (b.sourceMetrics?.totalScore || 0) - (a.sourceMetrics?.totalScore || 0) ||
    (b.sourceMetrics?.starCount || 0) - (a.sourceMetrics?.starCount || 0) ||
    (b.sourceMetrics?.healthScore || 0) - (a.sourceMetrics?.healthScore || 0)
  );
  const byRecommendation = (a: BnbAgentProfile, b: BnbAgentProfile) => (
    byHiveUse(a, b) ||
    (b.scoreBreakdown?.total || 0) - (a.scoreBreakdown?.total || 0) ||
    b.feedback.count - a.feedback.count ||
    b.feedback.score - a.feedback.score ||
    bySourceQuality(a, b) ||
    Date.parse(b.lastActivity) - Date.parse(a.lastActivity) ||
    stableAgentKey(a).localeCompare(stableAgentKey(b))
  );

  if (sort === "freshness") {
    return sorted.sort((a, b) => byHiveUse(a, b) || Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
  }
  if (sort === "feedback") {
    return sorted.sort((a, b) => byHiveUse(a, b) || b.feedback.score - a.feedback.score || b.feedback.count - a.feedback.count || byRecommendation(a, b));
  }
  if (sort === "reviews") {
    return sorted.sort((a, b) => byHiveUse(a, b) || b.feedback.count - a.feedback.count || b.feedback.score - a.feedback.score || bySourceQuality(a, b));
  }
  if (sort === "newest") {
    return sorted.sort((a, b) => {
      const aCreated = Date.parse(a.sourceMetrics?.createdAt || a.sourceFreshness.fetchedAt);
      const bCreated = Date.parse(b.sourceMetrics?.createdAt || b.sourceFreshness.fetchedAt);
      return byHiveUse(a, b) || bCreated - aCreated || byRecommendation(a, b);
    });
  }
  if (sort === "activation") {
    const rank: Record<BnbActivationStatus, number> = { callable: 3, request: 2, discoverable: 1 };
    return sorted.sort((a, b) => rank[b.activationStatus] - rank[a.activationStatus] || byRecommendation(a, b));
  }
  return sorted.sort(byRecommendation);
}

function executionRank(agent: BnbAgentProfile) {
  if (agent.executionStatus === "ready_to_run") return 4;
  if (agent.executionStatus === "connectable") return 3;
  if (agent.executionStatus === "listed_only") return 1;
  return 0;
}

function hiveUsableRank(agent: BnbAgentProfile) {
  if (agent.executionStatus === "ready_to_run" && agent.hasActionableEndpointCapabilities === true) return 6;
  if (agent.executionStatus === "ready_to_run") return 5;
  if (agent.executionStatus === "connectable" && agent.hasActionableEndpointCapabilities !== false && endpointRank(agent) > 0) return 4;
  if (agent.category !== "Other" && mayExposeExecutionEndpoint(agent)) return 3;
  if (agent.category !== "Other") return 2;
  if (mayExposeExecutionEndpoint(agent)) return 1;
  return 0;
}

function stableAgentKey(agent: BnbAgentProfile) {
  return `${String(agent.chainId).padStart(12, "0")}:${agent.tokenId}:${agent.name.toLowerCase()}`;
}

function marketplaceRelevanceRank(agent: BnbAgentProfile) {
  if (agent.category !== "Other") return 3;
  return isBnbMarketplaceAgentText(agentSearchText(agent)) ? 1 : 0;
}

function endpointRank(agent: BnbAgentProfile) {
  return agent.executionEndpoints?.some((endpoint) => endpoint.adapter === "mcp" || endpoint.adapter === "a2a" || endpoint.adapter === "http" || endpoint.adapter === "x402")
    ? 1
    : 0;
}

function uniqueAgents(agents: BnbAgentProfile[]) {
  const seen = new Set<string>();
  return agents.filter((agent) => {
    const key = `${agent.chainId}:${agent.tokenId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ensureBnbRuntimeProofs(agents: BnbAgentProfile[], limit: number) {
  const withSnapshots = await applyBnbEndpointCapabilitySnapshots(agents);
  const safeLimit = Math.max(Math.trunc(limit), 0);
  if (safeLimit === 0) return withSnapshots;
  const seenEndpoints = new Set<string>();
  const representatives: BnbAgentProfile[] = [];

  for (const agent of withSnapshots) {
    if (isBnbAgentHireable(agent)) continue;
    const endpointKeys = (agent.executionEndpoints || [])
      .filter(isCallableExecutionEndpoint)
      .map((endpoint) => `${endpoint.adapter}:${endpoint.url}`);
    if (endpointKeys.length === 0 || endpointKeys.every((key) => seenEndpoints.has(key))) continue;
    endpointKeys.forEach((key) => seenEndpoints.add(key));
    representatives.push(agent);
    if (representatives.length >= safeLimit) break;
  }

  if (representatives.length === 0) return withSnapshots;
  const probed = await resolveBnbAgentsRuntime(representatives);
  const probedByAgent = new Map(probed.map((agent) => [`${agent.chainId}:${agent.tokenId}`, agent]));
  const merged = withSnapshots.map((agent) => probedByAgent.get(`${agent.chainId}:${agent.tokenId}`) || agent);
  return applyBnbEndpointCapabilitySnapshots(merged);
}

export async function listBnbAgents(query: BnbAgentQuery = {}) {
  const result = await listBnbAgentsPage(query);
  return result.agents;
}

export async function listBnbAgentsPage(query: BnbAgentQuery = {}): Promise<BnbAgentPageResult> {
  if (isDefaultRecommendedBrowse(query)) {
    const recommended = await listDefaultRecommendedBnbAgentsPage(query);
    if (recommended) return recommended;
    const cachedFallback = await readCachedBnbAgentsPage(query);
    if (cachedFallback) return cachedFallback;
  }

  const cacheCanAnswerQuery = Boolean(query.execution || query.activation) && query.execution !== "hireable";
  const cached = cacheCanAnswerQuery ? await readCachedBnbAgentsPage(query) : null;
  if (cached) return cached;

  const limit = Math.min(Math.max(Math.trunc(query.limit || 24), 1), 100);
  const page = Math.max(Math.trunc(query.page || 1), 1);
  const sort = query.sort || "recommended";
  const sourceSearch = [query.q?.trim() || categorySearchText(query.category), integrationSearchText(query.integration)]
    .filter(Boolean)
    .join(" ");
  const defaultMarketplaceBrowse = !query.q?.trim() && !query.category && !query.integration;
  const defaultRankedWindow = defaultMarketplaceBrowse && sort === "recommended" && page * limit <= 100;
  const sourceWindowLimit = defaultRankedWindow ? Math.min(Math.max(page * limit, limit), 100) : limit;
  const sourcePage = defaultRankedWindow ? 1 : page;
  const runtimeFiltered = query.execution === "hireable" || query.execution === "ready_to_run" || query.execution === "connectable" || query.execution === "unavailable";
  const executionDiscovery = query.execution !== "listed_only" && runtimeFiltered;
  const profileDiscovery = !runtimeFiltered || query.execution === "listed_only" || query.execution === "hireable";
  const [executionPage, profilePage, marketplacePage, semanticAgents, endpointAgents, cachedRuntimeAgents] = await Promise.all([
    executionDiscovery
      ? fetch8004ExecutionCandidates({
        limit: sourceWindowLimit,
        page: sourcePage,
        sortBy: sourceSortForCatalog(sort),
        search: sourceSearch,
      })
      : Promise.resolve(empty8004Page(page, limit)),
    profileDiscovery
      ? fetch8004ProfileCandidates({
        limit: sourceWindowLimit,
        page: sourcePage,
        sortBy: sourceSortForCatalog(sort),
        search: sourceSearch,
      })
      : Promise.resolve(empty8004Page(page, limit)),
    defaultRankedWindow && profileDiscovery
      ? fetchDefaultMarketplaceCandidates({
        limit,
        page,
        sortBy: sourceSortForCatalog(sort),
      })
      : Promise.resolve(empty8004Page(page, limit)),
    page === 1 && sourceSearch ? fetch8004SearchAgents(sourceSearch, Math.min(limit, 25)) : Promise.resolve([]),
    !isStrictBscAgentDiscoveryEnabled() && page === 1 && (sourceSearch || runtimeFiltered)
      ? listBnbEndpointSourceAgents({ q: query.q, category: query.category, limit: Math.min(limit, 32) })
      : Promise.resolve([]),
    executionDiscovery
      ? readCachedBnbRuntimeCandidates(Math.min(Math.max(limit * 2, 24), 100))
      : Promise.resolve([]),
  ]);
  const baseAgents = !isStrictBscAgentDiscoveryEnabled() && page === 1 ? getBaseBnbAgents() : [];
  const liveCandidates = uniqueAgents([...semanticAgents, ...marketplacePage.agents, ...executionPage.agents, ...profilePage.agents])
    .slice(0, executionDiscovery ? Math.min(limit * get8004ExecutionScanPages() * 2, 200) : defaultRankedWindow ? Math.min(page * limit + limit, 500) : Math.min(limit * 2, 100));
  const shouldHydrateLiveDetails = runtimeFiltered;
  const liveAgents = shouldHydrateLiveDetails
    ? await hydrate8004AgentDetails(liveCandidates, { limit: get8004DetailHydrationLimit() })
    : liveCandidates;
  const candidates = await applyBnbListingModeration(uniqueAgents([...baseAgents, ...endpointAgents, ...cachedRuntimeAgents, ...liveAgents]));
  const runtimeCandidates = executionDiscovery
    ? await ensureBnbRuntimeProofs(candidates, Math.max(get8004DetailHydrationLimit(), 6))
    : candidates;
  const capabilityCandidates = await applyBnbEndpointCapabilitySnapshots(runtimeCandidates);
  const scoredAgents = capabilityCandidates
    .filter((agent) => matchesQuery(agent, query))
    .map((agent) => ({
      ...agent,
      scoreBreakdown: scoreBnbAgent(agent, query.q || "", query.category),
    }));
  const agents = await applyBnbEndpointProbeHealth(scoredAgents);

  const sortedPool = sortAgents(agents, sort, query);
  const sorted = defaultRankedWindow
    ? sortedPool.slice((page - 1) * limit, page * limit)
    : sortedPool.slice(0, limit);
  await upsertBnbAgentCache(agents, { runtimeProbed: executionDiscovery }).catch(() => undefined);

  const sourceHasMore = executionPage.hasMore || profilePage.hasMore || marketplacePage.hasMore;
  const sourceTotal = profilePage.total > 0
    ? profilePage.total
    : executionPage.total > 0
      ? executionPage.total
      : marketplacePage.total > 0
        ? marketplacePage.total
        : sorted.length;
  const verifiedRuntimeTotal = runtimeFiltered ? sorted.length : 0;
  const total = runtimeFiltered
    ? verifiedRuntimeTotal
    : sourceTotal > 0
      ? sourceTotal
      : sorted.length;
  const hasMore = runtimeFiltered
    ? false
    : sourceHasMore || (sourceTotal > 0 && page * limit < sourceTotal);

  return {
    agents: sorted,
    page,
    pageSize: limit,
    total,
    hasMore,
    source: sorted.length > 0
      ? Array.from(new Set(sorted.map((agent) => agent.sourceFreshness.source))).join("+")
      : process.env.BNB_8004SCAN_LIVE === "true" ? "8004scan+endpoint-indexes" : "endpoint-indexes",
  };
}

export function getBnbRegisteredAgentLabel() {
  return "200k+ registered on BSC";
}

export function formatBnbAgentCount(total: number) {
  if (!Number.isFinite(total) || total < 0) return "200k+";
  if (total === 0) return "0";
  if (total >= 1_000_000) return `${Math.floor(total / 1_000_000)}m+`;
  if (total >= 1_000) return `${Math.floor(total / 1_000)}k+`;
  return String(total);
}

export async function getBnbAgentNetworkStats() {
  const stats = await fetch8004NetworkStats();
  return stats || {
    totalAgents: BNB_REGISTERED_AGENT_FLOOR,
    totalFeedbacks: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getBnbAgent(chainId: string | number, tokenId: string) {
  const decodedTokenId = decodeTokenId(tokenId);
  if (await isBnbListingModerated(chainId, decodedTokenId)) return null;

  const configured = getBaseBnbAgents()
    .find((agent) => String(agent.chainId) === String(chainId) && agent.tokenId === decodedTokenId);
  if (configured) return withRuntimeScore(configured);

  const endpointAgent = await getBnbEndpointSourceAgent(decodedTokenId);
  if (endpointAgent && String(endpointAgent.chainId) === String(chainId)) {
    const scored = await withRuntimeScore(endpointAgent);
    await upsertBnbAgentCache([scored], { hydrated: true, runtimeProbed: true }).catch(() => undefined);
    return scored;
  }

  const cached = await getCachedBnbAgent(chainId, decodedTokenId);
  if (cached?.executionEndpoints?.length) return withRuntimeScore(cached);

  const liveAgent = await fetch8004AgentDetail(chainId, decodedTokenId);
  if (liveAgent) {
    const scored = await withRuntimeScore(liveAgent);
    await upsertBnbAgentCache([scored], { hydrated: true, runtimeProbed: true }).catch(() => undefined);
    return scored;
  }

  if (cached) return withRuntimeScore(cached);

  const agents = await listBnbAgents({ limit: 100 });
  return agents.find((agent) => String(agent.chainId) === String(chainId) && agent.tokenId === decodedTokenId) || null;
}

async function withRuntimeScore(agent: BnbAgentProfile) {
  const runtimeAgent = await resolveBnbAgentRuntime(agent);
  const [capabilityAgent] = await applyBnbEndpointCapabilitySnapshots([runtimeAgent], { includeContracts: true });
  const scoredAgent = capabilityAgent || runtimeAgent;
  return {
    ...scoredAgent,
    scoreBreakdown: scoreBnbAgent(scoredAgent),
  };
}

function decodeTokenId(tokenId: string) {
  try {
    return decodeURIComponent(tokenId);
  } catch {
    return tokenId;
  }
}

export async function refreshBnbAgentDiscoveryCache({
  pages = 2,
  pageSize = 50,
}: {
  pages?: number;
  pageSize?: number;
} = {}) {
  const safePages = Math.min(Math.max(Math.trunc(pages), 1), 10);
  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 100);
  const startedAt = new Date();
  let fetched = 0;
  let stored = 0;
  const errors: string[] = [];

  for (let page = 1; page <= safePages; page += 1) {
    try {
      const profilePage = await fetch8004ProfileCandidates({
        limit: safePageSize,
        page,
        sortBy: sourceSortForCatalog("recommended"),
      });
      fetched += profilePage.agents.length;
      const result = await upsertBnbAgentCache(profilePage.agents, { fetchedAt: startedAt, queueHydration: true });
      stored += result.stored;
    } catch (error) {
      errors.push(`8004 page ${page}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  for (const category of marketplaceCategories) {
    try {
      const categoryPage = await fetch8004ProfileCandidates({
        limit: Math.min(safePageSize, 50),
        page: 1,
        sortBy: sourceSortForCatalog("recommended"),
        search: categorySearchText(category),
      });
      fetched += categoryPage.agents.length;
      const result = await upsertBnbAgentCache(categoryPage.agents, { fetchedAt: startedAt, queueHydration: true });
      stored += result.stored;
    } catch (error) {
      errors.push(`8004 ${category}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  try {
    const endpointAgents = await listBnbEndpointSourceAgents({ limit: Math.min(safePageSize, 50) });
    fetched += endpointAgents.length;
    const result = await upsertBnbAgentCache(endpointAgents, { fetchedAt: startedAt, queueHydration: true });
    stored += result.stored;
  } catch (error) {
    errors.push(`endpoint indexes: ${error instanceof Error ? error.message : "failed"}`);
  }

  await recordBnbAgentCacheRun("refresh", {
    fetched,
    stored,
    pages: safePages,
    pageSize: safePageSize,
    errors,
    startedAt,
    finishedAt: new Date(),
  }).catch(() => undefined);

  return { fetched, stored, pages: safePages, pageSize: safePageSize, errors };
}

export async function hydrateBnbAgentCacheQueue(limit?: number) {
  const startedAt = new Date();
  const claimed = await claimBnbAgentHydrationBatch(limit);
  let hydrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const agent of claimed) {
    try {
      const detail = agent.sourceFreshness.source === "8004scan"
        ? await fetch8004AgentDetail(agent.chainId, agent.tokenId)
        : await getBnbEndpointSourceAgent(agent.tokenId) || agent;
      if (!detail) {
        failed += 1;
        await completeBnbAgentHydration(agent, undefined, "8004 detail was not available");
        continue;
      }

      const runtimeAgent = await withRuntimeScore(detail);
      await completeBnbAgentHydration(agent, runtimeAgent);
      hydrated += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Hydration failed";
      errors.push(`${agent.chainId}:${agent.tokenId}: ${message}`);
      await completeBnbAgentHydration(agent, undefined, message).catch(() => undefined);
    }
  }

  await recordBnbAgentCacheRun("hydrate", {
    claimed: claimed.length,
    hydrated,
    failed,
    errors,
    startedAt,
    finishedAt: new Date(),
  }).catch(() => undefined);

  return { claimed: claimed.length, hydrated, failed, errors };
}

export async function matchBnbAgents(intent: string, category?: string | null, limit = 5) {
  const strictBscOnly = isStrictBscAgentDiscoveryEnabled();
  const [fallbackAgents, semanticAgents, endpointAgents] = await Promise.all([
    listBnbAgents({ category, limit: 100 }),
    fetch8004SearchAgents(intent, 25),
    strictBscOnly
      ? Promise.resolve([])
      : listBnbEndpointSourceAgents({ q: intent, category, limit: 25 }),
  ]);

  const visibleAgents = await applyBnbListingModeration(uniqueAgents([...endpointAgents, ...semanticAgents, ...fallbackAgents]));
  const scored = visibleAgents
    .filter(isBnbAgentVisibleInDiscovery)
    .filter((agent) => (!category || !hasCategory(category) ? true : agent.category === category))
    .map((agent) => ({ ...agent, scoreBreakdown: scoreBnbAgent(agent, intent, category) }));
  const agents = await applyBnbEndpointProbeHealth(scored);

  return agents
    .sort((a, b) => (b.scoreBreakdown?.total || 0) - (a.scoreBreakdown?.total || 0))
    .slice(0, Math.min(Math.max(limit, 1), 10));
}

export async function searchBnbAgents(query: BnbAgentQuery = {}) {
  return listBnbAgents(query);
}

function integrationSearchText(value?: string | null) {
  const integration = normalizeIntegration(value);
  if (integration === "pancakeswap") return "pancakeswap pancake cake lp farm swap liquidity";
  if (integration === "altana") return "altana wallet health permission session risk";
  if (integration === "8004scan") return "8004scan";
  return "";
}

export function getBnbCategories() {
  return BNB_AGENT_CATEGORIES;
}

export function getBnbPartnerTracks() {
  return bnbPartnerTracks;
}

export function getBnbPancakeSwapUtilities() {
  return bnbPancakeSwapUtilities;
}

export function getBnbTermixCaptures() {
  return bnbTermixCaptures;
}

export function getBnbAltanaSessionTemplates() {
  return bnbAltanaSessionTemplates;
}
