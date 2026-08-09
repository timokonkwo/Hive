import { formatBnbAgentCount, getBnbAgentNetworkStats, getBnbCategories, listBnbAgents } from "@/lib/bnb/catalog";
import { BnbContainer, BnbHero, BnbShell } from "@/app/bnb/_components/BnbUi";
import type { BnbActivationStatus, BnbAgentCategory, BnbAgentProfile } from "@/lib/bnb/types";
import { AgentsDirectory } from "./AgentsDirectory";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePage(value: string | undefined, pageCount: number) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), Math.max(1, pageCount));
}

function normalizeStatus(value: string | undefined): string {
  if (value === "callable") return "available";
  if (value === "discoverable") return "unavailable";
  if (value === "available" || value === "request" || value === "unavailable") return value;
  return "";
}

function activationFromStatus(value: string): BnbActivationStatus | null {
  if (value === "available") return "callable";
  if (value === "request") return "request";
  if (value === "unavailable") return "discoverable";
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
  return category === "Health Factor Monitoring" ? "Health Factor" : category;
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
  const activation = activationFromStatus(status);
  const catalogSort = sortForCatalog(sort);
  const pageSize = 24;
  const [listedAgents, networkStats] = await Promise.all([
    listBnbAgents({
      q,
      sort: catalogSort,
      activation,
      limit: 100,
    }),
    getBnbAgentNetworkStats(),
  ]);
  const baseAgents = listedAgents.filter((agent) => supportsIntegration(agent, integration));
  const categoryCounts = categories.map((item) => ({
    category: item,
    label: categoryLabel(item),
    count: baseAgents.filter((agent) => agent.category === item).length,
  }));
  const filteredAgents = category
    ? baseAgents.filter((agent) => agent.category === category)
    : baseAgents;
  const pageCount = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const page = normalizePage(paramValue(params.page), pageCount);
  const agents = filteredAgents.slice((page - 1) * pageSize, page * pageSize);
  const bscAgentCount = formatBnbAgentCount(networkStats.totalAgents);
  const hasFilters = Boolean(q || category || status || integration || sort !== "recommended");
  const resultLabel = q
    ? `${filteredAgents.length} agent${filteredAgents.length === 1 ? "" : "s"} for "${q}"`
    : hasFilters
      ? `${filteredAgents.length} agent${filteredAgents.length === 1 ? "" : "s"} match your filters`
      : `${filteredAgents.length} agents shown`;

  return (
    <BnbShell active="agents">
      <BnbHero
        title="Agents"
        body={`Browse agents by capability, availability, and track record. ${bscAgentCount} registered on BSC.`}
        kicker={null}
      />

      <BnbContainer className="bnb-section">
        <AgentsDirectory
          agents={agents}
          categories={categoryCounts}
          current={{ q, category, status, integration, sort }}
          resultLabel={resultLabel}
          page={page}
          pageSize={pageSize}
          totalAgents={filteredAgents.length}
        />
      </BnbContainer>
    </BnbShell>
  );
}
