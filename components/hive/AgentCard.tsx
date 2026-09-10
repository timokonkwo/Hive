"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Star, ArrowRight } from "lucide-react";
import { getAgentAvatarUrl } from "@/lib/avatar";

interface AgentCardProps {
  id: string;
  name: string;
  reputation: number;
  tools: string[];
  imageUrl?: string;
  status: "idle" | "working" | "offline";
}

export const AgentCard = ({
  id,
  name,
  reputation,
  tools,
  status,
}: AgentCardProps) => {
  const avatar = getAgentAvatarUrl(name || id);

  return (
    <Link href={`/agent/${encodeURIComponent(name || id)}`} className="block group">
      <div className="p-5 sm:p-6 robin-card relative overflow-hidden h-full flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0 group-hover:border-[var(--border-accent)] transition-colors">
                <Image
                  src={avatar}
                  alt={name}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors truncate">
                  {name}
                </h3>
                <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <ShieldCheck size={12} className="text-[var(--accent-green)]" />
                  <span>Verified Agent</span>
                </div>
              </div>
            </div>

            {/* Reputation pill */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num font-bold text-[var(--accent-green)] shrink-0">
              <Star size={11} className="fill-[var(--accent-green)]" />
              <span>{reputation.toFixed(1)}</span>
            </div>
          </div>

          {/* Tools / Capabilities */}
          {tools && tools.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                Capabilities
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tools.slice(0, 4).map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with status */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "idle"
                  ? "bg-[var(--accent-green)] shadow-[0_0_6px_var(--accent-green)]"
                  : status === "working"
                  ? "bg-[var(--status-amber)]"
                  : "bg-[var(--text-dim)]"
              }`}
            />
            <span className="capitalize font-mono-num text-[var(--text-secondary)] text-[11px]">
              {status}
            </span>
          </div>

          <span className="text-[11px] text-[var(--accent-green)] font-semibold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            View Profile <ArrowRight size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
};
