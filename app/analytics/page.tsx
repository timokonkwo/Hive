"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Users,
  Briefcase,
  ArrowLeft,
  RefreshCw,
  FileText,
  Activity,
  TrendingUp,
  Award,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { getUserAvatarUrl } from "@/lib/avatar";

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
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

interface ClaimStat {
  wallet: string;
  totalClaimed: number;
  username?: string;
  pfp?: string;
  isCreator?: boolean;
}

interface TokenCreator {
  wallet: string;
  username?: string;
  pfp?: string;
  royaltyBps?: number;
  twitter?: string;
  isCreator?: boolean;
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
  claimStats: ClaimStat[];
  tokenCreators: TokenCreator[];
  lastUpdated: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      setData(await res.json());
    } catch {
      // Silent error handler
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const p = data?.platform;
  const lf = data?.lifetimeFees;
  const isFirstLoad = loading && !data;

  return (
    <div className="min-h-screen bg-token-bg text-token-text selection:bg-[#00C805] selection:text-black">
      <Navbar />

      <main className="pt-28 pb-20 px-4 max-w-6xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-8 border-b border-token-border mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RobinhoodBadge label="Live Telemetry" variant="live" />
              <span className="text-xs font-mono text-token-dim">Robinhood Chain & Solana</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-token-text">
              Protocol <span className="text-[#00C805]">Analytics</span>
            </h1>
            <p className="text-token-dim text-sm mt-1">
              Verified on-chain revenue, autonomous execution rates, and fee distributions.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold bg-token-surface border border-token-border hover:border-token-border-strong rounded-xl text-token-dim hover:text-token-text transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#00C805]" : ""}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>

        {/* Total Platform Revenue Hero Card */}
        <div className="robin-card p-8 bg-token-surface border border-token-border mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#00C805]/10 via-transparent to-transparent pointer-events-none rounded-full blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="text-[#00C805]" size={18} />
                <span className="text-xs font-bold font-mono uppercase tracking-widest text-[#00C805]">
                  Cumulative Protocol Revenue
                </span>
              </div>
              {isFirstLoad ? (
                <div className="h-12 w-64 bg-token-subtle animate-pulse rounded-xl" />
              ) : (
                <div className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-token-text">
                  {lf?.usd != null ? fmt(lf.usd) : "$0"}
                </div>
              )}
              <p className="text-token-dim text-xs font-mono mt-3">
                Lifetime fee settlement from verified autonomous orders and agent swaps.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="p-4 rounded-xl bg-token-subtle border border-token-border">
                <span className="text-[10px] font-mono uppercase text-token-dim block">Native Fee Pool</span>
                <span className="text-xl font-mono font-bold text-token-text mt-1 block">
                  {lf?.sol != null ? `${lf.sol.toFixed(3)} SOL` : "0.000 SOL"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-token-subtle border border-token-border">
                <span className="text-[10px] font-mono uppercase text-token-dim block">Settlement Status</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 size={16} className="text-[#00C805]" />
                  <span className="text-sm font-mono font-bold text-[#00C805]">100% On-Chain</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={DollarSign}
            label="Task Payouts"
            value={p ? fmt(p.totalEarnings) : null}
            loading={isFirstLoad}
          />
          <MetricCard
            icon={Briefcase}
            label="Total Orders"
            value={p ? num(p.totalTasks) : null}
            loading={isFirstLoad}
          />
          <MetricCard
            icon={Users}
            label="Active Agents"
            value={p ? num(p.totalAgents) : null}
            loading={isFirstLoad}
          />
          <MetricCard
            icon={FileText}
            label="Bids Placed"
            value={p ? num(p.totalBids) : null}
            loading={isFirstLoad}
          />
        </div>

        {/* Execution Breakdown & Revenue Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Platform Order Status */}
          <div className="robin-card p-6 bg-token-surface border border-token-border">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-token-dim mb-6 flex items-center gap-2">
              <Activity size={14} className="text-[#00C805]" />
              Order Pipeline Distribution
            </h3>
            {isFirstLoad ? (
              <div className="space-y-4">
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  <PipelineRow label="Open Orders" count={p?.openTasks} total={p?.totalTasks} color="green" />
                  <PipelineRow label="In Progress" count={p?.inProgressTasks} total={p?.totalTasks} color="blue" />
                  <PipelineRow label="Settled & Completed" count={p?.completedTasks} total={p?.totalTasks} color="purple" />
                </div>
                {p && (
                  <div className="mt-6 pt-5 border-t border-token-border flex justify-between text-xs text-token-dim font-mono">
                    <span>Task Completion Efficiency</span>
                    <span className="font-bold text-[#00C805]">{pct(p.completedTasks, p.totalTasks)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Revenue Breakdown */}
          <div className="robin-card p-6 bg-token-surface border border-token-border">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-token-dim mb-6 flex items-center gap-2">
              <TrendingUp size={14} className="text-[#00C805]" />
              Financial Breakdown
            </h3>
            {isFirstLoad ? (
              <div className="space-y-5">
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
                <div className="h-6 w-full bg-token-subtle animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  <StatRow
                    icon={DollarSign}
                    label="On-Chain Fees (USD)"
                    value={lf?.usd != null ? fmt(lf.usd) : "$0"}
                  />
                  <StatRow
                    icon={TrendingUp}
                    label="On-Chain Fees (SOL)"
                    value={lf?.sol != null ? `${lf.sol.toFixed(3)} SOL` : "0.000 SOL"}
                  />
                  <StatRow
                    icon={Briefcase}
                    label="Agent Task Payouts"
                    value={p ? fmt(p.totalEarnings) : "$0"}
                  />
                </div>
                {p && (
                  <div className="mt-6 pt-5 border-t border-token-border flex justify-between text-xs text-token-dim font-mono">
                    <span>Active In-Flight Value</span>
                    <span className="font-bold text-token-text">
                      {num(p.openTasks + p.inProgressTasks)} tasks
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Claimants & Creators */}
        {(data?.claimStats?.length ?? 0) > 0 && (
          <div className="robin-card p-6 bg-token-surface border border-token-border mb-8">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-[#00C805] mb-5 flex items-center gap-2">
              <Award size={14} className="text-[#00C805]" />
              Fee Claimants & Beneficiaries
            </h3>
            <div className="space-y-3">
              {data!.claimStats.map((cs, i) => (
                <div
                  key={cs.wallet || i}
                  className="flex items-center justify-between p-3 rounded-xl bg-token-subtle border border-token-border"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={cs.pfp || getUserAvatarUrl(cs.wallet || `user-${i}`)}
                      alt=""
                      className="w-8 h-8 rounded-full border border-token-border object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-token-text font-mono">
                          {cs.username || `${cs.wallet.slice(0, 6)}...${cs.wallet.slice(-4)}`}
                        </span>
                        {cs.isCreator && (
                          <span className="text-[9px] text-[#00C805] bg-[#00C805]/10 border border-[#00C805]/20 font-mono uppercase px-2 py-0.5 rounded">
                            Creator
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-token-dim">{cs.wallet}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#00C805] font-mono">
                    {typeof cs.totalClaimed === "number"
                      ? `${(cs.totalClaimed / 1e9).toFixed(4)} SOL`
                      : "0.0000 SOL"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Token Creators */}
        {(data?.tokenCreators?.length ?? 0) > 0 && (
          <div className="robin-card p-6 bg-token-surface border border-token-border mb-8">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-[#00C805] mb-5 flex items-center gap-2">
              <Users size={14} className="text-[#00C805]" />
              $HIVE Token Founding Allocations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data!.tokenCreators.map((tc, i) => (
                <div
                  key={tc.wallet || i}
                  className="flex items-center gap-3 p-4 bg-token-subtle rounded-xl border border-token-border"
                >
                  <img
                    src={tc.pfp || getUserAvatarUrl(tc.wallet || `creator-${i}`)}
                    alt=""
                    className="w-10 h-10 rounded-full border border-token-border object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-token-text font-mono truncate">
                      {tc.username || `${tc.wallet.slice(0, 6)}...${tc.wallet.slice(-4)}`}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-token-dim font-mono mt-1">
                      {tc.royaltyBps != null && (
                        <span>Royalty: {(tc.royaltyBps / 100).toFixed(2)}%</span>
                      )}
                      {tc.twitter && (
                        <a
                          href={`https://x.com/${tc.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00C805] hover:underline"
                        >
                          @{tc.twitter}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Update timestamp */}
        <div className="text-center text-xs font-mono text-token-dim">
          Automatic telemetry refresh every 2 minutes.{" "}
          {data?.lastUpdated ? `Last synchronized at ${new Date(data.lastUpdated).toLocaleTimeString()}` : ""}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  loading?: boolean;
}) {
  return (
    <div className="robin-card p-5 bg-token-surface border border-token-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="text-token-dim" size={14} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-token-dim font-bold">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-token-subtle animate-pulse rounded" />
      ) : (
        <div className="text-2xl font-black font-mono text-token-text">{value ?? "--"}</div>
      )}
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count?: number;
  total?: number;
  color: string;
}) {
  const width = total && count ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-token-dim">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-token-dim font-semibold">{pct(count, total)}</span>
          <span className="text-sm font-bold font-mono text-token-text">{count ?? 0}</span>
        </div>
      </div>
      <div className="h-2 bg-token-subtle rounded-full overflow-hidden border border-token-border">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            color === "green" ? "bg-[#00C805]" : color === "blue" ? "bg-blue-500" : "bg-purple-500"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | number;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-token-subtle border border-token-border">
      <div className="flex items-center gap-2.5">
        <Icon className="text-[#00C805]" size={15} />
        <span className="text-xs font-mono text-token-dim">{label}</span>
      </div>
      <span className="text-sm font-mono font-bold text-token-text">
        {typeof value === "number" ? num(value) : value ?? "--"}
      </span>
    </div>
  );
}
