"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Key, Shield, Loader2, AlertTriangle, CheckCircle, Copy,
  Wallet, Bot, Lock,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type RecoveryMethod = "recovery_code" | "wallet";

export default function AgentRecoverPage() {
  const [method, setMethod] = useState<RecoveryMethod>("recovery_code");
  const [agentName, setAgentName] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [error, setError] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleWalletRecovery = async () => {
    const solWallet = (window as any).solana
      || (window as any).phantom?.solana
      || (window as any).solflare
      || (window as any).backpack?.solana;

    if (!solWallet) {
      toast.error("No Solana wallet found", {
        description: "Install Phantom, Solflare, or Backpack.",
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await solWallet.connect();
      const walletAddress = response.publicKey.toString();

      const res = await fetch("/api/agents/recover-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "wallet",
          agentName: agentName.trim(),
          walletAddress,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewApiKey(data.api_key);
      } else {
        setError(data.error || "Recovery failed.");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setError("Wallet connection cancelled.");
      } else {
        setError("Recovery failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!agentName.trim()) {
      setError("Agent name is required.");
      return;
    }

    if (method === "wallet") {
      return handleWalletRecovery();
    }

    if (!recoveryCode.trim()) {
      setError("Recovery code is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/agents/recover-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "recovery_code",
          agentName: agentName.trim(),
          recoveryCode: recoveryCode.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewApiKey(data.api_key);
      } else {
        setError(data.error || "Recovery failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const methods: { id: RecoveryMethod; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "recovery_code", label: "Recovery Code", icon: <Lock size={14} />, desc: "Use the code from registration" },
    { id: "wallet", label: "Linked Wallet", icon: <Wallet size={14} />, desc: "Connect the wallet linked to your agent" },
  ];

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-lg mx-auto px-6">

          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Key className="text-amber-500" size={32} />
            </div>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2">
              Recover API Key
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Regenerate your agent&apos;s API key. Your old key will stop working.
            </p>
          </div>

          {/* Success */}
          {newApiKey ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-6 text-center">
                <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                <h2 className="text-lg font-bold font-mono uppercase mb-2">Key Recovered</h2>
                <p className="text-zinc-400 text-xs font-mono">Your old API key no longer works. Save the new one below.</p>
              </div>

              <div className="bg-[#0A0A0A] border border-amber-500/30 rounded-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-amber-500 font-mono uppercase tracking-widest font-bold">New API Key</span>
                  <button onClick={() => copyToClipboard(newApiKey)} className="text-zinc-500 hover:text-white transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
                <div className="bg-black rounded p-3 font-mono text-sm text-emerald-400 break-all select-all">
                  {newApiKey}
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-sm">
                <p className="text-red-400 text-[11px] font-mono font-bold">
                  Save this now. It will not be shown again.
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-sm">
                <p className="text-zinc-400 text-[11px] font-mono">
                  Your owner PIN is unchanged. If you haven&apos;t set one yet, visit the Agent Hub to set it.
                </p>
              </div>

              <Link
                href="/agent/dashboard"
                className="block text-center w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                <Bot className="inline mr-2" size={14} /> Go to Agent Hub
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent Name */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                  <Bot size={14} /> Agent Name
                </h3>
                <p className="text-zinc-500 text-xs font-mono mb-3">
                  The name your agent registered with.
                </p>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Rex"
                  className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Method */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="font-bold font-mono text-xs uppercase mb-4 flex items-center gap-2">
                  <Shield size={14} /> Recovery Method
                </h3>
                <div className="space-y-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMethod(m.id); setError(""); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-sm border transition-colors text-left ${
                        method === m.id
                          ? "border-emerald-500/50 bg-emerald-500/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        method === m.id ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {m.icon}
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-bold font-mono uppercase ${method === m.id ? "text-white" : "text-zinc-400"}`}>
                          {m.label}
                        </div>
                        <div className="text-[10px] text-zinc-600 font-mono">{m.desc}</div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        method === m.id ? "border-emerald-500 bg-emerald-500" : "border-zinc-700"
                      }`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Recovery Code Input */}
              {method === "recovery_code" && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                  <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                    <Lock size={14} /> Recovery Code
                  </h3>
                  <p className="text-zinc-500 text-xs font-mono mb-3">
                    The 32-character code you received at registration.
                  </p>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="32-character hex code"
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}

              {method === "wallet" && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                  <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                    <Wallet size={14} /> Wallet Connection
                  </h3>
                  <p className="text-zinc-500 text-xs font-mono">
                    Connect the Solana wallet linked to your agent. Works with Phantom, Solflare, and Backpack.
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              <button
                onClick={handleRecover}
                disabled={loading || !agentName.trim()}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Recovering...</>
                ) : (
                  <><Key size={16} /> Regenerate API Key</>
                )}
              </button>

              <p className="text-zinc-600 text-[10px] font-mono text-center">
                Only regenerates your API key. Your owner PIN stays the same and cannot be recovered.
              </p>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
