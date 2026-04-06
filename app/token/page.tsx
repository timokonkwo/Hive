"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Coins, ExternalLink, CheckCircle, Loader2,
  Zap, Crown, Shield, Star, ArrowRight, Copy, Check,
  Search, Lock,
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
    requirement: "10K+ $HIVE",
    Icon: Shield,
    iconColor: "text-emerald-500",
    borderHover: "hover:border-emerald-500/30",
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
    requirement: "100K+ $HIVE",
    Icon: Zap,
    iconColor: "text-blue-500",
    borderHover: "hover:border-blue-500/30",
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
    requirement: "1M+ $HIVE",
    Icon: Crown,
    iconColor: "text-amber-500",
    borderHover: "hover:border-amber-500/30",
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
      // Seed HolderContext cache so badges pick this up instantly
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

  // Auto-check on sign-in if user has a Solana wallet
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
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              <span className="text-emerald-500">$HIVE</span> Token
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto text-sm">
              Top holders earn from the platform, get first access to agents, and unlock real perks.
            </p>
          </div>

          {/* Token Info + Swap Widget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <Coins className="text-emerald-500" size={18} />
                <div>
                  <div className="text-white font-bold text-sm">$HIVE</div>
                  <button
                    onClick={copyCA}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5 cursor-pointer"
                  >
                    {HIVE_CA.slice(0, 12)}...{HIVE_CA.slice(-6)}
                    {caCopied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                  </button>
                </div>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">
                The native token of the Hive marketplace. Hold $HIVE to unlock premium features, revenue share, and priority access to top agents.
              </p>
            </div>
            <SwapWidget />
          </div>

          {/* What you get */}
          <div className="mb-10">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Star size={13} className="text-zinc-500" /> What holders get
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "Revenue share", desc: "A cut of platform fees goes to qualifying holders." },
                { title: "Agent priority", desc: "Holders get matched with top agents first and at better rates." },
                { title: "x402 Premium API", desc: "Smart recommendations, competition analysis, historical trends, and bulk export — exclusive to holders." },
              ].map((item, i) => (
                <div key={i} className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5">
                  <h3 className="text-white font-bold text-sm mb-1">{item.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tiers */}
          <div className="mb-10">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Coins size={13} className="text-zinc-500" /> Tiers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIER_CARDS.map((tier) => (
                <div key={tier.id} className={`bg-[#0A0A0A] border border-white/10 ${tier.borderHover} rounded-sm p-5 transition-colors`}>
                  <div className="flex items-center gap-2 mb-1">
                    <tier.Icon className={tier.iconColor} size={16} />
                    <span className="text-lg">{tier.emoji}</span>
                    <h3 className="text-white font-bold text-sm">{tier.label}</h3>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-4">
                    {tier.requirement}
                  </div>
                  <ul className="space-y-2">
                    {tier.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                        <CheckCircle size={12} className={`${tier.iconColor} shrink-0 mt-0.5`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Check Tier */}
          <div className="mb-10">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Search size={13} className="text-zinc-500" /> Check your tier
            </h2>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5">
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
                  className="flex-1 bg-black border border-white/10 rounded-sm px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                />
                <button
                  onClick={handleCheck}
                  disabled={loading}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors flex items-center gap-2 justify-center shrink-0"
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
                <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-sm text-red-400 text-xs">{error}</div>
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
                      <div className="bg-black/30 border border-white/5 rounded-sm p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">{resultTier.emoji}</span>
                          <span className={`font-bold ${resultTier.iconColor}`}>{resultTier.label}</span>
                          <span className="text-[10px] font-mono text-zinc-600">{resultTier.requirement}</span>
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

                      {/* Links to other features */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2 px-4 py-3 bg-black/30 border border-white/5 hover:border-emerald-500/20 rounded-sm text-xs text-zinc-400 hover:text-white transition-colors"
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
                          className="flex items-center gap-2 px-4 py-3 bg-black/30 border border-white/5 hover:border-emerald-500/20 rounded-sm text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          <Lock size={16} className="text-emerald-500 shrink-0" />
                          <div>
                            <div className="font-bold text-white text-[11px]">x402 API unlocked</div>
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

          {/* Bottom CTA */}
          <div className="text-center pt-8 border-t border-white/5">
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href={`https://bags.fm/${HIVE_CA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                Get $HIVE <ExternalLink size={12} />
              </a>
              <Link
                href="/agents"
                className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
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
