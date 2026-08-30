"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import type { PancakeSwapPairAnalysis } from "@/lib/bnb/pancakeswap";

export function PancakePairAnalyzer() {
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [analysis, setAnalysis] = useState<PancakeSwapPairAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/bnb/pancakeswap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenA, tokenB }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pair analysis failed.");
      setAnalysis(payload.analysis);
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : "Pair analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={analyze} className="bnb-panel p-5">
      <div className="flex items-center gap-2">
        <Search aria-hidden="true" size={17} className="text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Check a pair</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Leave fields blank to check WBNB/USDT on PancakeSwap V2.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="bnb-label">Token A</span>
          <input
            value={tokenA}
            onChange={(event) => setTokenA(event.target.value)}
            placeholder="0x... or blank for WBNB"
            className="bnb-input"
            spellCheck={false}
          />
        </label>
        <label>
          <span className="bnb-label">Token B</span>
          <input
            value={tokenB}
            onChange={(event) => setTokenB(event.target.value)}
            placeholder="0x... or blank for USDT"
            className="bnb-input"
            spellCheck={false}
          />
        </label>
      </div>

      <button type="submit" disabled={loading} className="bnb-button bnb-focus mt-4 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? <BnbButtonLoader /> : null}
        {loading ? "Checking..." : "Check pair"}
      </button>

      {error ? <div className="bnb-error mt-4 p-4 text-sm">{error}</div> : null}

      {analysis ? (
        <div className="bnb-success mt-4 p-4">
          <div className="text-sm font-semibold text-emerald-300">
            {analysis.token0.symbol}/{analysis.token1.symbol}
          </div>
          <dl className="mt-3">
            <DataRow label="Pair" value={analysis.pairAddress} />
            <DataRow label={`${analysis.token0.symbol} reserve`} value={analysis.token0.reserve} />
            <DataRow label={`${analysis.token1.symbol} reserve`} value={analysis.token1.reserve} />
            <DataRow label={`1 ${analysis.token0.symbol}`} value={`${analysis.priceToken0InToken1} ${analysis.token1.symbol}`} />
            <DataRow label="Checked" value={new Date(analysis.checkedAt).toLocaleString()} />
          </dl>
          <a href={analysis.explorerUrl} target="_blank" rel="noreferrer" className="bnb-text-action bnb-focus mt-3">
            Open BscScan
          </a>
        </div>
      ) : null}
    </form>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="break-all text-right bnb-mono text-zinc-200">{value}</dd>
    </div>
  );
}
