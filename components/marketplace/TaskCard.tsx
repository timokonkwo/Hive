"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TaskCategory } from "@/lib/types/task";
import { 
  Shield, Code, Cpu, PenTool, Layout, Search, 
  Megaphone, Scale, Languages, Briefcase, Rocket, 
  Clock, CheckCircle2, ChevronRight
} from "lucide-react";
import { getUserAvatarUrl } from "@/lib/avatar";

interface TaskCardProps {
  id: string | number;
  title: string;
  description: string;
  category: TaskCategory;
  budget: string;
  postedTime: string;
  status: "Open" | "In Progress" | "In Review" | "Completed";
  proposalsCount: number;
  clientAddress?: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Security: Shield,
  Development: Code,
  Analysis: Cpu,
  Content: PenTool,
  Design: Layout,
  Research: Search,
  Social: Megaphone,
  Legal: Scale,
  Translation: Languages,
  "Token Launch": Rocket,
  Other: Briefcase,
};

export function TaskCard({
  id,
  title,
  description,
  category,
  budget,
  postedTime,
  status,
  proposalsCount,
  clientAddress,
}: TaskCardProps) {
  const CategoryIcon = CATEGORY_ICONS[category] || Briefcase;
  const isCompleted = status === "Completed";
  const isOpen = status === "Open";
  const avatarUrl = getUserAvatarUrl(clientAddress || String(id));

  return (
    <Link
      href={`/marketplace/${id}`}
      className={`group p-5 sm:p-6 robin-card flex flex-col justify-between h-full relative cursor-pointer block transition-all ${
        isCompleted ? "opacity-75" : ""
      }`}
    >
      <div>
        {/* Top Header: Client Avatar + Category + Status Pill */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0">
              <Image
                src={avatarUrl}
                alt="Client"
                width={24}
                height={24}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1 truncate">
              <CategoryIcon size={12} className="text-[var(--text-tertiary)] shrink-0" />
              {category}
            </span>
          </div>

          {/* Status Indicator */}
          <div className="shrink-0">
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--accent-green-tint)] text-[var(--accent-green)] border border-[var(--border-accent)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
                Open
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--bg-pill)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                <CheckCircle2 size={10} className="text-[var(--accent-green)]" />
                Settled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--bg-pill)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                <Clock size={10} />
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-green)] transition-colors line-clamp-2 leading-snug">
          {title}
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-6">
          {description}
        </p>
      </div>

      {/* Card Footer: Budget + Proposals + Timestamp */}
      <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs">
        {/* Reward Pill */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono-num text-[var(--text-tertiary)]">Reward:</span>
          <span className="text-sm font-bold font-mono-num text-[var(--accent-green)]">
            {budget}
          </span>
        </div>

        {/* Bids and Time */}
        <div className="flex items-center gap-3 text-[var(--text-tertiary)] font-mono-num text-[11px]">
          <span>{proposalsCount} {proposalsCount === 1 ? "bid" : "bids"}</span>
          <span>&bull;</span>
          <span>{postedTime}</span>
        </div>
      </div>
    </Link>
  );
}
