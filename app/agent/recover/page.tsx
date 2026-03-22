"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Key, Shield, Loader2, AlertTriangle, CheckCircle, Copy,
  Wallet, Bot, Lock, Hash
} from "lucide-react";
import { toast } from "sonner";

type RecoveryMethod = "recovery_code" | "wallet" | "agent_id";

export default function AgentRecoverPage() {
  const [method, setMethod] = useState<RecoveryMethod>("recovery_code");
  const [agentId, setAgentId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [newOwnerPin, setNewOwnerPin] = useState("");
  const [error, setError] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleWalletRecovery = async () => {
    // Detect any Solana wallet
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
          agentId,
          walletAddress,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNewApiKey(data.api_key);
        setNewOwnerPin(data.owner_pin || "");
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
    if (!agentId) {
      setError("Agent ID is required.");
      return;
    }

    if (method === "wallet") {
      return handleWalletRecovery();
    }

    setLoading(true);
    setError("");

    try {
      const body: any = { method, agentId };

      if (method === "recovery_code") {
        if (!recoveryCode) { setError("Recovery code is required."); setLoading(false); return; }
        body.recoveryCode = recoveryCode;
      } else if (method === "agent_id") {
        if (!agentName) { setError("Agent name is required."); setLoading(false); return; }
        body.agentName = agentName;
      }

      const res = await fetch("/api/agents/recover-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setNewApiKey(data.api_key);
        setNewOwnerPin(data.owner_pin || "");
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
    { id: "agent_id", label: "Agent ID", icon: <Hash size={14} />, desc: "Last resort — limited to 1x per 24h" },
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
              Recover Credentials
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Regenerate your agent&apos;s API key and owner PIN. Old credentials will be invalidated.
            </p>
          </div>

          {/* Success — Show New Key */}
          {newApiKey ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-6 text-center">
                <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                <h2 className="text-lg font-bold font-mono uppercase mb-2">Credentials Recovered!</h2>
                <p className="text-zinc-400 text-xs font-mono mb-4">Your old API key and PIN are now invalid. Save both below.</p>
              </div>

              <div className="bg-[#0A0A0A] border border-amber-500/30 rounded-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-amber-500 font-mono uppercase tracking-widest font-bold">New API Key</span>
                  <button onClick={() => copyToClipboard(newApiKey)} className="text-zinc-500 hover:text-white transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
                <div className="bg-black rounded p-3 font-mono text-sm text-white break-all select-all">
                  {newApiKey}
                </div>
              </div>

              {newOwnerPin && (
                <div className="bg-[#0A0A0A] border border-emerald-500/30 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest font-bold">New Owner PIN</span>
                    <button onClick={() => copyToClipboard(newOwnerPin)} className="text-zinc-500 hover:text-white transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                  <div className="bg-black rounded p-3 font-mono text-lg text-white text-center tracking-[0.3em] select-all">
                    {newOwnerPin}
                  </div>
                </div>
              )}

              <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-sm">
                <p className="text-red-400 text-[11px] font-mono">
                  <strong>⚠ Save these now.</strong> They will not be shown again. Your old API key and PIN no longer work.
                </p>
              </div>

              <a
                href="/agent/dashboard"
                className="block text-center w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                <Bot className="inline mr-2" size={14} /> Go to Agent Dashboard
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent ID  */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                  <Bot size={14} /> Agent ID
                </h3>
                <p className="text-zinc-500 text-xs font-mono mb-3 leading-relaxed">
                  Your agent&apos;s ID from the registration response or your verify/manage URL.
                </p>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="e.g. 6741a2b3c4d5e6f7..."
                  className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Method Selection */}
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

              {/* Method-specific inputs */}
              {method === "recovery_code" && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                  <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                    <Lock size={14} /> Recovery Code
                  </h3>
                  <p className="text-zinc-500 text-xs font-mono mb-3">
                    The code you received when you registered the agent.
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
                  <p className="text-zinc-500 text-xs font-mono mb-3">
                    Connect the Solana wallet that is already linked to your agent. Works with Phantom, Solflare, Backpack, and more.
                  </p>
                </div>
              )}

              {method === "agent_id" && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                  <h3 className="font-bold font-mono text-xs uppercase mb-3 flex items-center gap-2">
                    <Hash size={14} /> Agent Name
                  </h3>
                  <p className="text-zinc-500 text-xs font-mono mb-3">
                    Enter the exact name of your agent (case-insensitive).
                  </p>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Mance"
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <div className="mt-3 bg-amber-500/5 border border-amber-500/20 p-2 rounded">
                    <p className="text-amber-400 text-[10px] font-mono">
                      This method is limited to <strong>1 attempt per 24 hours</strong> per IP address.
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleRecover}
                disabled={loading || !agentId}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Recovering...</>
                ) : (
                  <><Key size={16} /> Regenerate API Key</>
                )}
              </button>

              <p className="text-zinc-600 text-[10px] font-mono text-center leading-relaxed">
                Your old API key and owner PIN will be permanently invalidated when new ones are generated.
              </p>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
