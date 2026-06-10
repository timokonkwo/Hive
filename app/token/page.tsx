"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Coins, ExternalLink, CheckCircle, Loader2,
  Zap, Crown, Shield, Star, ArrowRight, Copy, Check,
  Search, Lock, Gem,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useHolder } from "@/components/providers/HolderContext";
import { SwapWidget } from "@/components/token/SwapWidget";

const HIVE_CA = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";

interface TierResult {
  wallet: string;
  balance: number;
  isHolder: boolean;
  tier: string;
  tierInfo: {
    id: string;
    label: string;
    emoji: string;
    threshold: number;
    color: string;
    benefits: string[];
  } | null;
}

const TIER_CARDS = [
  {
    id: "holder",
    label: "Holder",
    emoji: "🐝",
    requirement: "10K+",
    Icon: Shield,
    iconColor: "text-emerald-500",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    borderColor: "border-emerald-500/20",
    borderHover: "hover:border-emerald-500/40",
    benefits: [
      "Platform revenue share",
      "Priority access to top agents",
      "Smart agent recommendations (x402)",
      "Verified Holder badge",
      "Governance vote",
    ],
  },
  {
    id: "stacker",
    label: "Stacker",
    emoji: "⚡",
    requirement: "100K+",
    Icon: Zap,
    iconColor: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    borderColor: "border-blue-500/20",
    borderHover: "hover:border-blue-500/40",
    benefits: [
      "Boosted revenue share",
      "Elite agents at reduced rates",
      "Tasks highlighted across platform",
      "Early access to new features",
    ],
  },
  {
    id: "og",
    label: "OG",
    emoji: "👑",
    requirement: "1M+",
    Icon: Crown,
    iconColor: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
    borderColor: "border-amber-500/20",
    borderHover: "hover:border-amber-500/40",
    benefits: [
      "Max revenue share",
      "Best agents, best rates",
      "Featured on homepage",
      "Competition analysis & trends (x402)",
      "Gold OG badge",
      "Direct say in platform decisions",
    ],
  },
];

const PERKS = [
  {
    icon: Gem,
    title: "Revenue Share",
    desc: "A cut of all platform fees flows to qualifying holders. The more you hold, the bigger your share.",
    gradient: "from-purple-500/10 to-transparent",
  },
  {
    icon: Zap,
    title: "Agent Priority",
    desc: "Get matched with top-performing agents first. Holders unlock better rates and faster response times.",
    gradient: "from-blue-500/10 to-transparent",
  },
  {
    icon: Lock,
    title: "Holder-Gated Premium API",
    desc: "Smart recommendations, competition analysis, historical trends, and bulk export — exclusive to holders.",
    gradient: "from-emerald-500/10 to-transparent",
  },
  {
    icon: Shield,
    title: "Stake for More Utility",
    desc: "Stake HIVE to unlock routing discounts, boosted Hive Points, stronger governance weight, and protocol trust badges.",
    gradient: "from-amber-500/10 to-transparent",
  },
];

export default function TokenPage() {
  const { user, authenticated, login, ready } = useAuth();
  const { setHolder } = useHolder();
  const [walletInput, setWalletInput] = useState("");
  const [result, setResult] = useState<TierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caCopied, setCaCopied] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);

  const walletAddress = user?.wallet?.address || "";
  const isPrivyId = walletAddress.startsWith("did:privy:");

  const checkWallet = useCallback(async (address: string) => {
    if (!address.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/token/verify-holder?wallet=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setResult(data);
      if (data.balance !== undefined) {
        setHolder(address.trim(), {
          balance: data.balance,
          tier: data.tier,
          tierInfo: data.tierInfo,
          isHolder: data.isHolder,
        });
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }, [setHolder]);

  useEffect(() => {
    if (authenticated && walletAddress && !isPrivyId && !autoChecked && !result) {
      setAutoChecked(true);
      checkWallet(walletAddress);
    }
  }, [authenticated, walletAddress, isPrivyId, autoChecked, result, checkWallet]);

  const handleCheck = () => {
    const addr = walletInput.trim() || (!isPrivyId ? walletAddress : "");
    if (addr) checkWallet(addr);
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  const copyCA = () => {
    navigator.clipboard.writeText(HIVE_CA);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  };

  const resultTier = result?.tierInfo ? TIER_CARDS.find(t => t.id === result.tierInfo!.id) : null;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black relative overflow-x-hidden">
      <Navbar />

      <main className="pt-28 pb-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6">

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4">
              <span className="text-emerald-500">$HIVE</span> Token
            </h1>

            {/* Contract Address */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={copyCA}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 transition-all group cursor-pointer"
              >
                <span className="text-[10px] font-mono text-zinc-600">CA:</span>
                <span className="text-[11px] font-mono text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  <span className="sm:hidden">{HIVE_CA.slice(0, 6)}...{HIVE_CA.slice(-4)}</span>
                  <span className="hidden sm:inline">{HIVE_CA}</span>
                </span>
                {caCopied ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} className="text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                )}
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <Link
                href="/stake"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-full text-xs font-bold transition-colors"
              >
                Stake HIVE <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Main Content: Swap + Info */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-20">
            {/* Left: Swap Widget (takes 2 cols on large) */}
            <div className="lg:col-span-2 order-1 lg:order-2">
              <div className="lg:sticky lg:top-28">
                <SwapWidget />
              </div>
            </div>

            {/* Right: Benefits (takes 3 cols on large) */}
            <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
              <h2 className="text-[10px] font-bold font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2 flex items-center gap-2">
                <Star size={11} className="text-zinc-600" /> Why hold $HIVE
              </h2>

              {PERKS.map((perk, i) => (
                <div
                  key={i}
                  className="group relative bg-[#0A0A0A] border border-white/[0.06] hover:border-white/10 rounded-xl p-5 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${perk.gradient} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative flex gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <perk.icon className="text-emerald-500" size={18} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm mb-1.5">{perk.title}</h3>
                      <p className="text-zinc-500 text-xs leading-relaxed">{perk.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tiers */}
          <div className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-[10px] font-bold font-mono uppercase tracking-[0.2em] text-zinc-500 mb-3 flex items-center justify-center gap-2">
                <Coins size={11} className="text-zinc-600" /> Holder Tiers
              </h2>
              <p className="text-zinc-600 text-xs max-w-md mx-auto">
                Holding unlocks premium access. Staking on <Link href="/stake" className="text-emerald-400 hover:text-emerald-300">/stake</Link> adds discounts, boosted points, and governance weight.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIER_CARDS.map((tier) => (
                <div
                  key={tier.id}
                  className={`relative group bg-[#0A0A0A] border ${tier.borderColor} ${tier.borderHover} rounded-xl p-6 transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${tier.gradient} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-lg bg-black/50 border ${tier.borderColor} flex items-center justify-center`}>
                        <span className="text-xl">{tier.emoji}</span>
                      </div>
                      <div>
                        <h3 className={`font-bold text-base ${tier.iconColor}`}>{tier.label}</h3>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{tier.requirement} $HIVE</p>
                      </div>
                    </div>
                    <ul className="space-y-2.5">
                      {tier.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-400">
                          <CheckCircle size={13} className={`${tier.iconColor} shrink-0 mt-0.5`} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Check Your Tier */}
          <div className="mb-20">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-[10px] font-bold font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2 flex items-center justify-center gap-2">
                  <Search size={11} className="text-zinc-600" /> Check Your Tier
                </h2>
              </div>

              <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-6">
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder={
                      authenticated && !isPrivyId
                        ? `${walletAddress.slice(0, 8)}... (leave blank for yours)`
                        : "Solana wallet address"
                    }
                    className="flex-1 bg-black/60 border border-white/5 rounded-lg px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                  />
                  <button
                    onClick={handleCheck}
                    disabled={loading}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2 justify-center shrink-0"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                    {loading ? "Checking" : "Check"}
                  </button>
                </div>

                {!authenticated && (
                  <button onClick={() => login()} disabled={!ready} className="text-[11px] text-zinc-600 hover:text-emerald-400 transition-colors font-mono cursor-pointer">
                    or sign in to auto-check
                  </button>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-500/5 border border-red-500/15 rounded-lg text-red-400 text-xs font-mono">{error}</div>
                )}

                {result && (
                  <div className="mt-5 pt-5 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono text-zinc-600">{result.wallet.slice(0, 6)}...{result.wallet.slice(-4)}</span>
                      <div>
                        <span className="text-lg font-bold font-mono text-white">{fmt(result.balance)}</span>
                        <span className="text-emerald-500 text-xs ml-1">HIVE</span>
                      </div>
                    </div>

                    {result.isHolder && resultTier ? (
                      <div>
                        <div className={`bg-black/30 border ${resultTier.borderColor} rounded-lg p-4 mb-4`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">{resultTier.emoji}</span>
                            <span className={`font-bold ${resultTier.iconColor}`}>{resultTier.label}</span>
                            <span className="text-[10px] font-mono text-zinc-600">{resultTier.requirement} $HIVE</span>
                          </div>
                          <ul className="space-y-1.5">
                            {resultTier.benefits.map((b, i) => (
                              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                                <CheckCircle size={11} className={`${resultTier.iconColor} shrink-0 mt-0.5`} />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-3 bg-black/30 border border-white/5 hover:border-emerald-500/20 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                          >
                            <span className="text-lg">{resultTier.emoji}</span>
                            <div>
                              <div className="font-bold text-white text-[11px]">Badge is live</div>
                              <div className="text-[10px] text-zinc-600">Visible on your profile & tasks</div>
                            </div>
                            <ArrowRight size={12} className="ml-auto text-zinc-700" />
                          </Link>
                          <Link
                            href="/docs#x402-api"
                            className="flex items-center gap-2 px-4 py-3 bg-black/30 border border-white/5 hover:border-emerald-500/20 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                          >
                            <Lock size={16} className="text-emerald-500 shrink-0" />
                            <div>
                              <div className="font-bold text-white text-[11px]">Premium API unlocked</div>
                              <div className="text-[10px] text-zinc-600">Premium marketplace intelligence</div>
                            </div>
                            <ArrowRight size={12} className="ml-auto text-zinc-700" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-zinc-500 text-sm mb-1">
                          {result.balance > 0 ? `${fmt(result.balance)} HIVE. Need 10K+ to qualify.` : "No $HIVE in this wallet."}
                        </p>
                        <a href={`https://bags.fm/${HIVE_CA}`} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 text-xs font-mono uppercase tracking-widest inline-flex items-center gap-1">
                          Get $HIVE <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center pt-8 border-t border-white/5">
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href={`https://bags.fm/${HIVE_CA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              >
                Get $HIVE <ExternalLink size={12} />
              </a>
              <Link
                href="/agents"
                className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-800 hover:border-zinc-600 text-white font-mono text-xs uppercase tracking-widest rounded-lg transition-colors"
              >
                Browse Agents <ArrowRight size={12} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
