"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Check, Coins, Copy, ExternalLink, Loader2, Plug, Search, Shield, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

type RegistryTool = {
  name: string;
  description: string;
  costPerCall: number;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  status: string;
  tokenMint?: string | null;
  feeVaultAddress?: string | null;
  tokenSymbol?: string | null;
  catalogOnly?: boolean;
  remoteUrl?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string;
  installCommand?: string;
  authRequired?: boolean;
  provider: {
    id: string | null;
    name: string;
    bio: string;
    reputation: number;
    avgSatisfaction: number;
    reviewCount: number;
    address: string | null;
  };
};

type RegistryStats = {
  totalTools: number;
  tokenizedTools: number;
  providers: number;
  catalogTools?: number;
  registeredTools?: number;
};

function shortAddress(address?: string | null) {
  if (!address) return "Unlinked";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function RegistryPage() {
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [query, setQuery] = useState("");
  const [tokenizedOnly, setTokenizedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load registry.");
      })
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
        tool.provider.name,
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
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="pt-24 pb-10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-sm mb-4">
                <Plug size={12} /> MCP Registry
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase">Tool Directory</h1>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
              {[
                ["Tools", stats?.totalTools ?? tools.length],
                ["Tokenized", stats?.tokenizedTools ?? tools.filter((tool) => tool.tokenMint).length],
                ["Catalog", stats?.catalogTools ?? tools.filter((tool) => tool.catalogOnly).length],
              ].map(([label, value]) => (
                <div key={label} className="border border-white/10 bg-white/[0.03] rounded-sm px-4 py-3 min-w-0">
                  <div className="text-lg md:text-2xl font-black font-mono">{Number(value).toLocaleString()}</div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest truncate">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-3">
            <label className="flex-1 flex items-center gap-3 border border-white/10 bg-zinc-950 rounded-sm px-3 h-11">
              <Search size={16} className="text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools, providers, tokens"
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-600"
              />
            </label>
            <button
              onClick={() => setTokenizedOnly((value) => !value)}
              className={`h-11 px-4 rounded-sm border font-mono text-[11px] uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors ${
                tokenizedOnly
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                  : "border-white/10 bg-zinc-950 text-zinc-400 hover:text-white"
              }`}
            >
              <SlidersHorizontal size={14} /> Tokenized
            </button>
            <Link
              href="/agent/dashboard/tools?from=registry"
              className="h-11 px-4 rounded-sm bg-white text-black hover:bg-zinc-200 font-mono text-[11px] uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plug size={14} /> Register
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {loading ? (
            <div className="h-64 border border-white/10 bg-white/[0.02] rounded-sm flex items-center justify-center text-zinc-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="border border-red-500/20 bg-red-500/10 text-red-300 rounded-sm p-4 text-sm">{error}</div>
          ) : filteredTools.length === 0 ? (
            <div className="h-64 border border-white/10 bg-white/[0.02] rounded-sm flex flex-col items-center justify-center text-center px-6">
              <Plug className="text-zinc-700 mb-3" size={28} />
              <p className="text-zinc-400 text-sm font-mono">No matching tools found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTools.map((tool) => {
                const propertyNames = Object.keys(tool.inputSchema?.properties || {}).slice(0, 5);
                return (
                  <article key={`${tool.provider.id || tool.provider.name}-${tool.name}`} className="border border-white/10 bg-zinc-950/80 rounded-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold font-mono text-white truncate">{tool.name}</h2>
                          {tool.tokenMint && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-violet-300 border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 rounded-sm">
                              <Coins size={10} /> {tool.tokenSymbol || "Tokenized"}
                            </span>
                          )}
                          {tool.catalogOnly && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-blue-300 border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 rounded-sm">
                              Catalog
                            </span>
                          )}
                          {tool.authRequired && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-amber-300 border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 rounded-sm">
                              Auth
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{tool.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-emerald-400 font-mono font-bold">{tool.catalogOnly ? "Public" : `$${tool.costPerCall.toFixed(4)}`}</div>
                        <div className="text-[10px] text-zinc-600 font-mono uppercase">{tool.catalogOnly ? "MCP server" : "per call"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                      <div className="md:col-span-2 border border-white/5 bg-black/40 rounded-sm p-3">
                        <div className="text-[10px] text-zinc-600 font-mono uppercase mb-2">Input Schema</div>
                        <div className="flex flex-wrap gap-1.5">
                          {propertyNames.length > 0 ? propertyNames.map((name) => (
                            <span key={name} className="text-[11px] text-zinc-300 font-mono border border-white/10 bg-white/[0.03] rounded-sm px-2 py-1">
                              {name}
                            </span>
                          )) : (
                            <span className="text-[11px] text-zinc-600 font-mono">No required fields</span>
                          )}
                        </div>
                      </div>
                      <div className="border border-white/5 bg-black/40 rounded-sm p-3">
                        <div className="text-[10px] text-zinc-600 font-mono uppercase mb-2">{tool.catalogOnly ? "Publisher" : "Provider"}</div>
                        <div className="text-sm text-white font-semibold truncate">{tool.provider.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-1">{tool.catalogOnly ? "External MCP" : shortAddress(tool.provider.address)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Shield size={12} /> Rep {tool.provider.reputation.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Activity size={12} /> {tool.status}
                        </span>
                      </div>
                      {tool.catalogOnly ? (
                        <div className="flex flex-wrap gap-3">
                          {(tool.remoteUrl || tool.installCommand) && (
                            <button
                              onClick={() => copyConnectValue(tool)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-blue-300 hover:text-blue-200"
                            >
                              {copiedTool === tool.name ? <Check size={12} /> : <Copy size={12} />}
                              {tool.remoteUrl ? "Copy URL" : "Copy Command"}
                            </button>
                          )}
                          <a
                            href={tool.websiteUrl || tool.sourceUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white"
                          >
                            Source <ExternalLink size={12} />
                          </a>
                        </div>
                      ) : tool.tokenMint ? (
                        <a
                          href={`https://bags.fm/${tool.tokenMint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-violet-300 hover:text-violet-200"
                        >
                          Bags <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-600">Gateway: /api/mcp</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
