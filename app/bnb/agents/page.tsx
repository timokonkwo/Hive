import { redirect } from "next/navigation";
import { getBnbAgentNetworkStats, getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { BnbContainer, BnbPageHeader, BnbShell } from "@/app/bnb/_components/BnbUi";
import type { BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import { bnbCategoryLabel } from "@/lib/bnb/display";
import { AgentsDirectory } from "./AgentsDirectory";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";
const defaultStatus = "all";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePage(value: string | undefined) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function normalizeStatus(value: string | undefined): string {
  if (!value) return defaultStatus;
  if (value === "all") return "all";
  if (value === "callable" || value === "available" || value === "ready_to_run" || value === "connectable" || value === "request" || value === "hireable") return "hireable";
  if (value === "discoverable") return "listed_only";
  if (value === "listed_only" || value === "unavailable") return value;
  return "";
}

function executionFromStatus(value: string): string | null {
  if (value === "all") return null;
  if (value === "hireable" || value === "ready_to_run" || value === "connectable" || value === "listed_only" || value === "unavailable") return value;
  return null;
}

function normalizeSort(value: string | undefined): string {
  if (value === "freshness") return "active";
  if (value === "feedback") return "rated";
  if (["recommended", "active", "rated", "reviewed", "newest"].includes(value || "")) return value || "recommended";
  return "recommended";
}

function sortForCatalog(value: string) {
  if (value === "recommended") return "recommended";
  if (value === "active") return "freshness";
  if (value === "rated") return "feedback";
  if (value === "reviewed") return "reviews";
  if (value === "newest") return "newest";
  return null;
}

function categoryLabel(category: BnbAgentCategory) {
  return bnbCategoryLabel(category);
}

function supportsIntegration(agent: BnbAgentProfile, integration?: string | null) {
  if (!integration) return true;
  const haystack = [
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
  ].join(" ").toLowerCase();

  if (integration === "pancakeswap") return haystack.includes("pancake");
  if (integration === "altana") return haystack.includes("altana") || (agent.a2aSupport && (haystack.includes("wallet") || haystack.includes("health")));
  if (integration === "8004scan") return agent.sourceFreshness.source === "8004scan";
  return true;
}

export default async function BnbAgentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedCategory = paramValue(params.category) || "";
  const q = paramValue(params.q) || "";
  const sort = normalizeSort(paramValue(params.sort));
  const status = normalizeStatus(paramValue(params.status) || paramValue(params.activation));
  const integration = paramValue(params.integration) || "";
  const categories = getBnbCategories();
  const category = categories.includes(requestedCategory as BnbAgentCategory) ? requestedCategory : "";
  const execution = executionFromStatus(status);
  const catalogSort = sortForCatalog(sort);
  const pageSize = 24;
  const page = normalizePage(paramValue(params.page));
  const [result, networkStats] = await Promise.all([
    listBnbAgentsPage({
      q,
      category,
      sort: catalogSort,
      execution,
      limit: pageSize,
      page,
    }),
    getBnbAgentNetworkStats(),
  ]);
  const unfilteredRegistry = !q && !category && !execution && !integration;
  const networkTotal = unfilteredRegistry ? Math.max(result.total, networkStats.totalAgents) : result.total || 0;
  const pageCount = Math.max(1, Math.ceil(networkTotal / pageSize));
  if (networkTotal > 0 && page > pageCount) {
    const nextParams = new URLSearchParams();
    if (q) nextParams.set("q", q);
    if (category) nextParams.set("category", category);
    if (status && status !== defaultStatus) nextParams.set("status", status);
    if (integration) nextParams.set("integration", integration);
    if (sort && sort !== "recommended") nextParams.set("sort", sort);
    if (pageCount > 1) nextParams.set("page", String(pageCount));
    const query = nextParams.toString();
    redirect(query ? `/bnb/agents?${query}` : "/bnb/agents");
  }
  const baseAgents = result.agents.filter((agent) => supportsIntegration(agent, integration));
  const categoryCounts = categories.map((item) => ({
    category: item,
    label: categoryLabel(item),
  }));
  const agents = baseAgents;
  const hasFilters = Boolean(q || category || (status && status !== defaultStatus) || integration || sort !== "recommended");
  const resultLabel = q
    ? `Agents for "${q}"`
    : hasFilters
      ? "Filtered agents"
      : "Agents";

  return (
    <BnbShell active="agents">
      <BnbPageHeader
        title="Agents"
        body="Search agents by capability and run status."
      />

      <BnbContainer className="bnb-section">
        <AgentsDirectory
          agents={agents}
          categories={categoryCounts}
          current={{ q, category, status, integration, sort }}
          resultLabel={resultLabel}
          page={page}
          pageSize={pageSize}
          totalAgents={networkTotal}
          hasMore={result.hasMore}
        />
      </BnbContainer>
    </BnbShell>
  );
}
