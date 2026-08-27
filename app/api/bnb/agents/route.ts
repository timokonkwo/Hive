import { NextRequest, NextResponse } from "next/server";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBnbAgentNetworkStats, getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function executionFilter(value: string | null) {
  if (!value) return null;
  if (value === "all") return null;
  if (value === "callable" || value === "available" || value === "ready_to_run" || value === "run_ready" || value === "hireable") return "hireable";
  if (value === "connectable" || value === "endpoint_found" || value === "request") return "connectable";
  if (value === "discoverable") return "listed_only";
  if (value === "listed_only" || value === "unavailable") return value;
  return null;
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

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "agents", "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || 24);
  const page = Number(searchParams.get("page") || 1);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const integration = searchParams.get("integration");
  const execution = executionFilter(searchParams.get("execution") || searchParams.get("status") || searchParams.get("activation"));
  const [result, networkStats] = await Promise.all([
    listBnbAgentsPage({
      category,
      q,
      activation: null,
      execution,
      integration,
      sort: searchParams.get("sort"),
      limit: Number.isFinite(limit) ? limit : 24,
      page: Number.isFinite(page) ? page : 1,
    }),
    getBnbAgentNetworkStats(),
  ]);
  const sources = Array.from(new Set(result.agents.map((agent) => agent.sourceFreshness.source)));
  const total = resultPaginationTotal({
    total: result.total,
    agentCount: result.agents.length,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
  });
  recordBnbAnalyticsEvent({
    name: "discovery.list",
    route: "api.bnb.agents",
    metadata: {
      page: result.page,
      pageSize: result.pageSize,
      returned: result.agents.length,
      total,
      hasQuery: Boolean(q),
      category: category || "all",
      execution: execution || "all",
      integration: integration || "any",
      sort: searchParams.get("sort") || "recommended",
      source: sources.length > 0 ? sources.join("+") : "none",
    },
  });

  return NextResponse.json({
    agents: result.agents,
    categories: getBnbCategories(),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total,
      hasMore: result.hasMore,
    },
    networkStats,
    source: sources.length > 0 ? sources.join("+") : "none",
    lastUpdated: new Date().toISOString(),
  });
}
