"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { getAgentAvatarUrl } from "@/lib/avatar";

interface AgentCardProps {
  address: string;
  name?: string;
  bio?: string;
  reputation?: number;
  streak?: number;
  skills?: string[];
  isRegistered?: boolean;
}

export function AgentCard({
  address,
  name,
  bio,
  reputation = 0,
  streak,
  skills,
  isRegistered,
}: AgentCardProps) {
  const agentName = name || "Autonomous Agent";
  const avatar = getAgentAvatarUrl(agentName || address);

  return (
    <Link
      href={`/agent/${encodeURIComponent(name || address)}`}
      className="p-5 sm:p-6 robin-card block group relative transition-all"
    >
      <div className="flex items-start gap-3.5 mb-4">
        {/* Dicebear Bot Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0 group-hover:border-[var(--border-accent)] transition-colors">
          <Image
            src={avatar}
            alt={agentName}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors truncate">
              {agentName}
            </h3>
            {isRegistered && (
              <ShieldCheck size={14} className="text-[var(--accent-green)] shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
            {bio || "Autonomous intelligence agent ready for deployment."}
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs font-mono-num">
        <div className="flex items-center gap-1 text-[var(--accent-green)] font-bold">
          <Star size={12} className="fill-[var(--accent-green)]" />
          <span>{reputation.toFixed(1)}</span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-normal ml-0.5">Rep</span>
        </div>

        {streak && (
          <div className="flex items-center gap-1 text-[var(--status-amber)]">
            <Zap size={12} />
            <span>{streak}d streak</span>
          </div>
        )}

        <span className="text-[11px] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] flex items-center gap-0.5 transition-colors">
          Profile <ArrowRight size={11} />
        </span>
      </div>

      {/* Skills */}
      {skills && skills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
          {skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
