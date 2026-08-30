"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { BadgeCheck, Bookmark, Check, Save, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbAgentAvatar } from "@/app/bnb/_components/BnbAgentAvatar";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import {
  bnbAgentDisplayName,
  bnbAgentIntegrations,
  bnbAgentKey,
  bnbAgentSourceName,
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
import { bnbAgentHirePath, bnbAgentProfilePath } from "@/lib/bnb/routes";
import { type AgentFeedMode, useAgentDirectoryFeed } from "./useAgentDirectoryFeed";

type CategoryCount = {
  category: BnbAgentCategory;
  label: string;
};

type DirectoryState = {
  q: string;
  category: string;
  status: string;
  integration: string;
  sort: string;
};

type SavedAgent = {
  key: string;
  chainId?: number;
  tokenId?: string;
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

type ComparisonRow = {
  label: string;
  value: (agent: SavedAgent) => string;
  hasValue?: (agent: SavedAgent) => boolean;
};

type AgentsDirectoryProps = {
  agents: BnbAgentProfile[];
  categories: CategoryCount[];
  current: DirectoryState;
  resultLabel: string;
  totalAgents: number;
  initialMode: AgentFeedMode;
  initialPage: number;
};

const savedKey = "hive:bnb:saved-agents";
const compareKey = "hive:bnb:compare-agents";

const availabilityOptions = [
  { value: "all", label: "All agents" },
  { value: "hireable", label: "Available" },
];

const integrationOptions = [
  { value: "", label: "Any" },
  { value: "pancakeswap", label: "PancakeSwap" },
  { value: "altana", label: "Altana" },
];

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "active", label: "Recently active" },
  { value: "reviewed", label: "Most reviewed" },
];

export function AgentsDirectory({
  agents: initialAgents,
  categories,
  current,
  resultLabel,
  totalAgents,
  initialMode,
  initialPage,
}: AgentsDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(current.q);
  const [category, setCategory] = useState(current.category);
  const [status, setStatus] = useState(current.status);
  const [integration, setIntegration] = useState(current.integration);
  const [sort, setSort] = useState(current.sort || "recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const [savedAgents, setSavedAgents] = useState<Record<string, SavedAgent>>(() => readSavedAgents());
  const [compareAgents, setCompareAgents] = useState<string[]>(() => readComparedAgents());
  const initialized = useRef(false);
  const {
    agents,
    total,
    loading: loadingMore,
    error: loadError,
    done: feedDone,
    loadMore,
    sentinelRef,
  } = useAgentDirectoryFeed({
    initialAgents,
    initialMode,
    initialPage,
    initialTotal: totalAgents,
    query: current,
  });

  const activeFilterCount = [q.trim(), category, status && status !== "all" ? status : "", integration, sort !== "recommended" ? sort : ""]
    .filter(Boolean)
    .length;

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (status && status !== "all") params.set("status", status);
      if (integration) params.set("integration", integration);
      if (sort && sort !== "recommended") params.set("sort", sort);
      const query = params.toString();
      const currentParams = new URLSearchParams();
      if (current.q) currentParams.set("q", current.q);
      if (current.category) currentParams.set("category", current.category);
      if (current.status && current.status !== "all") currentParams.set("status", current.status);
      if (current.integration) currentParams.set("integration", current.integration);
      if (current.sort && current.sort !== "recommended") currentParams.set("sort", current.sort);
      if (query === currentParams.toString()) return;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [category, current.category, current.integration, current.q, current.sort, current.status, integration, pathname, q, router, sort, status]);

  useEffect(() => {
    if (!filtersOpen && !compareOpen) return;

    function closeOverlay(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (compareOpen) {
        setCompareOpen(false);
        return;
      }
      setFiltersOpen(false);
      filterTriggerRef.current?.focus();
    }

    document.addEventListener("keydown", closeOverlay);
    return () => document.removeEventListener("keydown", closeOverlay);
  }, [compareOpen, filtersOpen]);

  const visibleAgentMap = useMemo(() => {
    const entries = agents.map((agent) => [agentKey(agent), toSavedAgent(agent)] as const);
    return Object.fromEntries(entries);
  }, [agents]);

  const savedList = Object.values(savedAgents)
    .map((agent) => currentSavedAgent(agent, visibleAgentMap[agent.key]))
    .filter((agent): agent is SavedAgent => Boolean(agent));
  const comparison = compareAgents
    .map((key) => currentSavedAgent(savedAgents[key], visibleAgentMap[key]))
    .filter((agent): agent is SavedAgent => Boolean(agent));
  const cleanedComparison = comparison;
  const agentGroups = [
    {
      key: "available",
      title: "Available",
      agents: agents.filter(canHireAgent),
    },
    {
      key: "profiles",
      title: "Profiles",
      agents: agents.filter((agent) => !canHireAgent(agent)),
    },
  ].filter((group) => group.agents.length > 0);

  function setSaved(agent: BnbAgentProfile) {
    const saved = toSavedAgent(agent);
    setSavedAgents((currentSaved) => {
      const next = { ...currentSaved };
      if (next[saved.key]) {
        delete next[saved.key];
      } else {
        next[saved.key] = saved;
      }
      window.localStorage.setItem(savedKey, JSON.stringify(next));
      return next;
    });
  }

  function setCompare(agent: BnbAgentProfile) {
    const key = agentKey(agent);
    setCompareAgents((currentCompare) => {
      const exists = currentCompare.includes(key);
      const next = exists
        ? currentCompare.filter((item) => item !== key)
        : currentCompare.length >= 3
          ? currentCompare
          : [...currentCompare, key];
      window.localStorage.setItem(compareKey, JSON.stringify(next));
      return next;
    });
  }

  function clearFilters() {
    setQ("");
    setCategory("");
    setStatus("all");
    setIntegration("");
    setSort("recommended");
  }

  return (
    <div className="bnb-directory">
      <div className="bnb-directory-commandbar">
        <DirectorySearch q={q} setQ={setQ} />
        <button
          ref={filterTriggerRef}
          type="button"
          className="bnb-mobile-filter-button bnb-focus"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {savedList.length > 0 ? (
          <button type="button" className="bnb-directory-saved-trigger bnb-focus" onClick={() => setSavedOpen((open) => !open)}>
            <Bookmark aria-hidden="true" size={16} />
            Saved <span>{savedList.length}</span>
          </button>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="bnb-filter-sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="bnb-filter-sheet-panel">
            <div className="bnb-filter-sheet-head">
              <strong>Filters</strong>
              <button
                type="button"
                className="bnb-icon-button bnb-focus"
                aria-label="Close filters"
                onClick={() => {
                  setFiltersOpen(false);
                  filterTriggerRef.current?.focus();
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <DirectoryFilters
              categories={categories}
              category={category}
              setCategory={setCategory}
              status={status}
              setStatus={setStatus}
              integration={integration}
              setIntegration={setIntegration}
              sort={sort}
              setSort={setSort}
              activeFilterCount={activeFilterCount}
              clearFilters={clearFilters}
            />
            <button
              type="button"
              className="bnb-filter-sheet-submit bnb-focus"
              onClick={() => {
                setFiltersOpen(false);
                filterTriggerRef.current?.focus();
              }}
            >
              Show results
            </button>
          </div>
        </div>
      ) : null}

      <div className="bnb-directory-workspace">
        <aside className="bnb-directory-rail" aria-label="Filter agents">
          <DirectoryFilters
            categories={categories}
            category={category}
            setCategory={setCategory}
            status={status}
            setStatus={setStatus}
            integration={integration}
            setIntegration={setIntegration}
            sort={sort}
            setSort={setSort}
            activeFilterCount={activeFilterCount}
            clearFilters={clearFilters}
          />
        </aside>

        <section className="bnb-directory-results">
          <div className="bnb-directory-resultbar" aria-live="polite">
            <div>
              <strong>{resultLabel}</strong>
              <span>{agentCountSummary(agents.length, total)}</span>
            </div>
          </div>

          {savedOpen ? (
            <SavedAgents agents={savedList} remove={(key) => {
              setSavedAgents((currentSaved) => {
                const next = { ...currentSaved };
                delete next[key];
                window.localStorage.setItem(savedKey, JSON.stringify(next));
                return next;
              });
            }} />
          ) : null}

          {agents.length > 0 ? (
            <div className="bnb-directory-groups">
              {agentGroups.map((group) => (
                <section key={group.key} className="bnb-directory-group" aria-labelledby={`agent-group-${group.key}`}>
                  <div className="bnb-directory-group-head">
                    <h2 id={`agent-group-${group.key}`}>{group.title}</h2>
                  </div>
                  <div className="bnb-directory-list">
                    {group.agents.map((agent) => {
                      const key = agentKey(agent);
                      return (
                        <DirectoryAgentRow
                          key={key}
                          agent={agent}
                          query={q}
                          saved={Boolean(savedAgents[key])}
                          compared={compareAgents.includes(key)}
                          compareDisabled={!compareAgents.includes(key) && compareAgents.length >= 3}
                          onSave={() => setSaved(agent)}
                          onCompare={() => setCompare(agent)}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="bnb-empty-state">
              <Search aria-hidden="true" size={22} />
              <h2>No agents match these filters.</h2>
              <p>Clear the filters and try a broader search.</p>
              <div className="bnb-empty-state-actions">
                {activeFilterCount > 0 ? (
                  <button type="button" className="bnb-button-dark bnb-focus" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
                {q.trim() ? (
                  <Link href={`/match?intent=${encodeURIComponent(q.trim())}`} className="bnb-empty-state-match bnb-focus">
                    Match this task
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          <div ref={sentinelRef} className="bnb-directory-feed-status" aria-live="polite">
            {loadingMore ? (
              <span role="status" aria-label="Loading more agents"><BnbButtonLoader size={20} /></span>
            ) : loadError ? (
              <button type="button" className="bnb-directory-feed-retry bnb-focus" onClick={() => void loadMore()}>
                Try again
              </button>
            ) : feedDone && agents.length > 0 ? (
              <span>All agents loaded</span>
            ) : null}
          </div>
        </section>
      </div>

      {compareAgents.length > 0 ? (
        <div className="bnb-compare-tray">
          <span>{compareAgents.length} agent{compareAgents.length === 1 ? "" : "s"} selected</span>
          <button
            type="button"
            className="bnb-button-dark bnb-focus"
            disabled={compareAgents.length < 2}
            onClick={() => setCompareOpen((open) => !open)}
          >
            Compare agents
          </button>
          <button
            type="button"
            className="bnb-link-button bnb-focus"
            onClick={() => {
              setCompareAgents([]);
              window.localStorage.setItem(compareKey, "[]");
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      {compareOpen && cleanedComparison.length >= 2 ? (
        <ComparisonPanel agents={cleanedComparison} close={() => setCompareOpen(false)} />
      ) : null}
    </div>
  );
}

function DirectorySearch({ q, setQ }: { q: string; setQ: (value: string) => void }) {
  return (
    <label className="bnb-directory-search">
      <span>Search agents</span>
      <span className="bnb-directory-search-field">
        <Search aria-hidden="true" size={18} />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          type="search"
          autoComplete="off"
          placeholder="Search by name, task, or capability"
        />
      </span>
    </label>
  );
}

function DirectoryFilters({
  categories,
  category,
  setCategory,
  status,
  setStatus,
  integration,
  setIntegration,
  sort,
  setSort,
  activeFilterCount,
  clearFilters,
}: {
  categories: CategoryCount[];
  category: string;
  setCategory: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  integration: string;
  setIntegration: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  activeFilterCount: number;
  clearFilters: () => void;
}) {
  return (
    <div className="bnb-directory-filter-stack">
      <fieldset className="bnb-directory-filter-group">
        <legend>Availability</legend>
        {availabilityOptions.map((option) => (
          <label key={option.value}>
            <input type="radio" name="agent-status" value={option.value} checked={status === option.value} onChange={() => setStatus(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="bnb-directory-filter-group">
        <legend>Work type</legend>
        <label>
          <input type="radio" name="agent-category" value="" checked={!category} onChange={() => setCategory("")} />
          <span>All work</span>
        </label>
        {categories.map((item) => (
          <label key={item.category}>
            <input type="radio" name="agent-category" value={item.category} checked={category === item.category} onChange={() => setCategory(item.category)} />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="bnb-directory-select-field">
        <span>Works with</span>
        <BnbSelect value={integration} onChange={setIntegration} options={integrationOptions} ariaLabel="Works with" />
      </label>
      <label className="bnb-directory-select-field">
        <span>Sort by</span>
        <BnbSelect value={sort} onChange={setSort} options={sortOptions} ariaLabel="Sort by" />
      </label>
      {activeFilterCount > 0 ? (
        <button type="button" className="bnb-directory-clear bnb-focus" onClick={clearFilters}>
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

function DirectoryAgentRow({
  agent,
  query,
  saved,
  compared,
  compareDisabled,
  onSave,
  onCompare,
}: {
  agent: BnbAgentProfile;
  query: string;
  saved: boolean;
  compared: boolean;
  compareDisabled: boolean;
  onSave: () => void;
  onCompare: () => void;
}) {
  const description = listingDescription(agent);
  const reason = matchReason(agent, query);
  const canHire = canHireAgent(agent);
  const metadata = [
    { key: "activity", value: freshnessLabel(agent.lastActivity) },
    {
      key: "reviews",
      value: agent.feedback.count > 0 ? new Intl.NumberFormat("en-US").format(agent.feedback.count) : "",
      star: agent.feedback.count > 0,
    },
    { key: "price", value: hasPrice(agent) ? priceText(agent) : "" },
  ];
  const sourceName = bnbAgentSourceName(agent);

  return (
    <article className="bnb-directory-row">
      <BnbAgentAvatar agent={agent} className="bnb-directory-monogram" />
      <div className="bnb-directory-identity">
        <h2>
          <Link href={profileHref(agent)} className="bnb-focus">
            {bnbAgentDisplayName(agent)}
          </Link>
          {bnbIsVerified(agent) ? (
            <BadgeCheck aria-label="Verified" className="bnb-verified-mark" size={16} />
          ) : null}
        </h2>
        <p>{categoryLabel(agent.category)} · {statusLabel(agent)}</p>
        {sourceName ? <span className="bnb-directory-source">{sourceName}</span> : null}
      </div>

      <div className="bnb-directory-summary">
        {description ? <p>{description}</p> : <p className="bnb-directory-summary-spacer" aria-hidden="true" />}
        {reason ? <span>{reason}</span> : null}
      </div>

      <div className="bnb-directory-metadata" aria-label="Agent details">
        {metadata.map((item) => (
          <span
            key={`${agentKey(agent)}:${item.key}`}
            className={item.value ? item.star ? "bnb-directory-review-count" : undefined : "bnb-directory-meta-empty"}
            aria-label={item.star ? `${item.value} review${agent.feedback.count === 1 ? "" : "s"}` : undefined}
            aria-hidden={item.value ? undefined : "true"}
          >
            {item.star ? <Star aria-hidden="true" size={12} fill="currentColor" /> : null}
            {item.value || " "}
          </span>
        ))}
      </div>

      <div className="bnb-directory-actions">
        <button
          type="button"
          className="bnb-directory-save bnb-focus"
          aria-label={saved ? `Remove ${bnbAgentDisplayName(agent)} from saved agents` : `Save ${bnbAgentDisplayName(agent)}`}
          title={saved ? "Remove from saved" : "Save agent"}
          onClick={onSave}
          data-active={saved ? "true" : undefined}
        >
          <Bookmark aria-hidden="true" size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <label className="bnb-directory-compare" data-disabled={compareDisabled ? "true" : undefined}>
          <input type="checkbox" checked={compared} disabled={compareDisabled} onChange={onCompare} />
          <span>Compare</span>
        </label>
        <Link href={profileHref(agent)} className="bnb-button-dark bnb-focus">View profile</Link>
        {canHire ? (
          <Link href={hireHref(agent)} className="bnb-button bnb-focus">
            Hire
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function SavedAgents({ agents, remove }: { agents: SavedAgent[]; remove: (key: string) => void }) {
  return (
    <div className="bnb-saved-panel">
      <div className="bnb-saved-head">
        <strong>Saved agents</strong>
        <span>{agents.length} saved</span>
      </div>
      <div className="bnb-saved-list">
        {agents.map((agent) => (
          <div key={agent.key} className="bnb-saved-row">
            <div>
              <strong>{agent.name}</strong>
              <span>{[agent.category, agent.status, agent.price].filter(Boolean).join(" · ")}</span>
            </div>
            <div>
              <Link href={agent.profileHref} className="bnb-text-action bnb-focus">View</Link>
              {agent.canHire ? (
                <Link href={agent.hireHref} className="bnb-text-action bnb-focus">Hire</Link>
              ) : (
                <Link href={agent.profileHref} className="bnb-text-action bnb-focus">Profile</Link>
              )}
              <button type="button" className="bnb-link-button bnb-focus" onClick={() => remove(agent.key)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonPanel({ agents, close }: { agents: SavedAgent[]; close: () => void }) {
  const { authenticated, login } = useAuth();
  const { address } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { authFetch } = useBnbAuthFetch();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const rows: ComparisonRow[] = [
    { label: "Category", value: (agent) => agent.category },
    { label: "Status", value: (agent) => agent.status },
    { label: "Reviews", value: (agent) => agent.reviews || "Not enough data", hasValue: (agent) => Boolean(agent.reviews) },
    { label: "Price", value: (agent) => agent.price || "Not listed", hasValue: (agent) => Boolean(agent.price) },
    { label: "Last active", value: (agent) => agent.lastActive || "Not listed" },
    {
      label: "Registered",
      value: (agent) => agent.registered || "Not listed",
      hasValue: (agent) => Boolean(agent.registered),
    },
    {
      label: "Integrations",
      value: (agent) => agent.integrations?.length ? agent.integrations.join(", ") : "Not listed",
      hasValue: (agent) => Boolean(agent.integrations?.length),
    },
    {
      label: "Services",
      value: (agent) => agent.services?.length ? agent.services.join(", ") : "Not listed",
      hasValue: (agent) => Boolean(agent.services?.length),
    },
    { label: "Identity", value: (agent) => agent.verified ? "Verified" : "Not verified" },
  ];
  const visibleRows = rows.filter((row) => !row.hasValue || agents.some((agent) => row.hasValue?.(agent)));

  async function saveComparison() {
    setSaveError("");
    if (!authenticated && !address) {
      login({ loginMethods: ["wallet"], walletChainType: "ethereum-only" });
      return;
    }

    const identities = agents.map(agentIdentity).filter((identity): identity is { chainId: number; tokenId: string } => Boolean(identity));
    if (identities.length !== agents.length) {
      setSaveError("Refresh the directory and select the agents again.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/api/bnb/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: identities }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save comparison.");
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save comparison.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bnb-compare-panel" role="dialog" aria-modal="true" aria-label="Compare agents">
      <div className="bnb-compare-head">
        <strong>Compare agents</strong>
        <div className="bnb-compare-head-actions">
          {saved ? (
            <Link href="/activity?filter=comparisons" className="bnb-compare-saved bnb-focus">
              <Check aria-hidden="true" size={16} />
              View saved
            </Link>
          ) : (
            <button
              type="button"
              className="bnb-compare-save bnb-focus"
              onClick={saveComparison}
              disabled={saving || privyModalOpen}
              aria-busy={saving || privyModalOpen}
            >
              {saving || privyModalOpen ? <BnbButtonLoader size={16} /> : <Save aria-hidden="true" size={16} />}
              {saving ? "Saving" : !authenticated && !address ? "Sign in to save" : "Save comparison"}
            </button>
          )}
          <button type="button" className="bnb-icon-button bnb-focus" aria-label="Close comparison" onClick={close}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      {saveError ? <p className="bnb-compare-error" role="alert">{saveError}</p> : null}
      <div className="bnb-compare-table-wrap">
        <table className="bnb-compare-table">
          <thead>
            <tr>
              <th />
              {agents.map((agent) => (
                <th key={agent.key}>
                  <Link href={agent.profileHref} className="bnb-compare-agent-link bnb-focus">
                    {agent.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                {agents.map((agent) => (
                  <td key={`${agent.key}:${row.label}`}>{row.value(agent)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function agentKey(agent: BnbAgentProfile) {
  return bnbAgentKey(agent);
}

function readSavedAgents() {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(savedKey) || "{}") as Record<string, SavedAgent>;
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function agentCountSummary(shown: number, total: number) {
  const formattedTotal = new Intl.NumberFormat("en-US").format(total);
  const totalLabel = `${formattedTotal} agent${total === 1 ? "" : "s"}`;
  if (shown === total) return totalLabel;
  return `${shown} shown · ${formattedTotal} total`;
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

function profileHref(agent: BnbAgentProfile) {
  return bnbAgentProfilePath(agent);
}

function hireHref(agent: BnbAgentProfile) {
  return bnbAgentHirePath(agent);
}

function toSavedAgent(agent: BnbAgentProfile): SavedAgent {
  const services = bnbUsableServices(agent).map(bnbServiceLabel).slice(0, 3);
  return {
    key: agentKey(agent),
    chainId: agent.chainId,
    tokenId: agent.tokenId,
    name: bnbAgentDisplayName(agent),
    category: categoryLabel(agent.category),
    status: statusLabel(agent),
    bestFor: categoryLabel(agent.category),
    description: listingDescription(agent),
    ...(hasPrice(agent) ? { price: priceText(agent) } : {}),
    ...(feedbackText(agent) ? { reviews: feedbackText(agent) } : {}),
    lastActive: freshnessLabel(agent.lastActivity),
    ...(registeredLabel(agent) ? { registered: registeredLabel(agent) } : {}),
    ...(bnbAgentIntegrations(agent).length > 0 ? { integrations: bnbAgentIntegrations(agent) } : {}),
    ...(services.length > 0 ? { services } : {}),
    verified: bnbIsVerified(agent),
    profileHref: profileHref(agent),
    hireHref: hireHref(agent),
    canHire: canHireAgent(agent),
  };
}

function agentIdentity(agent: SavedAgent) {
  if (Number.isFinite(agent.chainId) && agent.tokenId) {
    return { chainId: Number(agent.chainId), tokenId: agent.tokenId };
  }
  const [chainId, ...tokenIdParts] = agent.key.split(":");
  const parsedChainId = Number(chainId);
  const tokenId = tokenIdParts.join(":");
  return Number.isFinite(parsedChainId) && tokenId ? { chainId: parsedChainId, tokenId } : null;
}

function cleanSavedAgent(agent: SavedAgent): SavedAgent {
  const price = agent.price || "";
  const reviews = agent.reviews || "";
  return {
    ...agent,
    bestFor: agent.bestFor || agent.category,
    integrations: Array.isArray(agent.integrations) ? agent.integrations.filter(Boolean) : undefined,
    services: Array.isArray(agent.services) ? agent.services.filter(Boolean) : undefined,
    ...(price ? { price } : { price: undefined }),
    ...(reviews ? { reviews } : { reviews: undefined }),
  };
}

function currentSavedAgent(stored: SavedAgent | undefined, current: SavedAgent | undefined) {
  if (current) return cleanSavedAgent(current);
  if (!stored) return undefined;
  return cleanSavedAgent({
    ...stored,
    status: stored.status === "Available" ? "Profile" : stored.status,
    canHire: false,
  });
}

function canHireAgent(agent: BnbAgentProfile) {
  return bnbCanHireAgent(agent);
}

function categoryLabel(category: BnbAgentCategory) {
  return bnbCategoryLabel(category);
}

function statusLabel(agent: BnbAgentProfile) {
  return bnbStatusLabel(agent);
}

function listingDescription(agent: BnbAgentProfile) {
  return bnbListingDescription(agent);
}

function priceText(agent: BnbAgentProfile) {
  return bnbPriceLabel(agent);
}

function hasPrice(agent: BnbAgentProfile) {
  return bnbHasPrice(agent);
}

function reviewText(agent: BnbAgentProfile) {
  return bnbReviewLabel(agent);
}

function feedbackText(agent: BnbAgentProfile) {
  return agent.feedback.count > 0 ? reviewText(agent) : "";
}

function registeredLabel(agent: BnbAgentProfile) {
  return bnbRegisteredLabel(agent);
}

function freshnessLabel(value: string) {
  return bnbFreshnessLabel(value);
}

function matchReason(agent: BnbAgentProfile, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return "";
  const words = needle.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  const haystack = [
    agent.name,
    agent.description,
    agent.category,
    agent.capabilities.join(" "),
  ].join(" ").toLowerCase();
  const matched = words.find((word) => haystack.includes(word));
  return matched ? `Matched "${matched}"` : "";
}
