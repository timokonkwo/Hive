"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import {
  CheckCircle,
  Clock,
  Rocket,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Users,
  CreditCard,
  Trophy,
  Bot,
  Code,
  Server,
  BarChart3,
  FileText,
  Zap,
  Shield,
  Star,
  Megaphone,
  Globe,
  Link2,
  Layers,
  MessageSquare,
  Smartphone,
  Brain,
  Plug,
  RefreshCw,
  Vote,
  Coins,
  Twitter,
  Loader2,
} from "lucide-react";

/* ───────── Icon Map ───────── */

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase,
  Users,
  CreditCard,
  Trophy,
  Bot,
  Code,
  Server,
  BarChart3,
  FileText,
  Zap,
  Shield,
  Star,
  Megaphone,
  Globe,
  Link2,
  Layers,
  MessageSquare,
  Smartphone,
  Brain,
  Plug,
  RefreshCw,
  Vote,
  Coins,
  Twitter,
  CheckCircle,
  Rocket,
  Clock,
};

/* ───────── Types ───────── */

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "planned";
  date?: string | null;
  tag?: string | null;
  icon?: string | null;
  order: number;
}

/* ───────── Components ───────── */

function StatusBadge({ status }: { status: "completed" | "in-progress" | "planned" }) {
  const config = {
    completed: {
      label: "Completed",
      icon: CheckCircle,
      bg: "bg-[#00C805]/10",
      border: "border-[#00C805]/30",
      text: "text-[#00C805]",
    },
    "in-progress": {
      label: "In Progress",
      icon: Clock,
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-500",
    },
    planned: {
      label: "Planned",
      icon: Rocket,
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-purple-400",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold ${config.bg} ${config.border} ${config.text} border`}
    >
      <config.icon size={11} /> {config.label}
    </span>
  );
}

function MilestoneCard({
  item,
  status,
}: {
  item: RoadmapItem;
  status: "completed" | "in-progress" | "planned";
}) {
  const Icon = (item.icon && ICON_MAP[item.icon]) || Zap;

  return (
    <div className="robin-card p-5 bg-token-surface border border-token-border hover:border-token-border-strong transition-all group">
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            status === "completed"
              ? "bg-[#00C805]/10 text-[#00C805]"
              : status === "in-progress"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-purple-500/10 text-purple-400"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-token-text font-bold text-sm tracking-tight">{item.title}</h3>
            {item.tag && (
              <span className="text-[9px] font-mono text-token-dim bg-token-subtle px-2 py-0.5 rounded uppercase border border-token-border font-semibold">
                {item.tag}
              </span>
            )}
          </div>
          <p className="text-token-dim text-xs leading-relaxed">{item.description}</p>
          {item.date && (
            <span className="inline-block mt-2 text-[10px] font-mono text-token-dim uppercase tracking-wider">
              {item.date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RoadmapSection({
  title,
  status,
  items,
  defaultExpanded = true,
}: {
  title: string;
  status: "completed" | "in-progress" | "planned";
  items: RoadmapItem[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="mb-10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4 group cursor-pointer p-2 rounded-xl hover:bg-token-subtle transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide text-token-text">
            {title}
          </h2>
          <span className="text-xs font-mono text-token-dim">
            ({items.length})
          </span>
        </div>
        <div className="text-token-dim group-hover:text-token-text transition-colors">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <MilestoneCard key={item.id} item={item} status={status} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────── Page ───────── */

export default function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/roadmap")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = items.filter((i) => i.status === "completed");
  const inProgress = items.filter((i) => i.status === "in-progress");
  const planned = items.filter((i) => i.status === "planned");
  const totalItems = items.length || 1;
  const completedPct = Math.round((completed.length / totalItems) * 100);
  const inProgressPct = Math.round((inProgress.length / totalItems) * 100);

  return (
    <div className="min-h-screen bg-token-bg text-token-text font-sans selection:bg-[#00C805] selection:text-black relative overflow-x-hidden">
      <Navbar />

      <main className="pt-28 pb-20 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-block mb-3">
              <RobinhoodBadge label="Engineering Roadmap" variant="live" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-token-text mb-3">
              Protocol <span className="text-[#00C805]">Evolution</span>
            </h1>
            <p className="text-token-dim max-w-lg mx-auto text-sm md:text-base leading-relaxed">
              Track active delivery milestones, finished capabilities, and planned neural protocol expansions.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#00C805]" size={24} />
            </div>
          ) : (
            <>
              {/* Progress Bar Card */}
              <div className="robin-card p-6 bg-token-surface border border-token-border mb-12">
                <div className="flex items-center justify-between mb-3 text-xs font-mono">
                  <span className="text-token-dim uppercase tracking-wider font-bold">Protocol Completion</span>
                  <span className="text-token-text font-bold">
                    {completed.length} Shipped · {inProgress.length} In Flight · {planned.length} Queued
                  </span>
                </div>
                <div className="h-2.5 bg-token-subtle rounded-full overflow-hidden flex border border-token-border">
                  <div
                    className="h-full bg-[#00C805] transition-all duration-1000"
                    style={{ width: `${completedPct}%` }}
                  />
                  <div
                    className="h-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${inProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00C805]" />
                    <span className="text-xs text-token-dim font-mono">Completed ({completedPct}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-token-dim font-mono">In Progress ({inProgressPct}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-xs text-token-dim font-mono">Planned</span>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <RoadmapSection title="In Active Development" status="in-progress" items={inProgress} />
              <RoadmapSection title="Shipped Milestones" status="completed" items={completed} />
              <RoadmapSection title="Future Architecture" status="planned" items={planned} />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
