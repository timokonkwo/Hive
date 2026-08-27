import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hydrateBnbAgentCacheQueue, refreshBnbAgentDiscoveryCache } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export const dynamic = "force-dynamic";

type CacheCronMode = "refresh" | "hydrate" | "all";

export async function GET(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "cron:bnb-agent-cache", "write");
  if (limited) return limited;

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = cacheCronMode(url.searchParams.get("mode"));
  const startedAt = new Date().toISOString();
  const results: {
    refresh?: Awaited<ReturnType<typeof refreshBnbAgentDiscoveryCache>>;
    hydrate?: Awaited<ReturnType<typeof hydrateBnbAgentCacheQueue>>;
  } = {};

  if (mode === "refresh" || mode === "all") {
    results.refresh = await refreshBnbAgentDiscoveryCache({
      pages: boundedInteger(url.searchParams.get("pages"), 2, 1, 10),
      pageSize: boundedInteger(url.searchParams.get("pageSize"), 50, 1, 100),
    });
  }

  if (mode === "hydrate" || mode === "all") {
    const batchParam = url.searchParams.get("batch");
    results.hydrate = await hydrateBnbAgentCacheQueue(
      batchParam ? boundedInteger(batchParam, 6, 1, 24) : undefined,
    );
  }

  return NextResponse.json({
    cron: "bnb-agent-cache",
    mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...results,
  });
}

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  return Boolean(cronSecret && authHeader && safeEqual(authHeader, `Bearer ${cronSecret}`));
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function cacheCronMode(value: string | null): CacheCronMode {
  if (value === "refresh" || value === "hydrate" || value === "all") return value;
  return "all";
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
