"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDown, Loader2, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

const HIVE_CA = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const LAMPORTS_PER_SOL = 1_000_000_000;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

interface QuoteResponse {
  success: boolean;
  requestId?: string;
  response?: {
    requestId?: string;
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
  const [walletConnected, setWalletConnected] = useState(false);
  const [lastQuoteResponse, setLastQuoteResponse] = useState<any>(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const phantom = (window as any).phantom?.solana;
    const solflare = (window as any).solflare;
    const solana = phantom || solflare || (window as any).solana;
    if (solana?.publicKey || solana?.isConnected) {
      setWalletConnected(true);
    }
  }, []);

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
        setLastQuoteResponse(null);
      } else {
        setQuote(data);
        // Store the full quote response for the swap call
        setLastQuoteResponse(data.response || null);
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
      const phantom = (window as any).phantom?.solana;
      const solflare = (window as any).solflare;
      const solana = phantom || solflare || (window as any).solana;

      if (!solana) {
        window.open("https://phantom.app/", "_blank");
        setError("No Solana wallet found. Install Phantom to continue.");
        setSwapping(false);
        return;
      }

      let wallet: string | null = solana.publicKey?.toString() || null;
      
      if (!wallet) {
        try {
          const resp = await solana.connect({ onlyIfTrusted: true });
          wallet = resp?.publicKey?.toString() || null;
        } catch {
          // Silent connect failed: do a full connect with popup
          try {
            const resp = await solana.connect();
            wallet = resp?.publicKey?.toString() || null;
          } catch {
            setError("Please approve the wallet connection in your Phantom extension.");
            setSwapping(false);
            return;
          }
        }
      }

      if (!wallet) {
        setError("Could not get wallet address. Please unlock your wallet and try again.");
        setSwapping(false);
        return;
      }

      setWalletConnected(true);

      if (!solAmount || parseFloat(solAmount) <= 0) {
        setSwapping(false);
        return;
      }

      if (!lastQuoteResponse) {
        setError("Please wait for a quote before swapping.");
        setSwapping(false);
        return;
      }

      const swapRes = await fetch("/api/bags/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteResponse: lastQuoteResponse, wallet }),
      });

      const swapData = await swapRes.json();

      if (!swapRes.ok) {
        setError(swapData.error || "Failed to create swap transaction");
        setSwapping(false);
        return;
      }

      const swapTx = swapData.response?.swapTransaction || swapData.swapTransaction;

      if (swapTx) {
        const { VersionedTransaction } = await import("@solana/web3.js");
        const bs58 = await import("bs58");

        const decodedTransaction = bs58.default.decode(swapTx);
        const tx = VersionedTransaction.deserialize(decodedTransaction);
        const signed = await solana.signTransaction(tx);
        const serialized = signed.serialize();
        const serializedBase64 = bytesToBase64(serialized);

        const sendRes = await fetch("/api/solana/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [
              serializedBase64,
              { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3, encoding: "base64" },
            ],
          }),
        });
        const sendData = await sendRes.json().catch(() => ({}));
        if (!sendRes.ok) {
          throw new Error(sendData.error?.message || sendData.error || "Transaction send failed");
        }
        const sig = sendData.result;
        if (!sig) {
          throw new Error(sendData.error?.message || "Transaction send failed");
        }
        setSwapResult(sig);
        setSolAmount("");
        setQuote(null);
      } else {
        console.error("[SWAP] Response shape:", JSON.stringify(Object.keys(swapData)));
        setError("No transaction returned from swap API");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) {
        setError("Transaction cancelled");
      } else {
        console.error("[SWAP]", err);
        setError("Swap failed. Please try again or use bags.fm.");
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
      <div className="absolute -inset-px bg-gradient-to-b from-[#00C805]/20 via-transparent to-transparent rounded-2xl blur-sm opacity-60 pointer-events-none" />
      
      <div className="relative robin-card p-0 overflow-hidden bg-token-surface border border-token-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-token-border bg-token-subtle/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00C805] animate-pulse" />
              <h3 className="text-token-text font-bold text-base tracking-tight">Buy $HIVE</h3>
            </div>
            <p className="text-token-dim text-[11px] font-mono mt-0.5">Instant settlement via Bags router</p>
          </div>
          <button
            onClick={() => fetchQuote(solAmount)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-token-border bg-token-surface text-token-dim hover:text-token-text hover:border-token-border-strong transition-all"
            title="Refresh quote"
            aria-label="Refresh quote"
          >
            <RefreshCw size={13} className={loadingQuote ? "animate-spin text-[#00C805]" : ""} />
          </button>
        </div>

        {/* Swap form */}
        <div className="p-6 space-y-3">
          {/* Input: SOL */}
          <div className="bg-token-subtle border border-token-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-token-dim uppercase tracking-widest">You Pay</span>
              <span className="text-[10px] font-mono text-token-dim">Solana Network</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-token-text font-mono text-2xl font-bold focus:outline-none placeholder:text-token-dim/40 min-w-0"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-token-surface border border-token-border rounded-lg shrink-0">
                <svg width="18" height="18" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="64" cy="64" r="64" fill="black"/>
                  <path d="M36.7 87.3a2.4 2.4 0 011.7-.7h56.9c1.1 0 1.6 1.3.8 2.1l-11.8 11.8a2.4 2.4 0 01-1.7.7H25.7c-1.1 0-1.6-1.3-.8-2.1L36.7 87.3z" fill="url(#sol_a)"/>
                  <path d="M36.7 27.5a2.5 2.5 0 011.7-.7h56.9c1.1 0 1.6 1.3.8 2.1L84.3 40.7a2.4 2.4 0 01-1.7.7H25.7c-1.1 0-1.6-1.3-.8-2.1l11.8-11.8z" fill="url(#sol_b)"/>
                  <path d="M84.3 57.2a2.4 2.4 0 00-1.7-.7H25.7c-1.1 0-1.6 1.3-.8 2.1l11.8 11.8c.5.4 1 .7 1.7.7h56.9c1.1 0 1.6-1.3.8-2.1L84.3 57.2z" fill="url(#sol_c)"/>
                  <defs>
                    <linearGradient id="sol_a" x1="89.5" y1="18.5" x2="29.5" y2="109.5" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
                    <linearGradient id="sol_b" x1="89.5" y1="18.5" x2="29.5" y2="109.5" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
                    <linearGradient id="sol_c" x1="89.5" y1="18.5" x2="29.5" y2="109.5" gradientUnits="userSpaceOnUse"><stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/></linearGradient>
                  </defs>
                </svg>
                <span className="text-token-text font-bold text-xs font-mono">SOL</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-8 h-8 rounded-full bg-token-surface border border-token-border flex items-center justify-center shadow-md text-token-dim">
              <ArrowDown size={14} />
            </div>
          </div>

          {/* Output: HIVE */}
          <div className="bg-token-subtle border border-token-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-token-dim uppercase tracking-widest">You Receive</span>
              <span className="text-[10px] font-mono text-[#00C805] font-semibold">Verified Token</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-h-[36px] flex items-center">
                {loadingQuote ? (
                  <Loader2 size={20} className="text-[#00C805] animate-spin" />
                ) : hasQuote ? (
                  <span className="text-[#00C805] font-mono text-2xl font-black">
                    {formatHive(hiveOutput)}
                  </span>
                ) : (
                  <span className="text-token-dim/40 font-mono text-2xl font-bold">0.00</span>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00C805]/10 border border-[#00C805]/30 rounded-lg shrink-0">
                <div className="w-5 h-5 rounded-full bg-[#00C805] flex items-center justify-center text-[9px] font-black text-black">
                  H
                </div>
                <span className="text-token-text font-bold text-xs font-mono">HIVE</span>
              </div>
            </div>
          </div>

          {/* Quote details */}
          {hasQuote && (
            <div className="p-3 bg-token-surface rounded-xl border border-token-border space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-token-dim">Price Impact</span>
                <span className={parseFloat(priceImpact || "0") > 1 ? "text-amber-500 font-semibold" : "text-token-text font-semibold"}>
                  {formatPriceImpact(priceImpact)}
                </span>
              </div>
              {slippageBps !== undefined && (
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-token-dim">Max Slippage</span>
                  <span className="text-token-text font-semibold">{(slippageBps / 100).toFixed(1)}%</span>
                </div>
              )}
              {quote?.response?.routePlan?.[0]?.venue && (
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-token-dim">Route Venue</span>
                  <span className="text-token-text font-semibold">{quote.response.routePlan[0].venue}</span>
                </div>
              )}
            </div>
          )}

          {/* Error notification */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <span className="text-red-500 text-[11px] font-mono leading-tight">{error}</span>
            </div>
          )}

          {/* Success confirmation */}
          {swapResult && (
            <div className="p-3 bg-[#00C805]/10 border border-[#00C805]/30 rounded-xl">
              <div className="flex items-center gap-1.5 text-[#00C805] text-[11px] font-mono font-bold mb-1">
                <CheckCircle2 size={13} />
                <span>Swap executed successfully</span>
              </div>
              <a
                href={`https://solscan.io/tx/${swapResult}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-token-dim hover:text-token-text flex items-center gap-1 transition-colors"
              >
                Inspect on Solscan <ExternalLink size={10} />
              </a>
            </div>
          )}

          {/* Execution CTA button */}
          <button
            onClick={handleSwap}
            disabled={(walletConnected && (!solAmount || parseFloat(solAmount) <= 0)) || swapping || loadingQuote}
            className="w-full mt-2 py-3.5 bg-[#00C805] hover:bg-[#00B004] active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(0,200,5,0.25)]"
          >
            {swapping ? (
              <>
                <Loader2 size={14} className="animate-spin text-black" />
                <span>Broadcasting Transaction...</span>
              </>
            ) : walletConnected ? (
              "Execute Swap"
            ) : (
              "Connect Solana Wallet"
            )}
          </button>

          {/* Fallback link */}
          <div className="pt-2 text-center">
            <a
              href={`https://bags.fm/${HIVE_CA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-token-dim hover:text-token-text transition-colors inline-flex items-center gap-1.5"
            >
              <span>Secondary liquidity pool on bags.fm</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
