"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
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
import styles from "./profile.module.css";

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

export function ProfileActions({ agent }: { agent: BnbAgentProfile }) {
  const key = bnbAgentKey(agent);
  const snapshot = useSyncExternalStore(
    subscribeToAgentStores,
    () => getSnapshot(key),
    () => JSON.stringify({ saved: false, compared: false, count: 0 }),
  );
  const { saved, compared, count } = JSON.parse(snapshot) as { saved: boolean; compared: boolean; count: number };

  function toggleSave() {
    const savedAgents = readSavedAgents();
    if (savedAgents[key]) delete savedAgents[key];
    else savedAgents[key] = toStoredAgent(agent);
    window.localStorage.setItem(savedKey, JSON.stringify(savedAgents));
    window.dispatchEvent(new Event("hive:bnb:saved-changed"));
  }

  function toggleCompare() {
    const comparedAgents = readComparedAgents();
    const exists = comparedAgents.includes(key);
    const next = exists
      ? comparedAgents.filter((item) => item !== key)
      : comparedAgents.length >= 3
        ? comparedAgents
        : [...comparedAgents, key];

    const savedAgents = readSavedAgents();
    savedAgents[key] = toStoredAgent(agent);
    window.localStorage.setItem(savedKey, JSON.stringify(savedAgents));
    window.localStorage.setItem(compareKey, JSON.stringify(next));
    window.dispatchEvent(new Event("hive:bnb:saved-changed"));
    window.dispatchEvent(new Event("hive:bnb:compare-changed"));
  }

  return (
    <div className={styles.profileActions}>
      <button
        type="button"
        className={styles.saveButton}
        aria-label={saved ? `Remove ${bnbAgentDisplayName(agent)} from saved agents` : `Save ${bnbAgentDisplayName(agent)}`}
        title={saved ? "Remove from saved" : "Save agent"}
        onClick={toggleSave}
      >
        <Bookmark aria-hidden="true" size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <label className={styles.compareControl} data-disabled={!compared && count >= 3 ? "true" : undefined}>
        <input type="checkbox" checked={compared} disabled={!compared && count >= 3} onChange={toggleCompare} />
        <span>{!compared && count >= 3 ? "Compare limit reached" : "Compare"}</span>
      </label>
      {count >= 2 ? <Link href="/bnb/agents">Compare selected</Link> : null}
    </div>
  );
}

function subscribeToAgentStores(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("hive:bnb:saved-changed", onStoreChange);
  window.addEventListener("hive:bnb:compare-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("hive:bnb:saved-changed", onStoreChange);
    window.removeEventListener("hive:bnb:compare-changed", onStoreChange);
  };
}

function getSnapshot(key: string) {
  const savedAgents = readSavedAgents();
  const comparedAgents = readComparedAgents();
  return JSON.stringify({
    saved: Boolean(savedAgents[key]),
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
