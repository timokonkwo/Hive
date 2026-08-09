"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, GitCompareArrows, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";

type CategoryCount = {
  category: BnbAgentCategory;
  label: string;
  count: number;
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
};

const savedKey = "hive:bnb:saved-agents";
const compareKey = "hive:bnb:compare-agents";

const availabilityOptions = [
  { value: "", label: "All" },
  { value: "available", label: "Available" },
  { value: "request", label: "Request access" },
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
  const start = totalAgents === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalAgents);

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
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
              <Link
                key={item}
                href={pageHref(item)}
                className="bnb-page-link bnb-focus"
                data-active={item === page ? "true" : undefined}
              >
                {item}
              </Link>
            ))}
            <Link
              href={pageHref(Math.min(pageCount, page + 1))}
              className="bnb-page-link bnb-focus"
              aria-disabled={page >= pageCount}
              data-disabled={page >= pageCount ? "true" : undefined}
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
  const canHire = canHireAgent(agent);
  const reason = matchReason(agent, query);
  const metadata = [
    freshnessLabel(agent.lastActivity),
    agent.feedback.count > 0 ? reviewText(agent) : "",
    hasPrice(agent) ? priceText(agent) : "",
  ];

  return (
    <article className="bnb-directory-row">
      <div className="bnb-directory-identity">
        <h2>
          <Link href={profileHref(agent)} className="bnb-focus">
            {agent.name}
          </Link>
          {agent.sourceFreshness.source === "8004scan" ? (
            <BadgeCheck aria-label="ERC-8004 identity verified" className="bnb-verified-mark" size={16} />
          ) : null}
        </h2>
        <p>{categoryLabel(agent.category)} · {statusLabel(agent)}</p>
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
        {canHire ? (
          <Link href={hireHref(agent)} className="bnb-link-button bnb-focus">Hire</Link>
        ) : (
          <Link href={`${profileHref(agent)}#request-access`} className="bnb-link-button bnb-focus">Request</Link>
        )}
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
                <Link href={`${agent.profileHref}#request-access`} className="bnb-text-action bnb-focus">Request</Link>
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
    { label: "Best for", value: (agent) => agent.bestFor || agent.category },
    { label: "Availability", value: (agent) => agent.status },
    { label: "Feedback", value: (agent) => agent.reviews || "No feedback yet" },
    {
      label: "Average score",
      value: (agent) => agent.averageScore || "Not available",
      hasValue: (agent) => Boolean(agent.averageScore),
    },
    { label: "Last active", value: (agent) => agent.lastActive || "Not available" },
    {
      label: "Registered",
      value: (agent) => agent.registered || "Not available",
      hasValue: (agent) => Boolean(agent.registered),
    },
    {
      label: "Supported protocols",
      value: (agent) => agent.supportedProtocols?.length ? agent.supportedProtocols.join(", ") : "Not available",
      hasValue: (agent) => Boolean(agent.supportedProtocols?.length),
    },
    { label: "x402", value: (agent) => agent.x402 || "Not listed" },
    { label: "Service endpoint", value: (agent) => agent.serviceEndpoint || "Not listed" },
    {
      label: "Price",
      value: (agent) => agent.price || "Not available",
      hasValue: (agent) => Boolean(agent.price),
    },
    { label: "Wallet", value: (agent) => agent.walletStatus || "Not available" },
    { label: "ERC-8004 identity", value: (agent) => agent.identity || agent.key },
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
  return `${agent.chainId}:${agent.tokenId}`;
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

function hireHref(agent: BnbAgentProfile) {
  return `/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`;
}

function toSavedAgent(agent: BnbAgentProfile): SavedAgent {
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
    profileHref: profileHref(agent),
    hireHref: hireHref(agent),
    canHire: canHireAgent(agent),
  };
}

function cleanSavedAgent(agent: SavedAgent): SavedAgent {
  const price = agent.price && agent.price !== "Price on request" ? agent.price : "";
  const reviews = agent.reviews && agent.reviews !== "No reviews yet" ? agent.reviews : "No feedback yet";
  return {
    ...agent,
    bestFor: agent.bestFor || agent.category,
    supportedProtocols: Array.isArray(agent.supportedProtocols) ? agent.supportedProtocols.filter(Boolean) : undefined,
    x402: agent.x402 || "Not listed",
    serviceEndpoint: agent.serviceEndpoint || "Not listed",
    walletStatus: agent.walletStatus || "Not available",
    identity: agent.identity || agent.key,
    ...(price ? { price } : { price: undefined }),
    reviews,
  };
}

function canHireAgent(agent: BnbAgentProfile) {
  return agent.activationStatus === "callable" && /^0x[a-fA-F0-9]{40}$/.test(agent.agentWallet);
}

function categoryLabel(category: BnbAgentCategory) {
  return category === "Health Factor Monitoring" ? "Health Factor" : category;
}

function statusLabel(agent: BnbAgentProfile) {
  if (agent.activationStatus === "callable") return "Available";
  if (agent.activationStatus === "request") return "Request access";
  return "Unavailable";
}

function listingDescription(agent: BnbAgentProfile) {
  const description = agent.description.trim();
  if (!description) return "";
  if (description === "ERC-8004 BSC agent indexed through 8004scan.") return "";
  if (description === "Configured BSC agent.") return "";
  if (/^[\w.-]+\.agent on TermiX Platform$/i.test(description)) return "";
  return description;
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

function freshnessLabel(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Activity unknown";
  const days = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Active today";
  if (days === 1) return "Active 1 day ago";
  return `Active ${days} days ago`;
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
