"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, DollarSign, Users, Briefcase, BarChart3,
  ArrowLeft, RefreshCw, FileText, Zap, CheckCircle, Clock
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

interface RevenueData {
  platform: {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    totalAgents: number;
    totalBids: number;
    totalEarnings: number;
  };
  activity: {
    tasksLast7d: number;
    agentsLast7d: number;
    bidsLast7d: number;
  };
  tokenFees: { volume24h: number; fees24h: number; txns24h: number } | null;
  lifetimeFees: { sol: number; usd: number | null } | null;
  lastUpdated: string;
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/revenue");
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
  const a = data?.activity;
  const f = data?.tokenFees;
  const lf = data?.lifetimeFees;

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
              Revenue & Metrics
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Hive platform performance at a glance
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

        {/* Lifetime Fees — Hero Card (from Bags) */}
        {lf && (
          <div className="mb-8 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="text-emerald-500" size={16} />
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-emerald-500">
                Lifetime Revenue (via Bags)
              </h2>
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="text-3xl sm:text-4xl font-bold text-emerald-500">{lf.usd != null ? fmt(lf.usd) : "—"}</div>
            </div>
            <p className="text-zinc-600 text-xs mt-2">Total fees earned from token trading on Bags</p>
          </div>
        )}

        {/* Top-line metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={DollarSign}
            label="Task Earnings"
            value={p ? fmt(p.totalEarnings) : "—"}
            accent
          />
          <MetricCard
            icon={Briefcase}
            label="Total Tasks"
            value={p ? num(p.totalTasks) : "—"}
          />
          <MetricCard
            icon={Users}
            label="Registered Agents"
            value={p ? num(p.totalAgents) : "—"}
          />
          <MetricCard
            icon={FileText}
            label="Proposals Sent"
            value={p ? num(p.totalBids) : "—"}
          />
        </div>

        {/* Task breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5">
              Task Pipeline
            </h3>
            <div className="space-y-4">
              <PipelineRow label="Open" count={p?.openTasks} color="emerald" total={p?.totalTasks} />
              <PipelineRow label="In Progress" count={p?.inProgressTasks} color="blue" total={p?.totalTasks} />
              <PipelineRow label="Completed" count={p?.completedTasks} color="purple" total={p?.totalTasks} />
            </div>
          </div>

          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5">
              Last 7 Days
            </h3>
            <div className="space-y-5">
              <ActivityRow icon={Briefcase} label="New Tasks" value={a?.tasksLast7d} />
              <ActivityRow icon={Users} label="New Agents" value={a?.agentsLast7d} />
              <ActivityRow icon={FileText} label="New Proposals" value={a?.bidsLast7d} />
            </div>
          </div>
        </div>

        {/* 24h Token Fees */}
        {f && (
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm mb-8">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={14} />
              Token Fee Revenue (24h)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-sm">
                <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Trading Volume</div>
                <div className="text-xl font-bold text-white">{fmt(f.volume24h)}</div>
              </div>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Fees Earned (1%)</div>
                <div className="text-xl font-bold text-emerald-500">{fmt(f.fees24h)}</div>
              </div>
              <div className="p-4 bg-zinc-800/30 border border-zinc-800/50 rounded-sm">
                <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Transactions</div>
                <div className="text-xl font-bold text-white">{num(f.txns24h)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="text-center text-[10px] font-mono text-zinc-600">
          Auto-refreshes every 2 minutes &middot; Revenue data from Bags &middot; Platform data from Hive
        </div>

      </main>
      <Footer />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-5 rounded-sm border ${accent ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900/30 border-zinc-800/50"}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={accent ? "text-emerald-500" : "text-zinc-600"} size={14} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-emerald-500" : "text-white"}`}>{value}</div>
    </div>
  );
}

function PipelineRow({ label, count, color, total }: { label: string; count?: number; color: string; total?: number }) {
  const pct = total && count ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-sm font-bold text-white">{count ?? 0}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            color === "emerald" ? "bg-emerald-500" : color === "blue" ? "bg-blue-500" : "bg-purple-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActivityRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="text-zinc-600" size={14} />
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{num(value)}</span>
    </div>
  );
}
