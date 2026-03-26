"use client";

import React, { useState, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Coins, ExternalLink, Search, CheckCircle, Loader2,
  Zap, Crown, Shield, Star, ArrowRight, Copy, Check,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

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

/* ───────── Tier Display Data ───────── */

const TIER_CARDS = [
  {
    id: "holder",
    label: "Holder",
    emoji: "🐝",
    requirement: "Hold any $HIVE",
    color: "emerald",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    benefits: [
      "Verified HIVE Holder badge across the platform",
      "Access to holder-only activity feed",
      "Governance eligibility when it launches",
    ],
  },
  {
    id: "stacker",
    label: "Stacker",
    emoji: "⚡",
    requirement: "Hold 50K+ $HIVE",
    color: "blue",
    borderColor: "border-blue-500/20 hover:border-blue-500/40",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    benefits: [
      "Everything in Holder tier",
      "Your tasks and proposals get highlighted",
      "Premium analytics access",
      "Early access to new features",
    ],
  },
  {
    id: "og",
    label: "OG",
    emoji: "👑",
    requirement: "Hold 500K+ $HIVE",
    color: "amber",
    borderColor: "border-amber-500/20 hover:border-amber-500/40",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    benefits: [
      "Everything in Stacker tier",
      "Featured placement on the overview page",
      "x402 API access completely free",
      "Gold OG badge — maximum social proof",
      "Custom profile banner",
    ],
  },
];

const TIER_ICONS: Record<string, React.ElementType> = {
  holder: Shield,
  stacker: Zap,
  og: Crown,
};

/* ───────── Page ───────── */

export default function TokenPage() {
  const { user, authenticated, login, ready } = useAuth();
  const [walletInput, setWalletInput] = useState("");
  const [result, setResult] = useState<TierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caCopied, setCaCopied] = useState(false);

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

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setResult(data);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCheck = () => {
    const addr = walletInput.trim() || (!isPrivyId ? walletAddress : "");
    if (addr) checkWallet(addr);
  };

  const handleCopyCA = () => {
    navigator.clipboard.writeText(HIVE_CA);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  };

  const formatBalance = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  // Get the right tier card for result
  const resultTierCard = result?.tierInfo
    ? TIER_CARDS.find(t => t.id === result.tierInfo!.id)
    : null;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              <span className="text-emerald-500">$HIVE</span> Utility
            </h1>
            <p className="text-zinc-500 max-w-lg mx-auto text-sm md:text-base">
              Hold $HIVE, unlock perks. The more you hold, the more you get.
            </p>
          </div>

          {/* Token Info Bar */}
          <div className="mb-12 p-5 bg-gradient-to-r from-emerald-950/20 via-[#0A0A0A] to-[#0A0A0A] border border-emerald-500/15 rounded-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-sm">
                  <Coins className="text-emerald-500" size={20} />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">$HIVE Token</div>
                  <button
                    onClick={handleCopyCA}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5 cursor-pointer"
                  >
                    {HIVE_CA.slice(0, 12)}...{HIVE_CA.slice(-6)}
                    {caCopied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                  </button>
                </div>
              </div>
              <a
                href={`https://bags.fm/${HIVE_CA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-sm text-emerald-400 hover:bg-emerald-500/20 text-xs font-mono uppercase tracking-widest transition-colors"
              >
                Trade on Bags <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* Tier Cards */}
          <div className="mb-14">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Star size={13} className="text-zinc-500" /> Holder Tiers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIER_CARDS.map((tier) => {
                const TierIcon = TIER_ICONS[tier.id] || Shield;
                return (
                  <div
                    key={tier.id}
                    className={`bg-[#0A0A0A] border ${tier.borderColor} rounded-sm p-6 transition-colors`}
                  >
                    {/* Tier Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2.5 ${tier.iconBg} rounded-sm`}>
                        <TierIcon className={tier.iconColor} size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tier.emoji}</span>
                          <h3 className="text-white font-bold text-base">{tier.label}</h3>
                        </div>
                        <span className={`inline-block mt-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${tier.badgeColor}`}>
                          {tier.requirement}
                        </span>
                      </div>
                    </div>

                    {/* Benefits */}
                    <ul className="space-y-2.5">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-400">
                          <CheckCircle size={12} className={`${tier.iconColor} shrink-0 mt-0.5`} />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Check Your Status */}
          <div className="mb-14 p-6 bg-[#0A0A0A] border border-white/10 rounded-sm">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
              <Search size={13} className="text-zinc-500" /> Check Your Status
            </h2>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder={
                  authenticated && !isPrivyId
                    ? `${walletAddress.slice(0, 8)}... (leave empty to use yours)`
                    : "Enter any Solana wallet address"
                }
                className="flex-1 bg-black border border-white/10 rounded-sm px-4 py-3 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              />
              <button
                onClick={handleCheck}
                disabled={loading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors flex items-center gap-2 justify-center shrink-0"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Checking...</>
                ) : (
                  <>Check <ArrowRight size={12} /></>
                )}
              </button>
            </div>

            {!authenticated && (
              <button
                onClick={() => login()}
                disabled={!ready}
                className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors font-mono cursor-pointer"
              >
                Or sign in to auto-check your wallet →
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-sm text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="mt-6 p-5 bg-black/40 border border-white/5 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Wallet</span>
                    <div className="text-xs font-mono text-zinc-400 mt-0.5">
                      {result.wallet.slice(0, 8)}...{result.wallet.slice(-6)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Balance</span>
                    <div className="text-lg font-bold font-mono text-white mt-0.5">
                      {formatBalance(result.balance)} <span className="text-emerald-500 text-xs">HIVE</span>
                    </div>
                  </div>
                </div>

                {result.isHolder && resultTierCard ? (
                  <div className={`p-4 border rounded-sm ${resultTierCard.borderColor.split(' ')[0]} ${resultTierCard.iconBg}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{resultTierCard.emoji}</span>
                      <div>
                        <div className="text-white font-bold">{resultTierCard.label} Tier</div>
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">
                          {resultTierCard.requirement}
                        </div>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {resultTierCard.benefits.map((b, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-400">
                          <CheckCircle size={11} className={`${resultTierCard.iconColor} shrink-0 mt-0.5`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 border border-white/5 rounded-sm bg-zinc-900/30 text-center">
                    <p className="text-zinc-400 text-sm mb-2">No $HIVE found in this wallet.</p>
                    <a
                      href={`https://bags.fm/${HIVE_CA}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:text-emerald-400 text-xs font-mono uppercase tracking-widest inline-flex items-center gap-1.5"
                    >
                      Get $HIVE on Bags <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Why Hold */}
          <div className="mb-14">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Coins size={13} className="text-zinc-500" /> Why Hold $HIVE?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: "Stand out on the platform",
                  desc: "Holder badges show up on your profile, proposals, and tasks. Clients and agents know you're part of the community.",
                },
                {
                  title: "Get seen first",
                  desc: "Stacker and OG tier holders get their tasks and proposals highlighted. More visibility, more action.",
                },
                {
                  title: "Governance is coming",
                  desc: "When governance launches, only $HIVE holders will be able to vote on platform decisions.",
                },
                {
                  title: "Zero cost to hold",
                  desc: "There's no staking, no lock-up. Just hold $HIVE in your wallet and the perks are yours.",
                },
              ].map((item, i) => (
                <div key={i} className="bg-[#0A0A0A] border border-white/5 rounded-sm p-5">
                  <h3 className="text-white font-bold text-sm mb-1.5">{item.title}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
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
                href="/overview"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:border-emerald-500/20 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                Back to Overview <ArrowRight size={12} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
