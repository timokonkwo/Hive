"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { GitCompareArrows } from "lucide-react";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";

type StoredAgent = {
  key: string;
  name: string;
  category: string;
  status: string;
  bestFor?: string;
  description?: string;
  price?: string;
  reviews?: string;
  averageScore?: string;
  lastActive?: string;
  registered?: string;
  supportedProtocols?: string[];
  x402?: string;
  serviceEndpoint?: string;
  walletStatus?: string;
  identity?: string;
  verified?: boolean;
  profileHref: string;
  hireHref: string;
  canHire: boolean;
};

const savedKey = "hive:bnb:saved-agents";
const compareKey = "hive:bnb:compare-agents";

export function ProfileCompareAction({ agent }: { agent: BnbAgentProfile }) {
  const key = agentKey(agent);
  const snapshot = useSyncExternalStore(
    subscribeToCompareStore,
    () => getCompareSnapshot(key),
    () => JSON.stringify({ compared: false, count: 0 }),
  );
  const { compared, count } = JSON.parse(snapshot) as { compared: boolean; count: number };

  function toggleCompare() {
    const saved = toStoredAgent(agent);
    const comparedAgents = readComparedAgents();
    const exists = comparedAgents.includes(saved.key);
    const next = exists
      ? comparedAgents.filter((item) => item !== saved.key)
      : comparedAgents.length >= 3
        ? comparedAgents
        : [...comparedAgents, saved.key];

    const savedAgents = readSavedAgents();
    savedAgents[saved.key] = saved;
    window.localStorage.setItem(savedKey, JSON.stringify(savedAgents));
    window.localStorage.setItem(compareKey, JSON.stringify(next));
    window.dispatchEvent(new Event("hive:bnb:compare-changed"));
  }

  return (
    <div className="bnb-profile-compare">
      <button
        type="button"
        className="bnb-button-dark bnb-focus"
        onClick={toggleCompare}
        disabled={!compared && count >= 3}
      >
        <GitCompareArrows aria-hidden="true" size={15} />
        {compared ? "Remove from compare" : count >= 3 ? "Compare limit reached" : "Add to compare"}
      </button>
      {count >= 2 ? (
        <Link href="/bnb/agents" className="bnb-text-action bnb-focus">
          Compare agents
        </Link>
      ) : null}
    </div>
  );
}

function subscribeToCompareStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("hive:bnb:compare-changed", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("hive:bnb:compare-changed", onStoreChange);
  };
}

function getCompareSnapshot(key: string) {
  const comparedAgents = readComparedAgents();
  return JSON.stringify({
    compared: comparedAgents.includes(key),
    count: comparedAgents.length,
  });
}

function agentKey(agent: BnbAgentProfile) {
  return `${agent.chainId}:${agent.tokenId}`;
}

function readSavedAgents() {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(savedKey) || "{}") as Record<string, StoredAgent>;
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function readComparedAgents() {
  if (typeof window === "undefined") return [];
  try {
    const comparing = JSON.parse(window.localStorage.getItem(compareKey) || "[]") as string[];
    return Array.isArray(comparing) ? comparing.slice(0, 3) : [];
  } catch {
    return [];
  }
}

function toStoredAgent(agent: BnbAgentProfile): StoredAgent {
  return {
    key: agentKey(agent),
    name: agent.name,
    category: categoryLabel(agent.category),
    status: statusLabel(agent),
    bestFor: categoryLabel(agent.category),
    description: listingDescription(agent),
    ...(hasPrice(agent) ? { price: priceText(agent) } : {}),
    reviews: feedbackText(agent),
    ...(averageScoreText(agent) ? { averageScore: averageScoreText(agent) } : {}),
    lastActive: freshnessLabel(agent.lastActivity),
    ...(registeredLabel(agent) ? { registered: registeredLabel(agent) } : {}),
    ...(protocolSummary(agent).length > 0 ? { supportedProtocols: protocolSummary(agent) } : {}),
    x402: agent.x402Support ? "Supported" : "Not listed",
    serviceEndpoint: agent.services.some((service) => Boolean(service.endpoint)) ? "Available" : "Request access",
    walletStatus: /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet) ? "Wallet linked" : "No valid wallet",
    identity: agent.sourceMetrics?.sourceAgentId || agent.tokenId,
    verified: agent.sourceMetrics?.verified || agent.sourceFreshness.source === "8004scan",
    profileHref: `/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`,
    hireHref: `/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`,
    canHire: canHireAgent(agent),
  };
}

function categoryLabel(category: BnbAgentCategory) {
  return category === "Health Factor Monitoring" ? "Health Factor" : category;
}

function statusLabel(agent: BnbAgentProfile) {
  if (agent.activationStatus === "callable") return "Available";
  if (agent.activationStatus === "request") return "Request access";
  return "Unavailable";
}

function priceText(agent: BnbAgentProfile) {
  return agent.services.find((service) => service.price)?.price || "";
}

function hasPrice(agent: BnbAgentProfile) {
  return Boolean(agent.services.find((service) => service.price));
}

function reviewText(agent: BnbAgentProfile) {
  const rating = agent.feedback.score > 0 ? `${Math.min(5, agent.feedback.score / 20).toFixed(1)} · ` : "";
  return `${rating}${agent.feedback.count} review${agent.feedback.count === 1 ? "" : "s"}`;
}

function feedbackText(agent: BnbAgentProfile) {
  if (agent.feedback.count > 0) return reviewText(agent);
  return "No feedback yet";
}

function averageScoreText(agent: BnbAgentProfile) {
  const score = agent.sourceMetrics?.averageScore || agent.feedback.score;
  if (!Number.isFinite(score) || score <= 0) return "";
  return `${Math.round(score)}/100`;
}

function registeredLabel(agent: BnbAgentProfile) {
  const value = agent.sourceMetrics?.createdAt;
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(time));
}

function protocolSummary(agent: BnbAgentProfile) {
  const protocols = [
    ...(agent.sourceMetrics?.supportedProtocols || []),
    ...(agent.a2aSupport ? ["A2A"] : []),
    ...(agent.mcpSupport ? ["MCP"] : []),
    ...(agent.erc8183Support ? ["ERC-8183"] : []),
  ];

  return Array.from(new Set(protocols.map(formatProtocol).filter(Boolean)));
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

function listingDescription(agent: BnbAgentProfile) {
  const description = agent.description.trim();
  if (!description) return "";
  if (description === "ERC-8004 BSC agent indexed through 8004scan.") return "";
  if (description === "Configured BSC agent.") return "";
  if (/^[\w.-]+\.agent on TermiX Platform$/i.test(description)) return "";
  return description;
}

function freshnessLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Activity unknown";
  const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Active today";
  if (days === 1) return "Active 1 day ago";
  return `Active ${days} days ago`;
}

function canHireAgent(agent: BnbAgentProfile) {
  return agent.activationStatus === "callable" && /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
}
