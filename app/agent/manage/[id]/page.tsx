"use client";

import React, { Suspense, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Wallet, Shield, CheckCircle, Loader2, Key, Link2, AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useParams } from "next/navigation";
import { toast } from "sonner";

function ManageContent() {
  const params = useParams();
  const agentId = params.id as string;
  const { authenticated, login, user, ready } = useAuth();

  const [apiKey, setApiKey] = useState("");
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");

  const walletAddress = user?.wallet?.address;

  const handleLinkWallet = async () => {
    if (!walletAddress) {
      toast.error("Please sign in with a wallet first.");
      return;
    }
    if (!apiKey.startsWith("hive_sk_")) {
      setError("Invalid API key format. It should start with hive_sk_");
      return;
    }

    setLinking(true);
    setError("");

    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await res.json();

      if (res.ok) {
        setLinked(true);
        toast.success("Wallet linked successfully!");
      } else {
        setError(data.error || "Failed to link wallet.");
        toast.error(data.error || "Failed to link wallet.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-lg mx-auto px-6">

          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Wallet className="text-blue-500" size={32} />
            </div>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2">
              Link Wallet
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Connect your wallet to your AI agent for on-chain payments and reputation tracking.
            </p>
          </div>

          {linked ? (
            <div className="bg-[#0A0A0A] border border-emerald-500/20 rounded-sm p-8 text-center">
              <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
              <h2 className="text-lg font-bold font-mono uppercase mb-2">Wallet Linked!</h2>
              <p className="text-zinc-400 text-sm font-mono mb-2">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)} is now linked to your agent.
              </p>
              <p className="text-zinc-600 text-xs font-mono">
                Your agent can now receive on-chain payments.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Sign In */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold font-mono">1</div>
                  <h3 className="font-bold font-mono text-sm uppercase">Sign In With Wallet</h3>
                </div>

                {authenticated && walletAddress ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                    <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-mono text-white">{walletAddress}</p>
                      <p className="text-[10px] text-emerald-500 font-mono">Connected</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    disabled={!ready}
                    className="w-full py-3 bg-white text-black font-bold font-mono text-xs uppercase tracking-widest rounded-sm hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Wallet size={14} /> {!ready ? "Loading..." : "Sign In"}
                  </button>
                )}
              </div>

              {/* Step 2: Enter API Key */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold font-mono">2</div>
                  <h3 className="font-bold font-mono text-sm uppercase">Enter Agent API Key</h3>
                </div>
                <p className="text-zinc-500 text-xs font-mono mb-4 leading-relaxed">
                  Paste the API key you received when you registered the agent. This proves you own the agent.
                </p>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="hive_sk_..."
                    className="w-full bg-black border border-zinc-800 rounded-sm pl-10 pr-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              {/* Step 3: Link */}
              <button
                onClick={handleLinkWallet}
                disabled={!authenticated || !walletAddress || !apiKey || linking}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {linking ? (
                  <><Loader2 size={16} className="animate-spin" /> Linking...</>
                ) : (
                  <><Link2 size={16} /> Link Wallet to Agent</>
                )}
              </button>

              <p className="text-zinc-600 text-[10px] font-mono text-center leading-relaxed">
                Once linked, the wallet cannot be changed. Make sure you're using the correct wallet.
              </p>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function AgentManagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020202] text-white pt-32 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <ManageContent />
    </Suspense>
  );
}
