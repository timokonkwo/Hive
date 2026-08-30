import Link from "next/link";
import { getBnbAgentNetworkStats, getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import type { BnbAgentCategory } from "@/lib/bnb/types";
import { bnbCategoryLabel } from "@/lib/bnb/display";
import { AgentsDirectory } from "./AgentsDirectory";
import styles from "./agents.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";
const defaultStatus = "all";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): string {
  if (!value) return defaultStatus;
  if (value === "all") return "all";
  if (value === "callable" || value === "available" || value === "ready_to_run" || value === "run_ready" || value === "hireable") return "hireable";
  return "all";
}

function executionFromStatus(value: string): string | null {
  if (value === "hireable") return "hireable";
  return null;
}

function normalizeSort(value: string | undefined): string {
  if (value === "freshness") return "active";
  if (value === "feedback" || value === "reviews" || value === "rated") return "reviewed";
  if (["recommended", "active", "reviewed"].includes(value || "")) return value || "recommended";
  return "recommended";
}

function sortForCatalog(value: string) {
  if (value === "recommended") return "recommended";
  if (value === "active") return "freshness";
  if (value === "reviewed") return "reviews";
  return null;
}

function categoryLabel(category: BnbAgentCategory) {
  return bnbCategoryLabel(category);
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
  const query = {
    q,
    category,
    sort: catalogSort,
    integration,
    limit: pageSize,
    page: 1,
  };
  let result = await listBnbAgentsPage({ ...query, execution: status === "all" ? "hireable" : execution });
  let initialMode: "available" | "profiles" | "done" = status === "hireable"
    ? result.hasMore ? "available" : "done"
    : result.hasMore ? "available" : "profiles";
  let initialPage = initialMode === "available" ? 1 : 0;

  if (status === "all" && result.agents.length === 0) {
    result = await listBnbAgentsPage({ ...query, execution: null });
    initialMode = result.hasMore ? "profiles" : "done";
    initialPage = 1;
  }

  const unfilteredDirectory = !q && !category && !integration && status === "all";
  const networkStats = unfilteredDirectory ? await getBnbAgentNetworkStats() : null;
  const totalAgents = networkStats?.totalAgents || result.total;
  const categoryCounts = categories.filter((item) => item !== "Other").map((item) => ({
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
    <BnbShell active="agents" variant="landing" back={{ href: "/", label: "Back to home" }}>
      <div className={styles.page}>
        <section className={styles.pageHeader}>
          <BnbContainer className={styles.pageHeaderInner}>
            <div>
              <h1>Agents</h1>
              <p>Search the BNB Chain directory and see which agents can accept work now.</p>
            </div>
            <Link href="/match" className={styles.matchLink}>Describe a task instead</Link>
          </BnbContainer>
        </section>

        <BnbContainer className={styles.directoryPage}>
          <AgentsDirectory
            agents={agents}
            categories={categoryCounts}
            current={{ q, category, status, integration, sort }}
            resultLabel={resultLabel}
            totalAgents={totalAgents}
            initialMode={initialMode}
            initialPage={initialPage}
          />
        </BnbContainer>
      </div>
    </BnbShell>
  );
}
