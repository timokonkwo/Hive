import { NextRequest, NextResponse } from "next/server";
import { getBnbAgentNetworkStats, getBnbCategories, listBnbAgentsPage } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "agents", "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 24);
  const page = Number(searchParams.get("page") || 1);
  const [result, networkStats] = await Promise.all([
    listBnbAgentsPage({
      category: searchParams.get("category"),
      q: searchParams.get("q"),
      activation: searchParams.get("status") || searchParams.get("activation"),
      execution: searchParams.get("execution"),
      sort: searchParams.get("sort"),
      limit: Number.isFinite(limit) ? limit : 24,
      page: Number.isFinite(page) ? page : 1,
    }),
    getBnbAgentNetworkStats(),
  ]);
  const sources = Array.from(new Set(result.agents.map((agent) => agent.sourceFreshness.source)));

  return NextResponse.json({
    agents: result.agents,
    categories: getBnbCategories(),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    },
    networkStats,
    source: sources.length > 0 ? sources.join("+") : "none",
    lastUpdated: new Date().toISOString(),
  });
}
