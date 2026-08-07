import {
  BNB_AGENT_CATEGORIES,
  type BnbActivationStatus,
  type BnbAltanaSessionTemplate,
  type BnbAgentCategory,
  type BnbAgentProfile,
  type BnbAgentQuery,
  type BnbAgentService,
  type BnbPancakeSwapUtility,
  type BnbPartnerTrackSummary,
  type BnbScoreBreakdown,
  type BnbTermixCapture,
} from "@/lib/bnb/types";

const BSC_CHAIN_ID = 56;
const DEFAULT_REGISTRY = "0x8004scan-bsc-registry";
const DEFAULT_FETCHED_AT = "2026-08-06T00:00:00.000Z";

const categoryKeywords: Record<BnbAgentCategory, string[]> = {
  Rebalancing: ["rebalance", "range", "lp", "liquidity", "position", "portfolio"],
  "Grid Trading": ["grid", "strategy", "range", "trading", "volatility", "bot"],
  "Yield Optimisation": ["yield", "apr", "farm", "vault", "staking", "route"],
  "Health Factor Monitoring": ["health", "liquidation", "borrow", "loan", "venus", "risk"],
};

const localBnbAgents: BnbAgentProfile[] = [
  {
    chainId: BSC_CHAIN_ID,
    tokenId: "hive-yield-scout",
    name: "Yield Scout",
    description: "Scans PancakeSwap farms and BSC yield routes, then ranks opportunities by net APR, liquidity depth, and risk notes.",
    category: "Yield Optimisation",
    ownerAddress: "0x7A3d00000000000000000000000000000000BEE1",
    agentWallet: "0x7A3d00000000000000000000000000000000BEE2",
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: "https://bnb.uphive.xyz/agents/yield-scout.json",
    services: [
      { name: "rank_yield_routes", type: "mcp", endpoint: "https://bnb.uphive.xyz/api/bnb/mcp", price: "0.005 BNB" },
      { name: "yield_report", type: "erc8183", price: "0.01 BNB" },
    ],
    capabilities: ["pancakeswap", "farm-apr", "yield-routing", "risk-adjusted-yield"],
    x402Support: true,
    erc8183Support: true,
    mcpSupport: true,
    a2aSupport: false,
    feedback: { count: 18, positive: 17, score: 94, summary: "Strong yield reports with clear risk notes." },
    lastActivity: "2026-08-05T18:10:00.000Z",
    activationStatus: "callable",
    sourceFreshness: {
      source: "local",
      fetchedAt: DEFAULT_FETCHED_AT,
      stale: false,
      note: "Local BNB agent for yield route evaluation.",
    },
  },
  {
    chainId: BSC_CHAIN_ID,
    tokenId: "hive-range-guard",
    name: "Range Guard",
    description: "Reviews concentrated liquidity positions and recommends when to reset range, add liquidity, or hold.",
    category: "Rebalancing",
    ownerAddress: "0x7A3d00000000000000000000000000000000BEE3",
    agentWallet: "0x7A3d00000000000000000000000000000000BEE4",
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: "https://bnb.uphive.xyz/agents/range-guard.json",
    services: [
      { name: "lp_rebalance_review", type: "a2a", endpoint: "https://bnb.uphive.xyz/api/bnb/activate", price: "0.01 BNB" },
    ],
    capabilities: ["pancakeswap-v3", "lp-range", "rebalance", "impermanent-loss"],
    x402Support: false,
    erc8183Support: false,
    mcpSupport: false,
    a2aSupport: true,
    feedback: { count: 14, positive: 13, score: 91, summary: "Useful LP range recommendations and clear hold/rebalance calls." },
    lastActivity: "2026-08-05T15:30:00.000Z",
    activationStatus: "callable",
    sourceFreshness: {
      source: "local",
      fetchedAt: DEFAULT_FETCHED_AT,
      stale: false,
      note: "Local BNB agent for LP range review.",
    },
  },
  {
    chainId: BSC_CHAIN_ID,
    tokenId: "hive-grid-pilot",
    name: "Grid Pilot",
    description: "Builds conservative BNB grid strategies with explicit range, capital allocation, and stop conditions.",
    category: "Grid Trading",
    ownerAddress: "0x7A3d00000000000000000000000000000000BEE5",
    agentWallet: "0x7A3d00000000000000000000000000000000BEE6",
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: "https://bnb.uphive.xyz/agents/grid-pilot.json",
    services: [
      { name: "grid_strategy_plan", type: "mcp", endpoint: "https://bnb.uphive.xyz/api/bnb/mcp", price: "0.01 BNB" },
    ],
    capabilities: ["grid-trading", "bnb-usdt", "risk-limits", "strategy-design"],
    x402Support: false,
    erc8183Support: false,
    mcpSupport: true,
    a2aSupport: false,
    feedback: { count: 9, positive: 8, score: 87, summary: "Good conservative grid setup, still needs live execution history." },
    lastActivity: "2026-08-04T21:20:00.000Z",
    activationStatus: "request",
    sourceFreshness: {
      source: "local",
      fetchedAt: DEFAULT_FETCHED_AT,
      stale: false,
      note: "Local BNB agent for grid trading coverage.",
    },
  },
  {
    chainId: BSC_CHAIN_ID,
    tokenId: "hive-health-sentinel",
    name: "Health Sentinel",
    description: "Monitors lending health factor, liquidation distance, and collateral drift for BSC borrowing positions.",
    category: "Health Factor Monitoring",
    ownerAddress: "0x7A3d00000000000000000000000000000000BEE7",
    agentWallet: "0x7A3d00000000000000000000000000000000BEE8",
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: "https://bnb.uphive.xyz/agents/health-sentinel.json",
    services: [
      { name: "health_factor_watch", type: "a2a", endpoint: "https://bnb.uphive.xyz/api/bnb/activate", price: "0.01 BNB" },
    ],
    capabilities: ["venus", "liquidation-alert", "health-factor", "wallet-monitoring"],
    x402Support: false,
    erc8183Support: false,
    mcpSupport: false,
    a2aSupport: true,
    feedback: { count: 16, positive: 15, score: 93, summary: "Fast alerting and conservative liquidation buffers." },
    lastActivity: "2026-08-05T19:45:00.000Z",
    activationStatus: "callable",
    sourceFreshness: {
      source: "local",
      fetchedAt: DEFAULT_FETCHED_AT,
      stale: false,
      note: "Local BNB agent for health factor monitoring.",
    },
  },
  {
    chainId: BSC_CHAIN_ID,
    tokenId: "hive-audit-lens",
    name: "Audit Lens",
    description: "Checks token and pool risk signals before a trader interacts with a BSC asset.",
    category: "Health Factor Monitoring",
    ownerAddress: "0x7A3d00000000000000000000000000000000BEE9",
    agentWallet: "0x7A3d00000000000000000000000000000000BE10",
    identityRegistry: DEFAULT_REGISTRY,
    metadataUri: "https://bnb.uphive.xyz/agents/audit-lens.json",
    services: [
      { name: "token_risk_report", type: "http", endpoint: "https://bnb.uphive.xyz/api/bnb/activate", price: "0.01 BNB" },
    ],
    capabilities: ["token-risk", "permissions", "liquidity-check", "security-report"],
    x402Support: false,
    erc8183Support: false,
    mcpSupport: false,
    a2aSupport: false,
    feedback: { count: 11, positive: 10, score: 89, summary: "Clear token risk summaries for trading and security tasks." },
    lastActivity: "2026-08-05T13:05:00.000Z",
    activationStatus: "request",
    sourceFreshness: {
      source: "local",
      fetchedAt: DEFAULT_FETCHED_AT,
      stale: false,
      note: "Local support agent for TermiX security comparisons.",
    },
  },
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
    agentName: "Yield Scout",
    agentTokenId: "hive-yield-scout",
    userInput: "Stablecoin amount, minimum liquidity, risk tolerance, lockup preference.",
    agentOutput: "Ranked PancakeSwap farms and pools with net APR, liquidity depth, volatility notes, and risk flags.",
    decisionMetric: "Best route must include a risk-adjusted APR and a reason to reject at least one tempting pool.",
    activationHref: "/bnb/activate?chainId=56&tokenId=hive-yield-scout",
    scoring: [
      { label: "Target time", value: "Under 60 sec" },
      { label: "Target cost", value: "0.005 BNB" },
      { label: "Saved result", value: "Route ranking" },
    ],
  },
  {
    id: "review-lp-range",
    title: "Review LP range",
    agentName: "Range Guard",
    agentTokenId: "hive-range-guard",
    userInput: "Pool address, current range, position size, preferred rebalance threshold.",
    agentOutput: "Hold, widen, narrow, or reset recommendation with impermanent-loss and fee capture notes.",
    decisionMetric: "Recommendation must state the current price distance from range edge and the action threshold.",
    activationHref: "/bnb/activate?chainId=56&tokenId=hive-range-guard",
    scoring: [
      { label: "Target time", value: "Under 2 min" },
      { label: "Target cost", value: "0.01 BNB" },
      { label: "Saved result", value: "LP decision" },
    ],
  },
  {
    id: "watch-farm-route",
    title: "Watch a farm route",
    agentName: "Yield Scout",
    agentTokenId: "hive-yield-scout",
    userInput: "Wallet or position label, farm route, minimum APR delta, alert destination.",
    agentOutput: "Route watch plan with alert trigger, expected review cadence, and safe-stop condition.",
    decisionMetric: "Watch plan must include a trigger that avoids noisy alerts and stale APR reactions.",
    activationHref: "/bnb/activate?chainId=56&tokenId=hive-yield-scout",
    scoring: [
      { label: "Target time", value: "Under 90 sec" },
      { label: "Target cost", value: "0.01 BNB/week" },
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
    title: "Agent response quality capture",
    target: "Any TermiX task prompt",
  },
];

export const bnbAltanaSessionTemplates: BnbAltanaSessionTemplate[] = [
  {
    id: "health-factor-watch",
    title: "Limited health-factor watch",
    agentTokenId: "hive-health-sentinel",
    summary: "Watch a lending position and alert when the health factor gets too low.",
    spendCap: "0.01 BNB",
    expiry: "7 days",
  },
  {
    id: "yield-scan-only",
    title: "Yield scan only",
    agentTokenId: "hive-yield-scout",
    summary: "Watch selected farms and alert when a route needs review.",
    spendCap: "0.005 BNB",
    expiry: "24 hours",
  },
  {
    id: "lp-rebalance-request",
    title: "LP rebalance request",
    agentTokenId: "hive-range-guard",
    summary: "Watch an LP position and alert when the range needs review.",
    spendCap: "0.01 BNB",
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

function arrayFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function inferCategory(text: string): BnbAgentCategory {
  const normalized = text.toLowerCase();
  for (const category of BNB_AGENT_CATEGORIES) {
    if (categoryKeywords[category].some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }
  return "Yield Optimisation";
}

function serviceType(name: string): BnbAgentService["type"] {
  const normalized = name.toLowerCase();
  if (normalized.includes("erc8183") || normalized.includes("8183")) return "erc8183";
  if (normalized.includes("a2a")) return "a2a";
  if (normalized.includes("mcp")) return "mcp";
  if (normalized.includes("x402")) return "x402";
  if (normalized.includes("http") || normalized.includes("api")) return "http";
  return "unknown";
}

function normalizeServices(value: unknown): BnbAgentService[] {
  if (!Array.isArray(value)) return [];

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

function get8004Headers() {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.BNB_8004SCAN_API_KEY) {
    headers.Authorization = `Bearer ${process.env.BNB_8004SCAN_API_KEY}`;
  }
  return headers;
}

function get8004BaseUrl() {
  return (process.env.BNB_8004SCAN_API_BASE || "https://8004scan.io/api/v1/public").replace(/\/$/, "");
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
  const protocolServices = normalizeServices(record.supported_protocols);
  const x402Service = record.x402_supported === true || record.x402Support === true
    ? [{ name: "x402", type: "x402" as const }]
    : [];
  const services = [
    ...normalizeServices(record.services ?? record.endpoints),
    ...protocolServices,
    ...x402Service,
  ];
  const combinedText = [name, description, capabilities.join(" ")].join(" ");
  const category = hasCategory(textFrom(record.category, "")) ? textFrom(record.category) as BnbAgentCategory : inferCategory(combinedText);
  const fetchedAt = new Date().toISOString();
  const serviceNames = services.map((service) => `${service.name} ${service.type}`).join(" ").toLowerCase();
  const ownerAddress = textFrom(record.ownerAddress ?? record.owner ?? record.owner_address, "Unknown");
  const registryAddress = textFrom(record.identityRegistry ?? record.registry ?? record.contract_address, DEFAULT_REGISTRY);
  const agentWallet = textFrom(record.agentWallet ?? record.wallet ?? record.walletAddress ?? record.owner_address, ownerAddress);
  const feedbackCount = Number(record.feedbackCount ?? record.feedback_count ?? record.total_feedbacks ?? 0) || 0;
  const averageScore = Number(record.feedbackScore ?? record.score ?? record.average_score ?? record.total_score ?? 0) || 0;

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
    capabilities: capabilities.length > 0 ? capabilities : arrayFrom(record.supported_protocols),
    x402Support: serviceNames.includes("x402"),
    erc8183Support: serviceNames.includes("erc8183") || serviceNames.includes("8183"),
    mcpSupport: serviceNames.includes("mcp"),
    a2aSupport: serviceNames.includes("a2a"),
    feedback: {
      count: feedbackCount,
      positive: Number(record.positiveFeedback ?? record.positive_feedback ?? feedbackCount) || 0,
      score: averageScore,
      summary: textFrom(record.feedbackSummary ?? record.feedback_summary, "No feedback summary yet."),
    },
    lastActivity: textFrom(record.lastActivity ?? record.updatedAt ?? record.updated_at, fetchedAt),
    activationStatus: services.length > 0 ? "callable" : "discoverable",
    sourceFreshness: {
      source: "8004scan",
      fetchedAt,
      stale: false,
      note: "Live record normalized from 8004scan public API.",
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
  const services = normalizeServices(record.services ?? record.endpoints);
  const categoryText = textFrom(record.category, "");
  const category = hasCategory(categoryText) ? categoryText : inferCategory([name, description, capabilities.join(" ")].join(" "));
  const fetchedAt = new Date().toISOString();
  const serviceNames = services.map((service) => `${service.name} ${service.type}`).join(" ").toLowerCase();
  const feedbackRecord = asRecord(record.feedback);

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
    activationStatus: services.length > 0 ? "callable" : "request",
    sourceFreshness: {
      source: "configured",
      fetchedAt,
      stale: false,
      note: "Configured BNB agent.",
    },
  };
}

function getConfiguredBnbAgents() {
  const rawJson = process.env.BNB_HIVE_AGENTS_JSON?.trim();
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

function getBaseBnbAgents() {
  const configuredAgents = getConfiguredBnbAgents();
  if (configuredAgents.length > 0) return configuredAgents;
  if (process.env.BNB_SHOW_LOCAL_AGENTS === "true") return localBnbAgents;
  return [];
}

async function fetch8004Agents(limit: number): Promise<BnbAgentProfile[]> {
  if (process.env.BNB_8004SCAN_LIVE !== "true") return [];

  const url = new URL(`${get8004BaseUrl()}/agents`);
  url.searchParams.set("chainId", String(BSC_CHAIN_ID));
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));

  try {
    const response = await fetch(url, { headers: get8004Headers(), next: { revalidate: 300 } });
    if (!response.ok) return [];
    const payload = await response.json();

    return rawAgentsFromPayload(payload)
      .map(normalize8004Agent)
      .filter((agent): agent is BnbAgentProfile => Boolean(agent));
  } catch {
    return [];
  }
}

async function fetch8004SearchAgents(q: string, limit: number): Promise<BnbAgentProfile[]> {
  const query = q.trim();
  if (process.env.BNB_8004SCAN_LIVE !== "true" || !query) return [];

  const url = new URL(`${get8004BaseUrl()}/agents/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("chainId", String(BSC_CHAIN_ID));
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 50)));

  try {
    const response = await fetch(url, { headers: get8004Headers(), next: { revalidate: 180 } });
    if (!response.ok) return [];
    const payload = await response.json();

    return rawAgentsFromPayload(payload)
      .map(normalize8004Agent)
      .filter((agent): agent is BnbAgentProfile => Boolean(agent));
  } catch {
    return [];
  }
}

function scoreFit(agent: BnbAgentProfile, intent: string, category?: string | null) {
  const intentWords = new Set(
    intent
      .split(/[^a-z0-9]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  );
  const categoryScore = category && agent.category === category ? 26 : 8;
  const categoryMatches = categoryKeywords[agent.category].filter((keyword) => intent.includes(keyword)).length;
  const capabilityMatches = agent.capabilities.filter((capability) => {
    const normalized = capability.toLowerCase();
    if (intent.includes(normalized) || intent.includes(normalized.replace(/-/g, " "))) return true;
    return normalized
      .split(/[^a-z0-9]+/)
      .some((word) => word.length >= 3 && intentWords.has(word));
  }).length;

  return Math.min(35, categoryScore + categoryMatches * 5 + Math.min(capabilityMatches * 4, 12));
}

export function scoreBnbAgent(agent: BnbAgentProfile, intent = "", category?: string | null): BnbScoreBreakdown {
  const normalizedIntent = intent.toLowerCase();
  const fit = scoreFit(agent, normalizedIntent, category);
  const feedbackRatio = agent.feedback.count > 0 ? agent.feedback.positive / agent.feedback.count : 0;
  const trust = Math.min(25, Math.round(feedbackRatio * 15) + Math.round((agent.feedback.score / 100) * 10));
  const activation = agent.activationStatus === "callable" ? 20 : agent.activationStatus === "request" ? 12 : 4;
  const lastActivityMs = Date.parse(agent.lastActivity);
  const recent = Number.isFinite(lastActivityMs) && Date.now() - lastActivityMs < 7 * 24 * 60 * 60 * 1000;
  const activity = recent ? 10 : 5;
  const risk = agent.activationStatus === "callable" && (agent.a2aSupport || agent.erc8183Support || agent.mcpSupport) ? 10 : 6;
  const total = Math.min(100, fit + trust + activation + activity + risk);

  const explanations = [
    `${agent.category} fit: ${fit}/35`,
    agent.activationStatus === "callable"
      ? "Ready to hire."
      : agent.activationStatus === "request"
        ? "Ask the agent before hiring."
        : "Listed, but no service endpoint is available yet.",
    agent.feedback.count > 0
      ? `${agent.feedback.positive}/${agent.feedback.count} positive feedback signals.`
      : "No feedback yet.",
    recent ? "Recent activity detected." : "Activity freshness needs verification.",
  ];

  return { total, fit, trust, activation, activity, risk, explanations };
}

function matchesQuery(agent: BnbAgentProfile, query: BnbAgentQuery) {
  if (query.category && hasCategory(query.category) && agent.category !== query.category) return false;
  if (query.activation && agent.activationStatus !== query.activation) return false;
  if (!query.q) return true;

  const needle = query.q.toLowerCase();
  const haystack = [
    agent.name,
    agent.description,
    agent.ownerAddress,
    agent.agentWallet,
    agent.category,
    agent.capabilities.join(" "),
    agent.services.map((service) => service.name).join(" "),
  ].join(" ").toLowerCase();

  return haystack.includes(needle);
}

function sortAgents(agents: BnbAgentProfile[], sort?: string | null) {
  const sorted = [...agents];
  if (sort === "freshness") {
    return sorted.sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
  }
  if (sort === "feedback") {
    return sorted.sort((a, b) => b.feedback.score - a.feedback.score || b.feedback.count - a.feedback.count);
  }
  if (sort === "activation") {
    const rank: Record<BnbActivationStatus, number> = { callable: 3, request: 2, discoverable: 1 };
    return sorted.sort((a, b) => rank[b.activationStatus] - rank[a.activationStatus]);
  }
  return sorted.sort((a, b) => (b.scoreBreakdown?.total || 0) - (a.scoreBreakdown?.total || 0));
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
  const limit = Math.min(Math.max(query.limit || 24, 1), 100);
  const [liveAgents, semanticAgents] = await Promise.all([
    fetch8004Agents(limit),
    query.q ? fetch8004SearchAgents(query.q, limit) : Promise.resolve([]),
  ]);
  const agents = uniqueAgents([...getBaseBnbAgents(), ...semanticAgents, ...liveAgents])
    .filter((agent) => matchesQuery(agent, query))
    .map((agent) => ({
      ...agent,
      scoreBreakdown: scoreBnbAgent(agent, query.q || "", query.category),
    }));

  return sortAgents(agents, query.sort).slice(0, limit);
}

export async function getBnbAgent(chainId: string | number, tokenId: string) {
  const agents = await listBnbAgents({ limit: 100 });
  return agents.find((agent) => String(agent.chainId) === String(chainId) && agent.tokenId === tokenId) || null;
}

export async function matchBnbAgents(intent: string, category?: string | null, limit = 5) {
  const [fallbackAgents, semanticAgents] = await Promise.all([
    listBnbAgents({ category, limit: 100 }),
    fetch8004SearchAgents(intent, 25),
  ]);

  return uniqueAgents([...semanticAgents, ...fallbackAgents])
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
