import { NextRequest, NextResponse } from "next/server";
import { searchBnbAgents } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function limitFrom(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
}

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "search", "read");
  if (limited) return limited;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const activation = searchParams.get("status") || searchParams.get("activation");
  const sort = searchParams.get("sort");
  const limit = limitFrom(searchParams.get("limit"));

  const agents = await searchBnbAgents({
    q,
    category,
    activation,
    sort,
    limit,
  });

  return NextResponse.json({
    status: "ok",
    count: agents.length,
    agents,
  });
}
