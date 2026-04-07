"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDown, Loader2, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

const HIVE_CA = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const LAMPORTS_PER_SOL = 1_000_000_000;

interface QuoteResponse {
  success: boolean;
  response?: {
    outAmount: string;
    inAmount: string;
    priceImpactPct: string;
    slippageBps: number;
    routePlan?: Array<{ venue: string; outputMintDecimals: number }>;
  };
  error?: string;
}

export function SwapWidget() {
  const [solAmount, setSolAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState("");
  const [swapResult, setSwapResult] = useState<string | null>(null);

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
    const timeout = setTimeout(() => fetchQuote(solAmount), 600);
    return () => clearTimeout(timeout);
  }, [solAmount, fetchQuote]);

  const getDecimals = (): number => {
    return quote?.response?.routePlan?.[0]?.outputMintDecimals ?? 9;
  };

  const formatHive = (raw: string | undefined): string => {
    if (!raw) return "0";
    const decimals = getDecimals();
    const num = parseInt(raw) / Math.pow(10, decimals);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const formatPriceImpact = (pct: string | undefined): string => {
    if (!pct) return "< 0.01%";
    const num = parseFloat(pct);
    if (num < 0.01) return "< 0.01%";
    return `${num.toFixed(2)}%`;
  };

  const handleSwap = async () => {
    setError("");
    setSwapping(true);

    try {
      const solana = (window as any).solana || (window as any).phantom?.solana;

      if (!solana?.isPhantom && !solana?.isSolflare) {
        setError("Please install Phantom or Solflare wallet");
        setSwapping(false);
        return;
      }

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

  const hiveOutput = quote?.response?.outAmount;
  const hasQuote = !!hiveOutput && !loadingQuote;
  const priceImpact = quote?.response?.priceImpactPct;
  const slippageBps = quote?.response?.slippageBps;

  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute -inset-px bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent rounded-xl blur-sm opacity-60" />
      
      <div className="relative bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-white font-bold text-base">Buy $HIVE</h3>
            <p className="text-zinc-600 text-[10px] font-mono mt-0.5">Swap SOL → HIVE via Bags</p>
          </div>
          <button
            onClick={() => fetchQuote(solAmount)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-500 hover:text-white hover:bg-zinc-700/50 transition-all"
            title="Refresh quote"
          >
            <RefreshCw size={13} className={loadingQuote ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Swap form */}
        <div className="px-5 pb-5">
          {/* Input: SOL */}
          <div className="bg-black/60 border border-white/5 rounded-lg p-4 mb-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">You pay</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white font-mono text-2xl focus:outline-none placeholder:text-zinc-700 min-w-0"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 rounded-lg shrink-0">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                <span className="text-white font-bold text-sm font-mono">SOL</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shadow-lg">
              <ArrowDown size={15} className="text-zinc-400" />
            </div>
          </div>

          {/* Output: HIVE */}
          <div className="bg-black/60 border border-white/5 rounded-lg p-4 mt-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-h-[36px] flex items-center">
                {loadingQuote ? (
                  <Loader2 size={20} className="text-emerald-500 animate-spin" />
                ) : hasQuote ? (
                  <span className="text-emerald-400 font-mono text-2xl font-bold">
                    {formatHive(hiveOutput)}
                  </span>
                ) : (
                  <span className="text-zinc-700 font-mono text-2xl">0.00</span>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[8px] font-bold text-black">H</div>
                <span className="text-emerald-400 font-bold text-sm font-mono">HIVE</span>
              </div>
            </div>
          </div>

          {/* Quote details */}
          {hasQuote && (
            <div className="mt-3 px-1 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-zinc-600">Price Impact</span>
                <span className={`${parseFloat(priceImpact || '0') > 1 ? 'text-amber-400' : 'text-zinc-400'}`}>
                  {formatPriceImpact(priceImpact)}
                </span>
              </div>
              {slippageBps !== undefined && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-600">Max Slippage</span>
                  <span className="text-zinc-400">{(slippageBps / 100).toFixed(1)}%</span>
                </div>
              )}
              {quote?.response?.routePlan?.[0]?.venue && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-600">Route</span>
                  <span className="text-zinc-400">{quote.response.routePlan[0].venue}</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 bg-red-500/5 border border-red-500/15 rounded-lg flex items-start gap-2">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-red-400 text-[11px] font-mono leading-tight">{error}</span>
            </div>
          )}

          {/* Success */}
          {swapResult && (
            <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
              <p className="text-emerald-400 text-[11px] font-mono font-bold mb-1">Swap successful!</p>
              <a
                href={`https://solscan.io/tx/${swapResult}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                View on Solscan <ExternalLink size={9} />
              </a>
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={handleSwap}
            disabled={!solAmount || parseFloat(solAmount) <= 0 || swapping || loadingQuote}
            className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            {swapping ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Swapping...
              </>
            ) : (
              "Buy $HIVE"
            )}
          </button>

          {/* Fallback */}
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
      </div>
    </div>
  );
}
