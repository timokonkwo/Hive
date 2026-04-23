"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  CheckCircle, Clock, Rocket, ChevronDown, ChevronUp,
  Briefcase, Users, CreditCard, Trophy, Bot, Code, Server,
  BarChart3, FileText, Zap, Shield, Star, Megaphone,
  Globe, Link2, Layers, MessageSquare, Smartphone, Brain,
  Plug, RefreshCw, Vote, Coins, ExternalLink, Twitter, Loader2,
} from "lucide-react";
import Link from "next/link";

/* ───────── Icon Map ───────── */

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase, Users, CreditCard, Trophy, Bot, Code, Server,
  BarChart3, FileText, Zap, Shield, Star, Megaphone,
  Globe, Link2, Layers, MessageSquare, Smartphone, Brain,
  Plug, RefreshCw, Vote, Coins, Twitter, CheckCircle, Rocket, Clock,
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
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-500",
    },
    "in-progress": {
      label: "In Progress",
      icon: Clock,
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-500",
    },
    planned: {
      label: "Planned",
      icon: Rocket,
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      text: "text-violet-400",
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[10px] font-mono uppercase tracking-widest font-bold ${config.bg} ${config.border} ${config.text} border`}>
      <config.icon size={10} /> {config.label}
    </span>
  );
}

function MilestoneCard({ item, status }: { item: RoadmapItem; status: "completed" | "in-progress" | "planned" }) {
  const borderColor = {
    completed: "border-emerald-500/10 hover:border-emerald-500/30",
    "in-progress": "border-blue-500/10 hover:border-blue-500/30",
    planned: "border-white/5 hover:border-violet-500/20",
  }[status];

  const iconColor = {
    completed: "text-emerald-500",
    "in-progress": "text-blue-500",
    planned: "text-violet-400",
  }[status];

  const iconBg = {
    completed: "bg-emerald-500/10",
    "in-progress": "bg-blue-500/10",
    planned: "bg-violet-500/10",
  }[status];

  const Icon = (item.icon && ICON_MAP[item.icon]) || Zap;

  return (
    <div className={`bg-[#0A0A0A] border ${borderColor} rounded-sm p-5 transition-colors group`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 ${iconBg} rounded-sm shrink-0`}>
          <Icon className={iconColor} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-white font-bold text-sm">{item.title}</h3>
            {item.tag && (
              <span className="text-[9px] font-mono text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded uppercase">
                {item.tag}
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">{item.description}</p>
          {item.date && (
            <span className="inline-block mt-2.5 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
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
    <section className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-6 group cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
          <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide text-white">
            {title}
          </h2>
          <span className="text-xs font-mono text-zinc-600">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="text-zinc-600 group-hover:text-white transition-colors">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
    fetch('/api/roadmap')
      .then(res => res.json())
      .then(data => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = items.filter(i => i.status === 'completed');
  const inProgress = items.filter(i => i.status === 'in-progress');
  const planned = items.filter(i => i.status === 'planned');
  const totalItems = items.length || 1;
  const completedPct = Math.round((completed.length / totalItems) * 100);
  const inProgressPct = Math.round((inProgress.length / totalItems) * 100);

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Building the <span className="text-emerald-500">Hive</span>
            </h1>
            <p className="text-zinc-500 max-w-lg mx-auto text-sm md:text-base">
              Here&apos;s what we&apos;ve built so far, what we&apos;re cooking right now, and what&apos;s coming next.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-zinc-600" size={24} />
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="mb-14 p-6 bg-[#0A0A0A] border border-white/10 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Overall Progress</span>
                  <span className="text-xs font-mono text-zinc-600">
                    {completed.length} shipped · {inProgress.length} building · {planned.length} planned
                  </span>
                </div>
                <div className="h-2.5 bg-zinc-900 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${completedPct}%` }}
                  />
                  <div
                    className="h-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${inProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-6 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-zinc-500 font-mono uppercase">Completed ({completedPct}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-zinc-500 font-mono uppercase">In Progress ({inProgressPct}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span className="text-[10px] text-zinc-500 font-mono uppercase">Planned</span>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <RoadmapSection title="Shipped" status="completed" items={completed} defaultExpanded={true} />
              <RoadmapSection title="In Progress" status="in-progress" items={inProgress} defaultExpanded={true} />
              <RoadmapSection title="On the Horizon" status="planned" items={planned} defaultExpanded={true} />
            </>
          )}

          {/* CTA */}
          <div className="text-center mt-8 pt-8 border-t border-white/5">
            <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest mb-6">
              Got ideas? We&apos;re building in public.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="https://x.com/uphivexyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 hover:border-emerald-500/30 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                <Twitter size={12} /> Follow Updates
              </a>
              <Link
                href="/overview"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                Explore Platform <ExternalLink size={12} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
