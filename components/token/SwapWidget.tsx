"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDown, Loader2, ExternalLink, RefreshCw } from "lucide-react";

const HIVE_CA = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const LAMPORTS_PER_SOL = 1_000_000_000;

interface SwapQuote {
  success: boolean;
  response?: {
    inputAmount: string;
    outputAmount: string;
    priceImpact: string;
    slippage: string;
  };
}

export function SwapWidget() {
  const [solAmount, setSolAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState("");
  const [swapResult, setSwapResult] = useState<string | null>(null);

  // Debounced quote fetch
  const fetchQuote = useCallback(async (amount: string) => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setQuote(null);
      return;
    }

    setLoadingQuote(true);
    setError("");

    try {
      const lamports = Math.floor(numAmount * LAMPORTS_PER_SOL);
      const res = await fetch(`/api/bags/quote?amount=${lamports}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch quote");
        setQuote(null);
      } else {
        setQuote(data);
      }
    } catch {
      setError("Failed to fetch quote");
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchQuote(solAmount), 500);
    return () => clearTimeout(timeout);
  }, [solAmount, fetchQuote]);

  const formatHive = (raw: string | undefined): string => {
    if (!raw) return "0";
    const num = parseInt(raw) / 1_000_000; // Assuming 6 decimals
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const handleSwap = async () => {
    setError("");
    setSwapping(true);

    try {
      // Check for Phantom/Solflare wallet
      const solana = (window as any).solana || (window as any).phantom?.solana;

      if (!solana?.isPhantom && !solana?.isSolflare) {
        setError("Please install Phantom or Solflare wallet");
        setSwapping(false);
        return;
      }

      // Connect wallet if not connected
      if (!solana.isConnected) {
        await solana.connect();
      }

      const wallet = solana.publicKey?.toString();
      if (!wallet) {
        setError("Could not get wallet address");
        setSwapping(false);
        return;
      }

      const lamports = Math.floor(parseFloat(solAmount) * LAMPORTS_PER_SOL);

      // Get swap transaction from our API
      const swapRes = await fetch("/api/bags/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: String(lamports), wallet }),
      });

      const swapData = await swapRes.json();

      if (!swapRes.ok) {
        setError(swapData.error || "Failed to create swap transaction");
        setSwapping(false);
        return;
      }

      // Sign and send the transaction
      if (swapData.response?.transaction) {
        const { Transaction } = await import("@solana/web3.js");
        const tx = Transaction.from(
          Buffer.from(swapData.response.transaction, "base64")
        );
        const signed = await solana.signTransaction(tx);
        const connection = new (await import("@solana/web3.js")).Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
        );
        const sig = await connection.sendRawTransaction(signed.serialize());
        setSwapResult(sig);
        setSolAmount("");
        setQuote(null);
      } else {
        setError("No transaction returned from swap API");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        setError("Transaction cancelled");
      } else {
        setError(err.message || "Swap failed");
      }
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-sm">Buy $HIVE</h3>
        <button
          onClick={() => fetchQuote(solAmount)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh quote"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* SOL Input */}
      <div className="relative mb-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={solAmount}
          onChange={(e) => setSolAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-black border border-white/10 rounded-sm px-4 py-3 pr-16 text-white font-mono text-lg focus:outline-none focus:border-emerald-500/30 transition-colors"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm font-bold">
          SOL
        </span>
      </div>

      {/* Arrow */}
      <div className="flex justify-center my-2">
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
          <ArrowDown size={14} className="text-zinc-400" />
        </div>
      </div>

      {/* HIVE Output */}
      <div className="relative mb-4">
        <div className="w-full bg-black/50 border border-white/5 rounded-sm px-4 py-3 pr-16 text-white font-mono text-lg min-h-[50px] flex items-center">
          {loadingQuote ? (
            <Loader2 size={16} className="text-emerald-500 animate-spin" />
          ) : quote?.response?.outputAmount ? (
            <span className="text-emerald-400">
              {formatHive(quote.response.outputAmount)}
            </span>
          ) : (
            <span className="text-zinc-700">0.00</span>
          )}
        </div>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono text-sm font-bold">
          HIVE
        </span>
      </div>

      {/* Quote details */}
      {quote?.response && !loadingQuote && (
        <div className="mb-4 space-y-1">
          {quote.response.priceImpact && (
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-zinc-600">Price Impact</span>
              <span className="text-zinc-400">{quote.response.priceImpact}%</span>
            </div>
          )}
          {quote.response.slippage && (
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-zinc-600">Slippage</span>
              <span className="text-zinc-400">{quote.response.slippage}%</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/5 border border-red-500/20 rounded-sm text-red-400 text-[11px] font-mono">
          {error}
        </div>
      )}

      {/* Swap success */}
      {swapResult && (
        <div className="mb-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
          <p className="text-emerald-400 text-[11px] font-mono mb-1">Swap successful!</p>
          <a
            href={`https://solscan.io/tx/${swapResult}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            View transaction <ExternalLink size={9} />
          </a>
        </div>
      )}

      {/* Buy button */}
      <button
        onClick={handleSwap}
        disabled={!solAmount || parseFloat(solAmount) <= 0 || swapping || loadingQuote}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
      >
        {swapping ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Swapping...
          </>
        ) : (
          "Buy $HIVE"
        )}
      </button>

      {/* Fallback link */}
      <div className="mt-3 text-center">
        <a
          href={`https://bags.fm/${HIVE_CA}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-1"
        >
          or trade on bags.fm <ExternalLink size={8} />
        </a>
      </div>
    </div>
  );
}
