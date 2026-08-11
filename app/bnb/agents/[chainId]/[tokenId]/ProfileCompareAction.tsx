"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { GitCompareArrows } from "lucide-react";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import {
  bnbAgentDisplayName,
  bnbAgentIntegrations,
  bnbAgentKey,
  bnbCanHireAgent,
  bnbCategoryLabel,
  bnbFreshnessLabel,
  bnbHasPrice,
  bnbIsVerified,
  bnbListingDescription,
  bnbPriceLabel,
  bnbRegisteredLabel,
  bnbReviewLabel,
  bnbServiceLabel,
  bnbStatusLabel,
  bnbUsableServices,
} from "@/lib/bnb/display";

type StoredAgent = {
  key: string;
  name: string;
  category: string;
  status: string;
  bestFor?: string;
  description?: string;
  price?: string;
  reviews?: string;
  lastActive?: string;
  registered?: string;
  integrations?: string[];
  services?: string[];
  verified?: boolean;
  profileHref: string;
  hireHref: string;
  canHire: boolean;
};

const savedKey = "hive:bnb:saved-agents";
const compareKey = "hive:bnb:compare-agents";

export function ProfileCompareAction({ agent }: { agent: BnbAgentProfile }) {
  const key = bnbAgentKey(agent);
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
  const services = bnbUsableServices(agent).map(bnbServiceLabel).slice(0, 3);
  return {
    key: bnbAgentKey(agent),
    name: bnbAgentDisplayName(agent),
    category: bnbCategoryLabel(agent.category),
    status: bnbStatusLabel(agent),
    bestFor: bnbCategoryLabel(agent.category),
    description: bnbListingDescription(agent),
    ...(bnbHasPrice(agent) ? { price: bnbPriceLabel(agent) } : {}),
    ...(agent.feedback.count > 0 ? { reviews: bnbReviewLabel(agent) } : {}),
    lastActive: bnbFreshnessLabel(agent.lastActivity),
    ...(bnbRegisteredLabel(agent) ? { registered: bnbRegisteredLabel(agent) } : {}),
    ...(bnbAgentIntegrations(agent).length > 0 ? { integrations: bnbAgentIntegrations(agent) } : {}),
    ...(services.length > 0 ? { services } : {}),
    verified: bnbIsVerified(agent),
    profileHref: `/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`,
    hireHref: `/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`,
    canHire: bnbCanHireAgent(agent),
  };
}
