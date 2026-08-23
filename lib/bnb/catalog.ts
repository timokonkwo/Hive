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
import { getBnbEndpointSourceAgent, listBnbEndpointSourceAgents } from "@/lib/bnb/endpoint-sources";

const BSC_CHAIN_ID = 56;
export const BNB_REGISTERED_AGENT_FLOOR = 200_000;
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
  const category = hasCategory(categoryText) ? categoryText : inferCategory(text);
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
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch {
    return false;
  }
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

function get8004CacheTtlSeconds(fallback: number) {
  const ttl = Number.parseInt(process.env.BNB_8004SCAN_CACHE_TTL_SECONDS || String(fallback), 10);
  if (!Number.isFinite(ttl)) return fallback;
  return Math.min(Math.max(ttl, 30), 3600);
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

async function fetch8004Json(url: URL | string, revalidate: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), get8004TimeoutMs());

  try {
    const response = await fetch(url, {
      headers: get8004Headers(),
      next: { revalidate: get8004CacheTtlSeconds(revalidate) },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json() as Promise<unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
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
  const executionStatus = deriveExecutionStatus(executionEndpoints);

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
    const payload = await fetch8004Json(url, 300);
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

async function fetch8004NetworkStats(): Promise<BnbAgentNetworkStats | null> {
  if (process.env.BNB_8004SCAN_LIVE !== "true") return null;

  try {
    const payload = await fetch8004Json(`${get8004BaseUrl()}/stats`, 300);
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
    const payload = await fetch8004Json(url, 180);
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
  const payload = await fetch8004Json(url, 180);
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

function empty8004Page(page: number, limit: number): Bnb8004PageResult {
  return {
    agents: [],
    page,
    limit,
    total: 0,
    hasMore: false,
  };
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
  return `${category} ${categoryKeywords[category].join(" ")}`;
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
  if (query.category && hasCategory(query.category) && agent.category !== query.category) return false;
  if (query.activation && agent.activationStatus !== query.activation) return false;
  if (query.execution && agent.executionStatus !== query.execution) return false;
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

function sortAgents(agents: BnbAgentProfile[], sort?: string | null) {
  const sorted = [...agents];
  const byHiveUse = (a: BnbAgentProfile, b: BnbAgentProfile) => (
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
    Date.parse(b.lastActivity) - Date.parse(a.lastActivity)
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
  if (agent.executionStatus === "ready_to_run") return 5;
  if (agent.executionStatus === "connectable") return 4;
  if (agent.category !== "Other" && mayExposeExecutionEndpoint(agent)) return 3;
  if (agent.category !== "Other") return 2;
  if (mayExposeExecutionEndpoint(agent)) return 1;
  return 0;
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

export async function listBnbAgents(query: BnbAgentQuery = {}) {
  const result = await listBnbAgentsPage(query);
  return result.agents;
}

export async function listBnbAgentsPage(query: BnbAgentQuery = {}): Promise<BnbAgentPageResult> {
  const limit = Math.min(Math.max(Math.trunc(query.limit || 24), 1), 100);
  const page = Math.max(Math.trunc(query.page || 1), 1);
  const sort = query.sort || "recommended";
  const sourceSearch = query.q?.trim() || categorySearchText(query.category);
  const runtimeFiltered = query.execution === "ready_to_run" || query.execution === "connectable" || query.execution === "unavailable";
  const executionDiscovery = query.execution !== "listed_only" && runtimeFiltered;
  const profileDiscovery = !runtimeFiltered || query.execution === "listed_only";
  const [executionPage, profilePage, semanticAgents, endpointAgents] = await Promise.all([
    executionDiscovery
      ? fetch8004ExecutionCandidates({
        limit,
        page,
        sortBy: sourceSortForCatalog(sort),
        search: sourceSearch,
      })
      : Promise.resolve(empty8004Page(page, limit)),
    profileDiscovery
      ? fetch8004ProfileCandidates({
        limit,
        page,
        sortBy: sourceSortForCatalog(sort),
        search: sourceSearch,
      })
      : Promise.resolve(empty8004Page(page, limit)),
    page === 1 && sourceSearch ? fetch8004SearchAgents(sourceSearch, Math.min(limit, 25)) : Promise.resolve([]),
    page === 1 ? listBnbEndpointSourceAgents({ q: query.q, category: query.category, limit: Math.min(limit, 32) }) : Promise.resolve([]),
  ]);
  const baseAgents = page === 1 ? getBaseBnbAgents() : [];
  const liveCandidates = uniqueAgents([...semanticAgents, ...executionPage.agents, ...profilePage.agents])
    .slice(0, executionDiscovery ? Math.min(limit * get8004ExecutionScanPages() * 2, 200) : limit);
  const shouldHydrateLiveDetails = runtimeFiltered;
  const liveAgents = shouldHydrateLiveDetails
    ? await hydrate8004AgentDetails(liveCandidates, { limit: get8004DetailHydrationLimit() })
    : liveCandidates;
  const candidates = uniqueAgents([...baseAgents, ...endpointAgents, ...liveAgents]);
  const runtimeCandidates = executionDiscovery ? await resolveBnbAgentsRuntime(candidates) : candidates;
  const agents = runtimeCandidates
    .filter((agent) => matchesQuery(agent, query))
    .map((agent) => ({
      ...agent,
      scoreBreakdown: scoreBnbAgent(agent, query.q || "", query.category),
    }));

  const sorted = sortAgents(agents, sort).slice(0, limit);
  const sourceHasMore = executionPage.hasMore || profilePage.hasMore;
  const sourceTotal = profilePage.total > 0
    ? profilePage.total
    : executionPage.total > 0
      ? executionPage.total
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
  const configured = getBaseBnbAgents()
    .find((agent) => String(agent.chainId) === String(chainId) && agent.tokenId === decodedTokenId);
  if (configured) return withRuntimeScore(configured);

  const endpointAgent = await getBnbEndpointSourceAgent(decodedTokenId);
  if (endpointAgent && String(endpointAgent.chainId) === String(chainId)) return withRuntimeScore(endpointAgent);

  const liveAgent = await fetch8004AgentDetail(chainId, decodedTokenId);
  if (liveAgent) return withRuntimeScore(liveAgent);

  const agents = await listBnbAgents({ limit: 100 });
  return agents.find((agent) => String(agent.chainId) === String(chainId) && agent.tokenId === decodedTokenId) || null;
}

async function withRuntimeScore(agent: BnbAgentProfile) {
  const runtimeAgent = await resolveBnbAgentRuntime(agent);
  return {
    ...runtimeAgent,
    scoreBreakdown: scoreBnbAgent(runtimeAgent),
  };
}

function decodeTokenId(tokenId: string) {
  try {
    return decodeURIComponent(tokenId);
  } catch {
    return tokenId;
  }
}

export async function matchBnbAgents(intent: string, category?: string | null, limit = 5) {
  const [fallbackAgents, semanticAgents, endpointAgents] = await Promise.all([
    listBnbAgents({ category, limit: 100 }),
    fetch8004SearchAgents(intent, 25),
    listBnbEndpointSourceAgents({ q: intent, category, limit: 25 }),
  ]);

  return uniqueAgents([...endpointAgents, ...semanticAgents, ...fallbackAgents])
    .filter((agent) => (!category || !hasCategory(category) ? true : agent.category === category))
    .map((agent) => ({ ...agent, scoreBreakdown: scoreBnbAgent(agent, intent, category) }))
    .sort((a, b) => (b.scoreBreakdown?.total || 0) - (a.scoreBreakdown?.total || 0))
    .slice(0, Math.min(Math.max(limit, 1), 10));
}

export async function searchBnbAgents(query: BnbAgentQuery = {}) {
  return listBnbAgents(query);
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
