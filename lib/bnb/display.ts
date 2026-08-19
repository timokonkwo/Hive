import type { BnbAgentCategory, BnbAgentProfile, BnbAgentService } from "@/lib/bnb/types";

export const bnbCategoryLabels: Record<BnbAgentCategory, string> = {
  Rebalancing: "Rebalancing",
  "Grid Trading": "Grid Trading",
  "Yield Optimisation": "Yield Optimisation",
  "Health Factor Monitoring": "Health Factor",
};

const GENERATED_DESCRIPTION_PATTERNS = [
  /^erc-8004 bsc agent indexed through 8004scan\.?$/i,
  /^configured bsc agent\.?$/i,
  /^an evoevo ai agent/i,
  /^think like/i,
  /^[\w.-]+\.agent on termix platform\.?$/i,
  /mechanism analyst/i,
  /sports prediction/i,
  /geopolitics/i,
  /general news/i,
  /entertainment/i,
];

const GENERIC_CAPABILITIES = new Set(["web", "api", "http", "https", "unknown", "general"]);
const GENERIC_SERVICE_LABELS = new Set(["api", "discord", "http", "https", "mcp", "telegram", "twitter", "unknown", "web", "website", "x"]);
const UNLISTED_SERVICE_PRICES = new Set(["", "not listed", "not set", "price not set", "price on request"]);

export function bnbAgentKey(agent: Pick<BnbAgentProfile, "chainId" | "tokenId">) {
  return `${agent.chainId}:${agent.tokenId}`;
}

export function bnbAgentDisplayName(agent: Pick<BnbAgentProfile, "name" | "tokenId">) {
  const name = agent.name?.trim();
  if (!name || /^agent #/i.test(name)) return `Agent #${agent.tokenId}`;
  if (/^[a-z0-9_-]+\.agent$/i.test(name)) return `Agent #${agent.tokenId}`;
  return name;
}

export function bnbAgentSourceName(agent: Pick<BnbAgentProfile, "name" | "tokenId">) {
  const name = agent.name?.trim();
  if (!name) return "";
  return bnbAgentDisplayName(agent) === name ? "" : name;
}

export function bnbCategoryLabel(category: BnbAgentCategory) {
  return bnbCategoryLabels[category];
}

export function bnbStatusLabel(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus">) {
  if (agent.executionStatus === "ready_to_run") return "Ready to run";
  if (agent.executionStatus === "connectable") return "Connectable";
  if (agent.executionStatus === "listed_only") return "Listed";
  if (agent.executionStatus === "unavailable") return "Unavailable";
  if (agent.activationStatus === "callable") return "Ready to run";
  return "Listed";
}

export function bnbCanHireAgent(agent: Pick<BnbAgentProfile, "activationStatus" | "executionStatus" | "agentWallet">) {
  return (agent.executionStatus === "ready_to_run" || (!agent.executionStatus && agent.activationStatus === "callable"))
    && /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
}

export function bnbIsVerified(agent: BnbAgentProfile) {
  return Boolean(agent.sourceMetrics?.verified || agent.sourceFreshness.source === "8004scan");
}

export function bnbListingDescription(agent: Pick<BnbAgentProfile, "description">) {
  const description = agent.description.trim();
  if (!description) return "";
  if (GENERATED_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) return "";
  return description;
}

export function bnbSpecificCapabilities(agent: Pick<BnbAgentProfile, "capabilities">) {
  return agent.capabilities
    .map(formatCapability)
    .filter((capability) => capability && !GENERIC_CAPABILITIES.has(capability.toLowerCase()));
}

export function bnbPriceLabel(agent: Pick<BnbAgentProfile, "services">) {
  return agent.services.find((service) => service.price)?.price || "";
}

export function bnbHasPrice(agent: Pick<BnbAgentProfile, "services">) {
  return Boolean(bnbPriceLabel(agent));
}

export function bnbReviewLabel(agent: Pick<BnbAgentProfile, "feedback">) {
  if (agent.feedback.count <= 0) return "";
  const rating = agent.feedback.score > 0 ? `${Math.min(5, agent.feedback.score / 20).toFixed(1)} · ` : "";
  return `${rating}${agent.feedback.count} review${agent.feedback.count === 1 ? "" : "s"}`;
}

export function bnbFreshnessLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Active today";
  if (days === 1) return "Active 1 day ago";
  return `Active ${days} days ago`;
}

export function bnbRegisteredLabel(agent: Pick<BnbAgentProfile, "sourceMetrics">) {
  const value = agent.sourceMetrics?.createdAt;
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(time));
}

export function bnbProtocolSummary(agent: Pick<BnbAgentProfile, "sourceMetrics" | "a2aSupport" | "mcpSupport" | "erc8183Support">) {
  const protocols = [
    ...(agent.sourceMetrics?.supportedProtocols || []),
    ...(agent.a2aSupport ? ["A2A"] : []),
    ...(agent.mcpSupport ? ["MCP"] : []),
    ...(agent.erc8183Support ? ["ERC-8183"] : []),
  ];

  return Array.from(new Set(protocols.map(formatProtocol).filter(Boolean)));
}

export function bnbAgentIntegrations(agent: Pick<BnbAgentProfile, "category" | "capabilities" | "services" | "a2aSupport">) {
  const haystack = [
    agent.category,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
  ].join(" ").toLowerCase();
  const integrations: string[] = [];

  if (haystack.includes("pancake")) integrations.push("PancakeSwap");
  if (haystack.includes("venus")) integrations.push("Venus");
  if (haystack.includes("altana") || (agent.a2aSupport && (haystack.includes("wallet") || haystack.includes("health")))) {
    integrations.push("Altana");
  }

  return Array.from(new Set(integrations));
}

export function bnbUsableServices(agent: Pick<BnbAgentProfile, "services">) {
  return agent.services.filter(isUserFacingBnbService);
}

export function bnbAgentHasListedPayment(agent: Pick<BnbAgentProfile, "services" | "x402Support">) {
  if (agent.x402Support) return true;
  return agent.services.some((service) => {
    const price = normalizeServiceToken(service.price || "");
    return Boolean(price && !UNLISTED_SERVICE_PRICES.has(price));
  });
}

export function bnbServiceLabel(service: BnbAgentService) {
  return formatCapability(service.name);
}

function isUserFacingBnbService(service: BnbAgentService) {
  const label = normalizeServiceToken(service.name);
  const price = normalizeServiceToken(service.price || "");
  if (!label || GENERIC_SERVICE_LABELS.has(label)) return false;
  return Boolean(service.price && !UNLISTED_SERVICE_PRICES.has(price));
}

function normalizeServiceToken(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function formatCapability(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProtocol(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "a2a") return "A2A";
  if (lower === "mcp") return "MCP";
  if (lower === "x402") return "x402";
  if (lower.includes("8183")) return "ERC-8183";
  return normalized;
}
