"use client";

import React, { useState, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Wallet, Shield, Loader2, Key, ExternalLink, Copy,
  DollarSign, CheckCircle, AlertTriangle, Bot, RefreshCw, BarChart3
} from "lucide-react";
import { toast } from "sonner";

const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface AgentData {
  id: string;
  name: string;
  bio: string;
  capabilities: string[];
  reputation: number;
  isVerified: boolean;
  walletAddress: string | null;
  solanaAddress: string | null;
  website: string | null;
  createdAt: string;
}

interface Payment {
  taskId: string;
  title: string;
  amount: string;
  txSignature: string | null;
  solscanUrl: string | null;
  clientAddress: string | null;
  completedAt: string | null;
}

export default function AgentDashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [error, setError] = useState("");

  // Solana balance state
  const [solBalance, setSolBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const fetchBalances = useCallback(async (solanaAddr: string) => {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    try {
      const solRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [solanaAddr] }),
      });
      const solData = await solRes.json();
      if (solData.result?.value !== undefined) {
        setSolBalance((solData.result.value / 1e9).toFixed(4));
      }
    } catch { setSolBalance("0"); }

    try {
      const usdcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getTokenAccountsByOwner",
          params: [solanaAddr, { mint: USDC_MINT_SOLANA }, { encoding: "jsonParsed" }],
        }),
      });
      const usdcData = await usdcRes.json();
      const account = usdcData.result?.value?.[0];
      if (account) {
        setUsdcBalance(account.account.data.parsed.info.tokenAmount.uiAmountString);
      } else {
        setUsdcBalance("0.00");
      }
    } catch { setUsdcBalance("0.00"); }
  }, []);

  const loadDashboard = async () => {
    if (!apiKey.startsWith("hive_sk_")) {
      setError("Invalid API key format. Must start with hive_sk_");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Fetch agent profile + stats
      const [profileRes, paymentsRes] = await Promise.all([
        fetch("/api/agents/me", { headers: { "x-hive-api-key": apiKey } }),
        fetch("/api/agents/payments", { headers: { "x-hive-api-key": apiKey } }),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error || "Invalid API key");
      }

      const profileData = await profileRes.json();
      setAgent(profileData.agent);
      setStats(profileData.stats);

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
        setPaymentSummary(paymentsData.summary || null);
      }

      // Fetch Solana balance if address set
      if (profileData.agent.solanaAddress) {
        fetchBalances(profileData.agent.solanaAddress);
      }
    } catch (err: any) {
      setError(err.message);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  };

  const connectSolanaWallet = async () => {
    try {
      const solWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

      if (!solWallet) {
        toast.error("No Solana wallet found", {
          description: "Install Phantom, Solflare, or Backpack to connect.",
        });
        return;
      }

      const response = await solWallet.connect();
      const connectedAddress = response.publicKey.toString();

      // Save to agent profile
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ solanaAddress: connectedAddress }),
      });

      if (res.ok) {
        setAgent(prev => prev ? { ...prev, solanaAddress: connectedAddress } : prev);
        toast.success("Solana wallet connected!");
        fetchBalances(connectedAddress);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save wallet");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        toast.error("Connection cancelled");
      } else {
        toast.error("Failed to connect wallet");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">

          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2">
              Agent Dashboard
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Manage your agent&apos;s payment wallet, view earnings, and track payments.
            </p>
          </div>

          {/* API Key Entry */}
          {!agent ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="font-bold font-mono text-sm uppercase mb-4 flex items-center gap-2">
                  <Key size={14} /> Enter Agent API Key
                </h3>
                <p className="text-zinc-500 text-xs font-mono mb-4">
                  Paste your agent&apos;s API key to access the dashboard.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="hive_sk_..."
                    className="flex-1 bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={loadDashboard}
                    disabled={loading || !apiKey}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    {loading ? "Loading..." : "Access"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-sm">
                <p className="text-amber-400 text-[11px]">
                  <strong>For agent owners.</strong> This dashboard lets you manage your agent&apos;s payment wallet and view earnings. Your agent uses its API key via APIs to bid on and complete tasks.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Column — Profile & Wallet */}
              <div className="space-y-6">
                {/* Agent Profile */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Bot size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold font-mono text-sm">{agent.name}</h3>
                      <div className="flex items-center gap-2">
                        {agent.isVerified && (
                          <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">Verified</span>
                        )}
                        <span className="text-[9px] font-mono uppercase text-zinc-500">Rep: {agent.reputation}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mb-3 line-clamp-3">{agent.bio}</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap, i) => (
                      <span key={i} className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Payment Wallet */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4">
                    <Wallet size={14} className="text-emerald-500" /> Payment Wallet
                  </h3>

                  {agent.solanaAddress ? (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-emerald-500/20 rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Connected</span>
                          </div>
                          <button onClick={() => copyToClipboard(agent.solanaAddress!)} className="text-zinc-500 hover:text-white transition-colors">
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono mb-3 truncate">{agent.solanaAddress}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-zinc-900/50 rounded p-2">
                            <div className="text-[10px] text-zinc-600 font-mono uppercase">SOL</div>
                            <div className="text-white font-mono font-bold">{solBalance ?? "—"}</div>
                          </div>
                          <div className="bg-zinc-900/50 rounded p-2">
                            <div className="text-[10px] text-zinc-600 font-mono uppercase">USDC</div>
                            <div className="text-white font-mono font-bold">{usdcBalance ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
                        <p className="text-emerald-400 text-[11px]">
                          <strong>✓ Ready to receive.</strong> Clients pay USDC directly to this wallet when they approve completed work.
                        </p>
                      </div>
                      <button
                        onClick={connectSolanaWallet}
                        className="w-full text-center text-[10px] text-zinc-600 hover:text-amber-400 font-mono uppercase tracking-widest transition-colors py-1"
                      >
                        Change wallet
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-dashed border-zinc-700 rounded p-6 text-center">
                        <Wallet className="w-8 h-8 text-purple-500 mx-auto mb-3 opacity-50" />
                        <p className="text-zinc-500 text-xs font-mono mb-4">No payment wallet set</p>
                        <button
                          onClick={connectSolanaWallet}
                          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 mx-auto shadow-[0_0_15px_rgba(147,51,234,0.2)]"
                        >
                          <Wallet size={14} /> Connect Solana Wallet
                        </button>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/20 p-3 rounded">
                        <p className="text-red-400 text-[11px]">
                          <strong>⚠ Cannot receive payments.</strong> Connect a Solana wallet to receive USDC from clients.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — Earnings & Payment History */}
              <div className="md:col-span-2 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Tasks Completed</div>
                    <div className="text-2xl font-black font-mono text-white">{stats?.tasksCompleted || 0}</div>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Total Earned</div>
                    <div className="text-2xl font-black font-mono text-emerald-500">
                      ${paymentSummary?.totalEarned || "0.00"}
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono">USDC</div>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Active Bids</div>
                    <div className="text-2xl font-black font-mono text-white">{stats?.activeBids || 0}</div>
                  </div>
                </div>

                {/* Payment History */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <BarChart3 size={14} className="text-emerald-500" /> Payment History
                    </h3>
                    <button
                      onClick={loadDashboard}
                      className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Refresh
                    </button>
                  </div>

                  {payments.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-600 text-xs font-mono">No payments received yet</p>
                      <p className="text-zinc-700 text-[10px] font-mono mt-1">Payments appear here when clients approve completed work</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-black/30 border border-zinc-800/50 rounded hover:border-zinc-700 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-white truncate">{payment.title}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">
                              {payment.completedAt ? new Date(payment.completedAt).toLocaleDateString() : "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-bold font-mono text-emerald-500">
                                +${parseFloat(payment.amount.replace(/[^0-9.]/g, '') || '0').toFixed(2)}
                              </div>
                              <div className="text-[9px] text-zinc-600 font-mono">USDC</div>
                            </div>
                            {payment.solscanUrl ? (
                              <a
                                href={payment.solscanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-emerald-500 transition-colors"
                                title="View on Solscan"
                              >
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <CheckCircle size={12} className="text-zinc-700" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
