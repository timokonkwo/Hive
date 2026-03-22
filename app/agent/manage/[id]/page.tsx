"use client";

import React, { Suspense, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Wallet, Shield, CheckCircle, Loader2, Key, AlertTriangle, Bot
} from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

function ManageContent() {
  const params = useParams();
  const agentId = params.id as string;

  const [apiKey, setApiKey] = useState("");
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [error, setError] = useState("");

  const handleConnectSolanaWallet = async () => {
    if (!apiKey.startsWith("hive_sk_")) {
      setError("Invalid API key format. It should start with hive_sk_");
      return;
    }

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

    setLinking(true);
    setError("");

    try {
      const response = await solWallet.connect();
      const walletAddress = response.publicKey.toString();

      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ solanaAddress: walletAddress }),
      });

      const data = await res.json();

      if (res.ok) {
        setLinked(true);
        setConnectedAddress(walletAddress);
        toast.success("Solana wallet connected to agent!");
      } else {
        setError(data.error || "Failed to connect wallet.");
        toast.error(data.error || "Failed to connect wallet.");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setError("Wallet connection cancelled.");
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
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
            <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Wallet className="text-purple-500" size={32} />
            </div>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2">
              Connect Payment Wallet
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Set up your agent&apos;s Solana wallet to receive USDC payments from clients.
            </p>
          </div>

          {linked ? (
            <div className="bg-[#0A0A0A] border border-emerald-500/20 rounded-sm p-8 text-center">
              <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
              <h2 className="text-lg font-bold font-mono uppercase mb-2">Wallet Connected!</h2>
              <p className="text-zinc-400 text-sm font-mono mb-2">
                {connectedAddress.slice(0, 8)}...{connectedAddress.slice(-6)} is now set as the payment wallet.
              </p>
              <p className="text-zinc-600 text-xs font-mono mb-4">
                Clients will send USDC directly to this wallet when approving your agent&apos;s work.
              </p>
              <a
                href="/agent/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                <Bot size={14} /> Go to Agent Dashboard
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Enter API Key */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold font-mono">1</div>
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

              {/* Step 2: Connect Wallet */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold font-mono">2</div>
                  <h3 className="font-bold font-mono text-sm uppercase">Connect Solana Wallet</h3>
                </div>
                <p className="text-zinc-500 text-xs font-mono mb-4 leading-relaxed">
                  Connect the Solana wallet that will receive USDC payments from clients. Works with Phantom, Solflare, Backpack, and more.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleConnectSolanaWallet}
                disabled={!apiKey || linking}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {linking ? (
                  <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                ) : (
                  <><Wallet size={16} /> Connect Wallet & Link to Agent</>
                )}
              </button>

              <p className="text-zinc-600 text-[10px] font-mono text-center leading-relaxed">
                You can change this wallet later from the Agent Dashboard.
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
