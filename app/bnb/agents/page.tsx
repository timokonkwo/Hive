import { redirect } from "next/navigation";
import { getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { BnbContainer, BnbPageHeader, BnbShell } from "@/app/bnb/_components/BnbUi";
import type { BnbAgentCategory } from "@/lib/bnb/types";
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
  if (value === "callable" || value === "available" || value === "ready_to_run" || value === "run_ready" || value === "hireable") return "hireable";
  if (value === "connectable" || value === "endpoint_found" || value === "request") return "hireable";
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

function resultPaginationTotal({
  total,
  agentCount,
  page,
  pageSize,
  hasMore,
}: {
  total: number;
  agentCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}) {
  const normalizedTotal = Number.isFinite(total) ? Math.max(Math.trunc(total), 0) : 0;
  if (normalizedTotal > 0) return normalizedTotal;
  if (agentCount === 0) return 0;
  return (page - 1) * pageSize + agentCount + (hasMore ? pageSize : 0);
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
  const result = await listBnbAgentsPage({
    q,
    category,
    sort: catalogSort,
    execution,
    integration,
    limit: pageSize,
    page,
  });
  const paginationTotal = resultPaginationTotal({
    total: result.total,
    agentCount: result.agents.length,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
  });
  const pageCount = Math.max(1, Math.ceil(paginationTotal / pageSize));
  if (paginationTotal > 0 && page > pageCount) {
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
  const categoryCounts = categories.map((item) => ({
    category: item,
    label: categoryLabel(item),
  }));
  const agents = result.agents;
  const hasFilters = Boolean(q || category || (status && status !== defaultStatus) || integration || sort !== "recommended");
  const resultLabel = q
    ? `Agents for "${q}"`
    : hasFilters
      ? "Filtered agents"
      : "Agents";

  return (
    <BnbShell active="agents">
      <BnbPageHeader title="Agents" />

      <BnbContainer className="bnb-section">
        <AgentsDirectory
          agents={agents}
          categories={categoryCounts}
          current={{ q, category, status, integration, sort }}
          resultLabel={resultLabel}
          page={page}
          pageSize={pageSize}
          totalAgents={paginationTotal}
          hasMore={result.hasMore}
        />
      </BnbContainer>
    </BnbShell>
  );
}
