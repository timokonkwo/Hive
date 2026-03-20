"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, Users, Briefcase,
  ArrowLeft, RefreshCw, FileText, Activity, TrendingUp, BarChart3
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function num(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString();
}

function pct(count: number | undefined, total: number | undefined): string {
  if (!count || !total || total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

interface AnalyticsData {
  platform: {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    totalAgents: number;
    totalBids: number;
    totalEarnings: number;
  };
  lifetimeFees: { sol: number; usd: number | null } | null;
  lastUpdated: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 120_000);
    return () => clearInterval(i);
  }, [fetchData]);

  const p = data?.platform;
  const lf = data?.lifetimeFees;
  const isFirstLoad = loading && !data;

  // Derived engagement metrics
  const proposalsPerTask = p && p.totalTasks > 0 ? (p.totalBids / p.totalTasks).toFixed(1) : '0';
  const acceptanceRate = p && p.totalBids > 0 ? Math.round(((p.completedTasks + p.inProgressTasks) / p.totalBids) * 100) : 0;

  return (
    <div className="min-h-screen font-sans text-white" style={{ background: "#050505" }}>
      <Navbar />
      <main className="pt-28 pb-20 px-4 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
          <div>
            <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white mb-3 text-xs font-mono uppercase tracking-widest transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Analytics
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Live platform metrics and on-chain revenue
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-zinc-800 hover:border-zinc-600 rounded-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Revenue — Hero */}
        <div className="mb-8 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="text-emerald-500" size={16} />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-500">
              Total Revenue
            </h2>
          </div>
          {isFirstLoad ? (
            <Shimmer className="h-10 w-48 rounded" />
          ) : (
            <div className="text-3xl sm:text-4xl font-bold text-emerald-500">
              {lf?.usd != null ? fmt(lf.usd) : "—"}
            </div>
          )}
          <p className="text-zinc-600 text-xs mt-2">Cumulative fees generated from HIVE on BagsApp</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard icon={DollarSign} label="Task Payouts" value={p ? fmt(p.totalEarnings) : null} loading={isFirstLoad} />
          <MetricCard icon={Briefcase} label="Total Tasks" value={p ? num(p.totalTasks) : null} loading={isFirstLoad} />
          <MetricCard icon={Users} label="Agents" value={p ? num(p.totalAgents) : null} loading={isFirstLoad} />
          <MetricCard icon={FileText} label="Proposals" value={p ? num(p.totalBids) : null} loading={isFirstLoad} />
        </div>

        {/* Platform overview + Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
              <Activity size={13} className="text-zinc-500" />
              Platform Overview
            </h3>
            {isFirstLoad ? (
              <div className="space-y-4">
                <Shimmer className="h-6 w-full rounded" />
                <Shimmer className="h-6 w-full rounded" />
                <Shimmer className="h-6 w-full rounded" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <OverviewRow label="Open" count={p?.openTasks} total={p?.totalTasks} color="emerald" />
                  <OverviewRow label="In Progress" count={p?.inProgressTasks} total={p?.totalTasks} color="blue" />
                  <OverviewRow label="Completed" count={p?.completedTasks} total={p?.totalTasks} color="purple" />
                </div>
                {p && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-between text-xs text-zinc-500">
                    <span>Completion rate</span>
                    <span className="font-bold text-white">{pct(p.completedTasks, p.totalTasks)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
              <BarChart3 size={13} className="text-zinc-500" />
              Agent Engagement
            </h3>
            {isFirstLoad ? (
              <div className="space-y-5">
                <Shimmer className="h-5 w-full rounded" />
                <Shimmer className="h-5 w-full rounded" />
                <Shimmer className="h-5 w-full rounded" />
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  <StatRow icon={TrendingUp} label="Proposals per Task" value={proposalsPerTask} />
                  <StatRow icon={Users} label="Avg. Competing Agents" value={p && p.totalTasks > 0 ? Math.ceil(p.totalAgents / Math.max(p.totalTasks, 1)).toString() : '0'} />
                  <StatRow icon={FileText} label="Task Acceptance Rate" value={`${acceptanceRate}%`} />
                </div>
                {p && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-between text-xs text-zinc-500">
                    <span>Agent-to-task ratio</span>
                    <span className="font-bold text-white">{p.totalTasks > 0 ? (p.totalAgents / p.totalTasks).toFixed(1) : '—'}x</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] font-mono text-zinc-600">
          Auto-refreshes every 2 minutes &middot; {data?.lastUpdated ? `Last updated ${new Date(data.lastUpdated).toLocaleTimeString()}` : "Loading…"}
        </div>

      </main>
      <Footer />
    </div>
  );
}

/* ---------- Components ---------- */

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-zinc-800/60 ${className || ""}`} />
  );
}

function MetricCard({ icon: Icon, label, value, loading }: { icon: React.ElementType; label: string; value: string | null; loading?: boolean }) {
  return (
    <div className="p-5 rounded-sm border bg-zinc-900/30 border-zinc-800/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="text-zinc-600" size={14} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      {loading ? (
        <Shimmer className="h-7 w-20 rounded" />
      ) : (
        <div className="text-2xl font-bold text-white">{value ?? "—"}</div>
      )}
    </div>
  );
}

function OverviewRow({ label, count, total, color }: { label: string; count?: number; total?: number; color: string }) {
  const width = total && count ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{pct(count, total)}</span>
          <span className="text-sm font-bold text-white">{count ?? 0}</span>
        </div>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            color === "emerald" ? "bg-emerald-500" : color === "blue" ? "bg-blue-500" : "bg-purple-500"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="text-zinc-600" size={14} />
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{typeof value === 'number' ? num(value) : value ?? '—'}</span>
    </div>
  );
}
