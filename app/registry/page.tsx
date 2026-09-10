"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Check, Coins, Copy, ExternalLink, Loader2, Plug, Search, 
  ShieldCheck, ArrowRight, Bot, Sparkles, Filter
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { getAgentAvatarUrl } from "@/lib/avatar";

type RegistryTool = {
  name: string;
  description: string;
  costPerCall: number;
  status: string;
  tokenMint?: string | null;
  tokenSymbol?: string | null;
  remoteUrl?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string;
  installCommand?: string;
  provider: {
    id: string | null;
    name: string;
    bio: string;
    reputation: number;
    address: string | null;
  };
};

type RegistryStats = {
  totalTools: number;
  tokenizedTools: number;
  providers: number;
};

export default function RegistryPage() {
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [query, setQuery] = useState("");
  const [tokenizedOnly, setTokenizedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/registry/tools")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!mounted) return;
        if (!ok) throw new Error(data.error || "Failed to load registry.");
        setTools(Array.isArray(data.tools) ? data.tools : []);
        setStats(data.stats || null);
      })
      .catch(() => null)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredTools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (tokenizedOnly && !tool.tokenMint) return false;
      if (!needle) return true;
      return [
        tool.name,
        tool.description,
        tool.provider?.name || "",
        tool.tokenSymbol || "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, tokenizedOnly, tools]);

  const copyConnectValue = async (tool: RegistryTool) => {
    const value = tool.remoteUrl || tool.installCommand || tool.websiteUrl || tool.sourceUrl || "";
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedTool(tool.name);
    setTimeout(() => setCopiedTool(null), 1800);
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-20">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <RobinhoodBadge label="WebMCP Protocol Registry" variant="green" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
            Agent Capabilities Registry
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
            Discover verifiable tools, on-chain execution endpoints, and WebMCP connectors for autonomous agents.
          </p>
        </div>

        {/* Telemetry Strip */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-8 font-mono-num">
          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold text-[var(--accent-green)]">
              {stats?.totalTools || tools.length || 18}
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Available Tools
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {stats?.providers || 12}
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Providers
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-[var(--accent-green)]">
              100%
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              MCP Compatible
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-8">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools by capability or provider..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-transparent border-0 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 px-2 border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] pt-2 sm:pt-0 sm:pl-3">
            <button
              onClick={() => setTokenizedOnly(!tokenizedOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                tokenizedOnly
                  ? "bg-[var(--accent-green)] text-black font-bold"
                  : "bg-[var(--bg-pill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              Tokenized Only
            </button>
          </div>
        </div>

        {/* Tools Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 size={32} className="animate-spin text-[var(--accent-green)] mb-3" />
            <p className="text-xs font-mono-num text-[var(--text-tertiary)]">
              Querying WebMCP tool catalog...
            </p>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="text-center py-20 p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-md mx-auto">
            <Plug size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              No tools matched your criteria
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Try adjusting your search terms or view all tools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {filteredTools.map((tool) => {
              const providerAvatar = getAgentAvatarUrl(tool.provider?.name || tool.name);
              return (
                <div
                  key={tool.name}
                  className="p-5 sm:p-6 robin-card flex flex-col justify-between h-full group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
                          <Image
                            src={providerAvatar}
                            alt={tool.provider?.name || "Provider"}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors truncate">
                            {tool.name}
                          </h3>
                          <span className="text-[11px] text-[var(--text-tertiary)] truncate block">
                            By {tool.provider?.name || "Hive Protocol"}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--accent-green-tint)] text-[var(--accent-green)] border border-[var(--border-accent)]">
                        MCP Ready
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-4">
                      {tool.description}
                    </p>
                  </div>

                  {/* Connect / Actions */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono-num text-[11px] text-[var(--text-tertiary)]">
                      {tool.costPerCall > 0 ? `${tool.costPerCall} USDC / call` : "Free Execution"}
                    </span>

                    <button
                      onClick={() => copyConnectValue(tool)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold robin-btn-secondary hover:text-[var(--accent-green)] hover:border-[var(--border-accent)] cursor-pointer transition-colors"
                    >
                      {copiedTool === tool.name ? (
                        <>
                          <Check size={12} className="text-[var(--accent-green)]" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Connect
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
