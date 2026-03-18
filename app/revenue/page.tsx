"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  TrendingUp, TrendingDown, DollarSign, Activity, BarChart3,
  ExternalLink, RefreshCw, ArrowLeft, Droplets, Users,
  PieChart, Zap, Clock, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const HIVE_TOKEN_CA = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "$0.00";
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0.0%";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

interface RevenueData {
  token: { name: string; symbol: string; address: string; dexScreenerUrl: string; bagsUrl: string };
  price: { usd: number; change1h: number; change6h: number; change24h: number };
  market: { marketCap: number; liquidity: number; volume1h: number; volume6h: number; volume24h: number };
  txns24h: { buys: number; sells: number };
  fees: { feeRate: string; totalLifetime: number | null; estimated24h: number; estimated6h: number; estimated1h: number };
  feeDistribution: { treasury: string; agentPool: string; creatorPool: string; referrals: string };
  source: { dexScreener: boolean; bags: boolean };
  lastUpdated: string;
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/revenue");
      if (!res.ok) throw new Error("Failed to fetch data");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchData]);

  const up24h = (data?.price.change24h || 0) >= 0;

  return (
    <div className="min-h-screen font-sans text-white" style={{ background: "#050505" }}>
      <Navbar />

      <main className="pt-28 pb-20 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white mb-3 text-xs font-mono uppercase tracking-widest transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Back
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">
              HIVE <span className="text-emerald-500">Revenue</span> Dashboard
            </h1>
            <p className="text-zinc-500 text-xs font-mono mt-1 uppercase tracking-wider">
              Public token fee tracking &middot; Updated every 60s
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-zinc-800 hover:border-emerald-500/30 rounded-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <span className="text-zinc-600 text-[10px] font-mono">
              {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Token Identity Bar */}
        <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-sm flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center">
              <Zap className="text-emerald-500" size={16} />
            </div>
            <div>
              <span className="text-white font-bold font-mono text-sm">{data?.token.symbol || "HIVE"}</span>
              <span className="text-zinc-600 text-xs ml-2 font-mono">{data?.token.name || "Hive"}</span>
            </div>
          </div>
          <code className="text-zinc-500 text-[10px] font-mono bg-zinc-900 px-2 py-1 rounded-sm select-all break-all">
            {HIVE_TOKEN_CA}
          </code>
          <div className="flex items-center gap-2 ml-auto">
            {data?.token.dexScreenerUrl && (
              <a href={data.token.dexScreenerUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-emerald-500 text-[10px] font-mono uppercase flex items-center gap-1 transition-colors">
                DexScreener <ExternalLink size={10} />
              </a>
            )}
            <a href={data?.token.bagsUrl || `https://bags.fm/token/${HIVE_TOKEN_CA}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-emerald-500 text-[10px] font-mono uppercase flex items-center gap-1 transition-colors">
              Bags <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* Main Price Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-1 p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Price</div>
            <div className="text-3xl font-bold font-mono text-white mb-2">
              {data ? fmtPrice(data.price.usd) : "---"}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "1H", val: data?.price.change1h },
                { label: "6H", val: data?.price.change6h },
                { label: "24H", val: data?.price.change24h },
              ].map(({ label, val }) => {
                const isUp = (val || 0) >= 0;
                return (
                  <div key={label} className="flex items-center gap-1">
                    <span className="text-zinc-600 text-[10px] font-mono">{label}</span>
                    <span className={`text-xs font-mono font-bold ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                      {val != null ? fmtPct(val) : "—"}
                    </span>
                    {isUp ? <ArrowUpRight size={10} className="text-emerald-500" /> : <ArrowDownRight size={10} className="text-red-500" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market Stats */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={BarChart3} label="Market Cap" value={data ? fmt(data.market.marketCap) : "---"} />
            <MetricCard icon={Droplets} label="Liquidity" value={data ? fmt(data.market.liquidity) : "---"} />
            <MetricCard icon={Activity} label="24H Volume" value={data ? fmt(data.market.volume24h) : "---"} sub={data ? `${((data.txns24h.buys || 0) + (data.txns24h.sells || 0)).toLocaleString()} txns` : undefined} />
            <MetricCard icon={Users} label="24H Txns" value={data ? `${(data.txns24h.buys + data.txns24h.sells).toLocaleString()}` : "---"} sub={data ? `${data.txns24h.buys} buys / ${data.txns24h.sells} sells` : undefined} />
          </div>
        </div>

        {/* Fee Revenue Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/50">
            <DollarSign className="text-emerald-500" size={16} />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">
              Fee Revenue <span className="text-emerald-500">(1% of volume)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <FeeCard
              label="Last 1 Hour"
              value={data ? fmt(data.fees.estimated1h) : "---"}
              icon={Clock}
              pulse
            />
            <FeeCard
              label="Last 6 Hours"
              value={data ? fmt(data.fees.estimated6h) : "---"}
              icon={TrendingUp}
            />
            <FeeCard
              label="Last 24 Hours"
              value={data ? fmt(data.fees.estimated24h) : "---"}
              icon={BarChart3}
              highlight
            />
            <FeeCard
              label="All-Time Fees"
              value={data?.fees.totalLifetime != null ? fmt(data.fees.totalLifetime) : "Coming Soon"}
              icon={DollarSign}
              sub={data?.fees.totalLifetime == null ? "Via Bags API" : undefined}
            />
          </div>
        </div>

        {/* Fee Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <div className="flex items-center gap-2 mb-5">
              <PieChart className="text-emerald-500" size={16} />
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">
                Fee Distribution
              </h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Protocol Treasury", pct: 40, color: "emerald" },
                { label: "Agent Pool", pct: 30, color: "blue" },
                { label: "Task Creators", pct: 20, color: "purple" },
                { label: "Community Referrals", pct: 10, color: "amber" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-zinc-400">{label}</span>
                    <span className="text-xs font-mono font-bold text-white">{pct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        color === "emerald" ? "bg-emerald-500" :
                        color === "blue" ? "bg-blue-500" :
                        color === "purple" ? "bg-purple-500" :
                        "bg-amber-500"
                      }`}
                      style={{ width: loading ? "0%" : `${pct}%` }}
                    />
                  </div>
                  {data && (
                    <div className="text-[10px] font-mono text-zinc-600 mt-1">
                      {fmt(data.fees.estimated24h * (pct / 100))} / 24h
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Volume Breakdown */}
          <div className="p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="text-emerald-500" size={16} />
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">
                Volume Breakdown
              </h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "1 Hour", volume: data?.market.volume1h, fee: data?.fees.estimated1h },
                { label: "6 Hours", volume: data?.market.volume6h, fee: data?.fees.estimated6h },
                { label: "24 Hours", volume: data?.market.volume24h, fee: data?.fees.estimated24h },
              ].map(({ label, volume, fee }) => (
                <div key={label} className="p-3 bg-zinc-800/30 border border-zinc-800/50 rounded-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[9px] font-mono text-zinc-600 uppercase">Volume</div>
                      <div className="text-lg font-bold font-mono text-white">{volume != null ? fmt(volume) : "---"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono text-zinc-600 uppercase">Fees (1%)</div>
                      <div className="text-lg font-bold font-mono text-emerald-500">{fee != null ? fmt(fee) : "---"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Source Info */}
        <div className="text-center text-[10px] font-mono text-zinc-600 space-x-4">
          <span>Data: DexScreener{data?.source.bags ? " + Bags" : ""}</span>
          <span>&middot;</span>
          <span>Token: Solana SPL</span>
          <span>&middot;</span>
          <span>Fee Model: 1% of trading volume via Bags.fm</span>
          <span>&middot;</span>
          <span>Auto-refreshes every 60s</span>
        </div>

      </main>
      <Footer />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="text-zinc-600" size={12} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-white">{value}</div>
      {sub && <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function FeeCard({ icon: Icon, label, value, sub, highlight, pulse }: { icon: React.ElementType; label: string; value: string; sub?: string; highlight?: boolean; pulse?: boolean }) {
  return (
    <div className={`p-5 rounded-sm border transition-all ${
      highlight 
        ? "bg-emerald-500/5 border-emerald-500/20" 
        : "bg-zinc-900/30 border-zinc-800/50"
    }`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={highlight ? "text-emerald-500" : "text-zinc-600"} size={12} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1"></span>}
      </div>
      <div className={`text-xl font-bold font-mono ${highlight ? "text-emerald-500" : "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}
