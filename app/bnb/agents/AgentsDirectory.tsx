"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, GitCompareArrows, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";
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
  canCheck: boolean;
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
  page: number;
  pageSize: number;
  totalAgents: number;
  hasMore: boolean;
};

const savedKey = "hive:bnb:saved-agents";
const compareKey = "hive:bnb:compare-agents";

const availabilityOptions = [
  { value: "", label: "All" },
  { value: "ready_to_run", label: "Ready to run" },
  { value: "connectable", label: "Connectable" },
  { value: "listed_only", label: "Listed only" },
  { value: "unavailable", label: "Unavailable" },
];

const integrationOptions = [
  { value: "", label: "Any" },
  { value: "pancakeswap", label: "PancakeSwap" },
  { value: "altana", label: "Altana" },
];

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "active", label: "Most active" },
  { value: "rated", label: "Highest rated" },
  { value: "reviewed", label: "Most reviewed" },
  { value: "newest", label: "Newest" },
];

export function AgentsDirectory({
  agents,
  categories,
  current,
  resultLabel,
  page,
  pageSize,
  totalAgents,
  hasMore,
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
  const [savedAgents, setSavedAgents] = useState<Record<string, SavedAgent>>(() => readSavedAgents());
  const [compareAgents, setCompareAgents] = useState<string[]>(() => readComparedAgents());
  const initialized = useRef(false);

  const activeFilterCount = [q.trim(), category, status, integration, sort !== "recommended" ? sort : ""]
    .filter(Boolean)
    .length;
  const pageCount = Math.max(1, Math.ceil(totalAgents / pageSize));
  const start = agents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = agents.length === 0 ? 0 : start + agents.length - 1;
  const paginationItems = compactPagination(page, pageCount);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (integration) params.set("integration", integration);
      if (sort && sort !== "recommended") params.set("sort", sort);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [category, integration, pathname, q, router, sort, status]);

  const visibleAgentMap = useMemo(() => {
    const entries = agents.map((agent) => [agentKey(agent), toSavedAgent(agent)] as const);
    return Object.fromEntries(entries);
  }, [agents]);

  const savedList = Object.values(savedAgents).map(cleanSavedAgent);
  const comparison = compareAgents
    .map((key) => visibleAgentMap[key] || savedAgents[key])
    .filter((agent): agent is SavedAgent => Boolean(agent));
  const cleanedComparison = comparison.map(cleanSavedAgent);

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
    setStatus("");
    setIntegration("");
    setSort("recommended");
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    if (current.category) params.set("category", current.category);
    if (current.status) params.set("status", current.status);
    if (current.integration) params.set("integration", current.integration);
    if (current.sort && current.sort !== "recommended") params.set("sort", current.sort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="bnb-directory">
      <div className="bnb-directory-controls">
        <div className="bnb-category-tabs" aria-label="Agent categories">
          <button
            type="button"
            className="bnb-category-tab"
            data-active={!category ? "true" : undefined}
            onClick={() => setCategory("")}
          >
            All
          </button>
          {categories.map((item) => (
            <button
              key={item.category}
              type="button"
              className="bnb-category-tab"
              data-active={category === item.category ? "true" : undefined}
              onClick={() => setCategory(item.category)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="bnb-mobile-filter-button bnb-focus"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>

        <div className="bnb-filter-panel bnb-directory-filter-panel">
          <FilterFields
            q={q}
            setQ={setQ}
            status={status}
            setStatus={setStatus}
            integration={integration}
            setIntegration={setIntegration}
            sort={sort}
            setSort={setSort}
            activeFilterCount={activeFilterCount}
            clearFilters={clearFilters}
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="bnb-filter-sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="bnb-filter-sheet-panel">
            <div className="bnb-filter-sheet-head">
              <strong>Filters</strong>
              <button type="button" className="bnb-icon-button bnb-focus" onClick={() => setFiltersOpen(false)}>
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <FilterFields
              q={q}
              setQ={setQ}
              status={status}
              setStatus={setStatus}
              integration={integration}
              setIntegration={setIntegration}
              sort={sort}
              setSort={setSort}
              activeFilterCount={activeFilterCount}
              clearFilters={clearFilters}
            />
          </div>
        </div>
      ) : null}

      <div className="bnb-directory-resultbar">
        <strong>{resultLabel}</strong>
        <div>
          {savedList.length > 0 ? (
            <button type="button" className="bnb-link-button bnb-focus" onClick={() => setSavedOpen((open) => !open)}>
              Saved agents {savedList.length}
            </button>
          ) : null}
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
        <div className="bnb-directory-list">
          {agents.map((agent) => {
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
      ) : (
        <div className="bnb-empty-state">
          <h2>No matching agents</h2>
          <p>No listed agents match these filters.</p>
          {activeFilterCount > 0 ? (
            <button type="button" className="bnb-button-dark bnb-focus" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      )}

      {totalAgents > 0 ? (
        <nav className="bnb-pagination" aria-label="Agent directory pagination">
          <span>Showing {start}-{end}</span>
          <div>
            <Link
              href={pageHref(Math.max(1, page - 1))}
              className="bnb-page-link bnb-focus"
              aria-disabled={page <= 1}
              data-disabled={page <= 1 ? "true" : undefined}
            >
              Previous
            </Link>
            {paginationItems.map((item, index) => (
              item === "ellipsis" ? (
                <span key={`ellipsis:${index}`} className="bnb-page-ellipsis">...</span>
              ) : (
                <Link
                  key={item}
                  href={pageHref(item)}
                  className="bnb-page-link bnb-focus"
                  data-active={item === page ? "true" : undefined}
                >
                  {item}
                </Link>
              )
            ))}
            <Link
              href={pageHref(hasMore ? page + 1 : Math.min(pageCount, page + 1))}
              className="bnb-page-link bnb-focus"
              aria-disabled={!hasMore && page >= pageCount}
              data-disabled={!hasMore && page >= pageCount ? "true" : undefined}
            >
              Next
            </Link>
          </div>
        </nav>
      ) : null}

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

function FilterFields({
  q,
  setQ,
  status,
  setStatus,
  integration,
  setIntegration,
  sort,
  setSort,
  activeFilterCount,
  clearFilters,
}: {
  q: string;
  setQ: (value: string) => void;
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
    <div className="bnb-directory-filter-grid">
      <label className="bnb-directory-search">
        <span className="bnb-filter-label">Search</span>
        <span className="bnb-filter-input-wrap">
          <Search aria-hidden="true" size={16} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            type="search"
            autoComplete="off"
            placeholder="Search by agent name or capability"
            className="bnb-input bnb-input-with-icon"
          />
        </span>
      </label>
      <label>
        <span className="bnb-filter-label">Availability</span>
        <BnbSelect value={status} onChange={setStatus} options={availabilityOptions} ariaLabel="Availability" />
      </label>
      <label>
        <span className="bnb-filter-label">Works with</span>
        <BnbSelect value={integration} onChange={setIntegration} options={integrationOptions} ariaLabel="Works with" />
      </label>
      <label>
        <span className="bnb-filter-label">Sort by</span>
        <BnbSelect value={sort} onChange={setSort} options={sortOptions} ariaLabel="Sort by" />
      </label>
      {activeFilterCount > 0 ? (
        <button type="button" className="bnb-button-dark bnb-focus" onClick={clearFilters}>
          Clear filters
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
  const metadata = [
    freshnessLabel(agent.lastActivity),
    agent.feedback.count > 0 ? reviewText(agent) : "",
    hasPrice(agent) ? priceText(agent) : "",
  ];
  const sourceName = bnbAgentSourceName(agent);

  return (
    <article className="bnb-directory-row">
      <div className="bnb-directory-identity">
        <h2>
          <Link href={profileHref(agent)} className="bnb-focus">
            {bnbAgentDisplayName(agent)}
          </Link>
          {bnbIsVerified(agent) ? (
            <BadgeCheck aria-label="ERC-8004 identity verified" className="bnb-verified-mark" size={16} />
          ) : null}
        </h2>
        <p>{categoryLabel(agent.category)} · {statusLabel(agent)}</p>
        {sourceName ? <span className="bnb-directory-source">{sourceName}</span> : null}
      </div>

      <div className="bnb-directory-summary">
        {description ? <p>{description}</p> : <p className="bnb-directory-summary-spacer" aria-hidden="true" />}
        {reason ? <span>{reason}</span> : null}
      </div>

      <div className="bnb-directory-metadata">
        {metadata.map((value, index) => (
          <span
            key={`${agentKey(agent)}:${index}`}
            className={value ? undefined : "bnb-directory-meta-empty"}
            aria-hidden={value ? undefined : "true"}
          >
            {value || " "}
          </span>
        ))}
      </div>

      <div className="bnb-directory-actions">
        <button type="button" className="bnb-row-action bnb-focus" onClick={onSave} data-active={saved ? "true" : undefined}>
          <Heart aria-hidden="true" size={15} />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          className="bnb-row-action bnb-focus"
          onClick={onCompare}
          disabled={compareDisabled}
          data-active={compared ? "true" : undefined}
        >
          <GitCompareArrows aria-hidden="true" size={15} />
          Compare
        </button>
        <Link href={profileHref(agent)} className="bnb-button-dark bnb-focus">View profile</Link>
        {canHireAgent(agent) || agent.executionStatus === "connectable" ? (
          <Link href={hireHref(agent)} className="bnb-button bnb-focus">
            {canHireAgent(agent) ? "Hire" : "Check"}
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
              ) : agent.canCheck ? (
                <Link href={agent.hireHref} className="bnb-text-action bnb-focus">Check</Link>
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
  const rows: ComparisonRow[] = [
    { label: "Category", value: (agent) => agent.category },
    { label: "Availability", value: (agent) => agent.status },
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

  return (
    <div className="bnb-compare-panel" role="dialog" aria-modal="true" aria-label="Compare agents">
      <div className="bnb-compare-head">
        <strong>Compare agents</strong>
        <button type="button" className="bnb-icon-button bnb-focus" onClick={close}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
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
  return `/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`;
}

function compactPagination(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount]);
  for (let item = Math.max(1, page - 2); item <= Math.min(pageCount, page + 2); item += 1) {
    pages.add(item);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  return sorted.flatMap((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) return ["ellipsis" as const, item];
    return [item];
  });
}

function hireHref(agent: BnbAgentProfile) {
  return `/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`;
}

function toSavedAgent(agent: BnbAgentProfile): SavedAgent {
  const services = bnbUsableServices(agent).map(bnbServiceLabel).slice(0, 3);
  return {
    key: agentKey(agent),
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
    canCheck: agent.executionStatus === "connectable",
  };
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
