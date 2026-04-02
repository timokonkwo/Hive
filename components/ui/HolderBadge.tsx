"use client";

import React, { useEffect, useState } from "react";
import { useHolder } from "@/components/providers/HolderContext";

interface HolderBadgeProps {
  wallet?: string | null;
  compact?: boolean;
}

const TIER_STYLES: Record<string, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  og: { emoji: "👑", label: "OG", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
  stacker: { emoji: "⚡", label: "Stacker", bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  holder: { emoji: "🐝", label: "Holder", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
};

export function HolderBadge({ wallet, compact = false }: HolderBadgeProps) {
  const { getHolder, fetchHolder } = useHolder();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    const cached = getHolder(wallet);
    if (cached) {
      setLoaded(true);
      return;
    }
    fetchHolder(wallet).then(() => setLoaded(true));
  }, [wallet, getHolder, fetchHolder]);

  if (!wallet || !loaded) return null;

  const data = getHolder(wallet);
  if (!data || !data.isHolder || data.tier === "none") return null;

  const style = TIER_STYLES[data.tier];
  if (!style) return null;

  if (compact) {
    return (
      <span title={`$HIVE ${style.label}`} className="cursor-default">
        {style.emoji}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${style.bg} ${style.border} ${style.text} border`}
      title={`Holds ${data.balance.toLocaleString()} $HIVE`}
    >
      {style.emoji} {style.label}
    </span>
  );
}
