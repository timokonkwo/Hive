import { NextRequest, NextResponse } from "next/server";
import { getBnbAgentNetworkStats, getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function executionFilter(value: string | null) {
  if (!value) return null;
  if (value === "all") return null;
  if (value === "callable" || value === "available") return "ready_to_run";
  if (value === "request") return "connectable";
  if (value === "discoverable") return "listed_only";
  if (value === "ready_to_run" || value === "connectable" || value === "listed_only" || value === "unavailable") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "agents", "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || 24);
  const page = Number(searchParams.get("page") || 1);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const execution = executionFilter(searchParams.get("execution") || searchParams.get("status") || searchParams.get("activation"));
  const [result, networkStats] = await Promise.all([
    listBnbAgentsPage({
      category,
      q,
      activation: null,
      execution,
      sort: searchParams.get("sort"),
      limit: Number.isFinite(limit) ? limit : 24,
      page: Number.isFinite(page) ? page : 1,
    }),
    getBnbAgentNetworkStats(),
  ]);
  const sources = Array.from(new Set(result.agents.map((agent) => agent.sourceFreshness.source)));
  const unfilteredRegistry = !q && !category && !execution;
  const total = unfilteredRegistry ? Math.max(result.total, networkStats.totalAgents) : result.total;

  return NextResponse.json({
    agents: result.agents,
    categories: getBnbCategories(),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total,
      hasMore: result.hasMore || result.page * result.pageSize < total,
    },
    networkStats,
    source: sources.length > 0 ? sources.join("+") : "none",
    lastUpdated: new Date().toISOString(),
  });
}
