"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, ExternalLink, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { toast } from "sonner";

type RegisteredTool = {
  name: string;
  description: string;
  endpoint: string;
  costPerCall: number;
  inputSchema: Record<string, any>;
  tokenMint?: string;
  feeVaultAddress?: string;
  tokenSymbol?: string;
  status?: string;
};

const DEFAULT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    input: { type: "string" },
  },
  required: ["input"],
}, null, 2);

const agentAuthHeaders = (key: string): HeadersInit => (
  key ? { "x-hive-api-key": key } : {}
);

export default function AgentToolsPage() {
  const [fromRegistry, setFromRegistry] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [agent, setAgent] = useState<any>(null);
  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTool, setDeletingTool] = useState<string | null>(null);
  const [tokenizingTool, setTokenizingTool] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenImageUrl, setTokenImageUrl] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    endpoint: "",
    costPerCall: "0.01",
    inputSchema: DEFAULT_SCHEMA,
  });

  const headers = useMemo(() => agentAuthHeaders(apiKey), [apiKey]);
  const backHref = fromRegistry ? "/registry" : "/agent/dashboard";
  const backLabel = fromRegistry ? "Registry" : "Agent Hub";

  useEffect(() => {
    setFromRegistry(new URLSearchParams(window.location.search).get("from") === "registry");
  }, []);

  const loadTools = useCallback(async (key = apiKey, options: { silent?: boolean } = {}) => {
    setLoading(true);
    try {
      const requestHeaders = agentAuthHeaders(key);
      const [profileRes, toolsRes] = await Promise.all([
        fetch("/api/agents/me", { headers: requestHeaders }),
        fetch("/api/agents/me/tools", { headers: requestHeaders }),
      ]);

      if (!profileRes.ok) {
        if (options.silent && profileRes.status === 401) return;
        throw new Error("Invalid API key.");
      }
      const profile = await profileRes.json();
      setAgent(profile.agent);

      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTools(data.tools || []);
      }
    } catch (error: any) {
      if (!options.silent) {
        toast.error(error.message || "Could not load tools.");
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    loadTools("", { silent: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editTool = (tool: RegisteredTool) => {
    setForm({
      name: tool.name,
      description: tool.description || "",
      endpoint: tool.endpoint || "",
      costPerCall: String(tool.costPerCall || 0),
      inputSchema: JSON.stringify(tool.inputSchema || { type: "object", properties: {} }, null, 2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveTool = async () => {
    if (!apiKey && !agent) {
      toast.error("Enter your agent API key first.");
      return;
    }

    let parsedSchema: any;
    try {
      parsedSchema = JSON.parse(form.inputSchema);
    } catch {
      toast.error("Input schema must be valid JSON.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/agents/me/tools", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          endpoint: form.endpoint,
          costPerCall: Number(form.costPerCall),
          inputSchema: parsedSchema,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Tool could not be saved.");
      toast.success("Tool saved.");
      setForm({ name: "", description: "", endpoint: "", costPerCall: "0.01", inputSchema: DEFAULT_SCHEMA });
      loadTools();
    } catch (error: any) {
      toast.error(error.message || "Tool could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTool = async (name: string) => {
    setDeletingTool(name);
    try {
      const res = await fetch("/api/agents/me/tools", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Tool could not be removed.");
      toast.success("Tool removed.");
      loadTools();
    } catch (error: any) {
      toast.error(error.message || "Tool could not be removed.");
    } finally {
      setDeletingTool(null);
    }
  };

  const tokenizeTool = async (tool: RegisteredTool) => {
    if (!agent) return;
    if (!tokenSymbol) {
      toast.error("Enter a token symbol.");
      return;
    }

    setTokenizingTool(tool.name);
    try {
      const res = await fetch("/api/bags/launch-tool", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          capability: tool.name,
          tokenSymbol,
          tokenImageUrl: tokenImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Token launch failed.");
      toast.success(`Tool token launched: $${tokenSymbol.toUpperCase()}`);
      setTokenSymbol("");
      setTokenImageUrl("");
      loadTools();
    } catch (error: any) {
      toast.error(error.message || "Token launch failed.");
    } finally {
      setTokenizingTool(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
            <div>
              <Link href={backHref} className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white mb-4">
                <ArrowLeft size={14} /> {backLabel}
              </Link>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">MCP Tools</h1>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
                <span className="border border-white/10 bg-white/[0.03] rounded px-2 py-1">{tools.length} registered</span>
                <span className="border border-white/10 bg-white/[0.03] rounded px-2 py-1">Gateway: /api/mcp</span>
              </div>
            </div>
            <button
              onClick={() => loadTools()}
              disabled={loading || (!apiKey && !agent)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 rounded text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>

          <section className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5 mb-6">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Agent API Key</label>
            <div className="mt-2 flex flex-col md:flex-row gap-2">
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                placeholder="hive_sk_..."
                className="min-w-0 flex-1 bg-black/60 border border-white/10 rounded px-3 py-3 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
              <button
                onClick={() => loadTools()}
                disabled={loading || !apiKey}
                className="inline-flex items-center justify-center gap-2 bg-white text-black rounded px-4 py-3 text-xs font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Load
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
            <section className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Register Tool</h2>
                <Plus size={18} className="text-zinc-500" />
              </div>
              <div className="space-y-3">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="tool_name"
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
                <input
                  value={form.endpoint}
                  onChange={(event) => setForm((current) => ({ ...current, endpoint: event.target.value }))}
                  placeholder="https://your-domain.com/mcp"
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
                <input
                  value={form.costPerCall}
                  onChange={(event) => setForm((current) => ({ ...current, costPerCall: event.target.value }))}
                  inputMode="decimal"
                  placeholder="0.01"
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="What this tool does"
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-emerald-500/40 resize-none"
                />
                <textarea
                  value={form.inputSchema}
                  onChange={(event) => setForm((current) => ({ ...current, inputSchema: event.target.value }))}
                  rows={10}
                  spellCheck={false}
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500/40 resize-y"
                />
                <button
                  onClick={saveTool}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 bg-white text-black rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Tool
                </button>
              </div>
            </section>

            <section className="space-y-4">
              {tools.length === 0 ? (
                <div className="border border-white/10 bg-white/[0.03] rounded-lg p-10 text-center">
                  <h2 className="font-bold">No Tools Registered</h2>
                  <p className="text-sm text-zinc-500 mt-2">Add an HTTPS MCP-compatible endpoint to publish it through the Hive gateway.</p>
                </div>
              ) : (
                tools.map((tool) => (
                  <article key={tool.name} className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-bold text-lg">{tool.name}</h2>
                          <span className="text-[10px] font-mono uppercase border border-white/10 rounded px-2 py-0.5 text-zinc-400">
                            ${Number(tool.costPerCall || 0).toFixed(4)} / call
                          </span>
                          {tool.tokenMint && (
                            <span className="text-[10px] font-mono uppercase border border-violet-500/20 bg-violet-500/10 rounded px-2 py-0.5 text-violet-300">
                              Tokenized
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-2">{tool.description}</p>
                        <p className="text-[11px] font-mono text-zinc-600 truncate mt-2">{tool.endpoint}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => editTool(tool)}
                          className="px-3 py-1.5 border border-white/10 text-zinc-300 hover:text-white rounded text-[10px] font-mono uppercase"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTool(tool.name)}
                          disabled={deletingTool === tool.name}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded text-[10px] font-mono uppercase disabled:opacity-50"
                        >
                          {deletingTool === tool.name ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      {tool.tokenMint ? (
                        <a
                          href={`https://bags.fm/${tool.tokenMint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-violet-300 hover:text-violet-200"
                        >
                          ${tool.tokenSymbol || "TOOL"} {tool.tokenMint.slice(0, 8)}...{tool.tokenMint.slice(-6)} <ExternalLink size={12} />
                        </a>
                      ) : (
                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                          <input
                            value={tokenSymbol}
                            onChange={(event) => setTokenSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                            placeholder="SYMBOL"
                            className="bg-black/60 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-violet-500/40"
                          />
                          <input
                            value={tokenImageUrl}
                            onChange={(event) => setTokenImageUrl(event.target.value)}
                            placeholder="Image URL"
                            className="bg-black/60 border border-white/10 rounded px-3 py-2 text-xs font-mono outline-none focus:border-violet-500/40"
                          />
                          <button
                            onClick={() => tokenizeTool(tool)}
                            disabled={tokenizingTool === tool.name}
                            className="inline-flex items-center justify-center gap-2 bg-violet-600/90 hover:bg-violet-500 text-white rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
                          >
                            {tokenizingTool === tool.name ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                            Tokenize
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
