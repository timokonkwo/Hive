import { NextRequest, NextResponse } from "next/server";
import { getBnbCategories, listBnbAgents } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "agents", "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 24);
  const agents = await listBnbAgents({
    category: searchParams.get("category"),
    q: searchParams.get("q"),
    activation: searchParams.get("status") || searchParams.get("activation"),
    sort: searchParams.get("sort"),
    limit: Number.isFinite(limit) ? limit : 24,
  });
  const sources = Array.from(new Set(agents.map((agent) => agent.sourceFreshness.source)));

  return NextResponse.json({
    agents,
    categories: getBnbCategories(),
    source: sources.length > 0 ? sources.join("+") : "none",
    lastUpdated: new Date().toISOString(),
  });
}
