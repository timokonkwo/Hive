"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bnbAgentKey, bnbCanHireAgent } from "@/lib/bnb/display";
import type { BnbAgentProfile } from "@/lib/bnb/types";

export type AgentFeedMode = "available" | "profiles" | "done";

type AgentFeedQuery = {
  q: string;
  category: string;
  status: string;
  integration: string;
  sort: string;
};

type AgentFeedOptions = {
  initialAgents: BnbAgentProfile[];
  initialMode: AgentFeedMode;
  initialPage: number;
  initialTotal: number;
  query: AgentFeedQuery;
};

type AgentFeedResponse = {
  agents?: BnbAgentProfile[];
  pagination?: {
    page?: number;
    total?: number;
    hasMore?: boolean;
  };
};

export function useAgentDirectoryFeed({
  initialAgents,
  initialMode,
  initialPage,
  initialTotal,
  query,
}: AgentFeedOptions) {
  const [agents, setAgents] = useState(initialAgents);
  const [mode, setMode] = useState<AgentFeedMode>(initialMode);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    setAgents(initialAgents);
    setMode(initialMode);
    setPage(initialPage);
    setTotal(initialTotal);
    setLoading(false);
    setError("");
    loadingRef.current = false;
  }, [initialAgents, initialMode, initialPage, initialTotal, queryKey]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || mode === "done") return;
    loadingRef.current = true;
    setLoading(true);
    setError("");

    try {
      let nextPage = page;
      let hasMore = true;
      let additions: BnbAgentProfile[] = [];
      let responseTotal = total;
      const maxEmptyPages = mode === "profiles" ? 4 : 1;

      for (let attempt = 0; attempt < maxEmptyPages && hasMore && additions.length === 0; attempt += 1) {
        nextPage += 1;
        const params = new URLSearchParams({ page: String(nextPage), limit: "24" });
        if (query.q.trim()) params.set("q", query.q.trim());
        if (query.category) params.set("category", query.category);
        if (query.integration) params.set("integration", query.integration);
        if (query.sort === "active") params.set("sort", "freshness");
        if (query.sort === "reviewed") params.set("sort", "reviews");
        if (mode === "available") params.set("execution", "hireable");

        const response = await fetch(`/api/bnb/agents?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Agents could not be loaded");
        const payload = await response.json() as AgentFeedResponse;
        const received = Array.isArray(payload.agents) ? payload.agents : [];
        additions = mode === "available"
          ? received.filter(bnbCanHireAgent)
          : received.filter((agent) => !bnbCanHireAgent(agent));
        hasMore = Boolean(payload.pagination?.hasMore);
        responseTotal = Number.isFinite(payload.pagination?.total)
          ? Math.max(Number(payload.pagination?.total), 0)
          : responseTotal;
      }

      setAgents((current) => mergeUniqueAgents(current, additions));
      setPage(nextPage);
      if (mode === "profiles") setTotal(responseTotal);

      if (!hasMore) {
        if (mode === "available" && query.status === "all") {
          setMode("profiles");
          setPage(0);
        } else {
          setMode("done");
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Agents could not be loaded");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [mode, page, query.category, query.integration, query.q, query.sort, query.status, total]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || mode === "done" || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "320px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, loadMore, mode]);

  return {
    agents,
    total,
    loading,
    error,
    done: mode === "done",
    loadMore,
    sentinelRef,
  };
}

function mergeUniqueAgents(current: BnbAgentProfile[], additions: BnbAgentProfile[]) {
  const agents = new Map(current.map((agent) => [bnbAgentKey(agent), agent]));
  for (const agent of additions) agents.set(bnbAgentKey(agent), agent);
  return Array.from(agents.values());
}
