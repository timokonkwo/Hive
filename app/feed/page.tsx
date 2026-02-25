"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Activity, Clock, CheckCircle, AlertCircle, Plus, 
  ArrowRight, ExternalLink, Zap, Eye, Loader2
} from "lucide-react";
import Link from "next/link";

function formatTimeAgo(dateStr: string | number) {
  const timestamp = typeof dateStr === "string" ? new Date(dateStr).getTime() : dateStr;
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  TaskCreated: { icon: Plus, color: "text-blue-500", bg: "bg-blue-500/10" },
  BidSubmitted: { icon: Eye, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  BidAccepted: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  TaskFunded: { icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10" },
  TaskCompleted: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

function EventCard({ event }: { event: any }) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.TaskCreated;
  const Icon = config.icon;

  const getMessage = () => {
    switch (event.type) {
      case "TaskCreated":
        return (
          <>
            <p className="text-white font-mono text-sm">
              New task posted: <span className="text-emerald-500 font-bold">{event.metadata?.title || "Untitled"}</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Category: {event.metadata?.category || "General"} • Budget: {event.metadata?.budget || "Negotiable"}
            </p>
          </>
        );
      case "BidSubmitted":
        return (
          <>
            <p className="text-white font-mono text-sm">
              <span className="text-yellow-500 font-bold">{event.actorName}</span> submitted a proposal
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Bid: {event.metadata?.amount} ETH • {event.metadata?.taskTitle || ""}
            </p>
          </>
        );
      case "BidAccepted":
        return (
          <>
            <p className="text-white font-mono text-sm">
              Proposal accepted for <span className="text-emerald-500 font-bold">{event.metadata?.taskTitle}</span>
            </p>
          </>
        );
      default:
        return (
          <p className="text-white font-mono text-sm">
            {event.type}: {event.actorName}
          </p>
        );
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className={`p-2 rounded-sm ${config.bg}`}>
        <Icon className={config.color} size={18} />
      </div>
      <div className="flex-1 min-w-0">{getMessage()}</div>
      <div className="text-[10px] text-gray-500 font-mono shrink-0">
        {formatTimeAgo(event.createdAt)}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/feed?limit=30");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch feed:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchFeed();
    // Refresh every 30s
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              <Activity size={12} /> Live Activity
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Task <span className="text-emerald-500">Feed</span>
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Real-time activity from the HIVE marketplace. See tasks, proposals, and updates as they happen.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/10 p-3 rounded-sm mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-gray-400">Live</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{events.length} events</span>
              <span>•</span>
              <span>{events.filter(e => e.type === "TaskCreated").length} new tasks</span>
            </div>
          </div>

          {/* Feed */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden">
            {loading ? (
              <div className="py-20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : events.length > 0 ? (
              events.map((event, i) => (
                <EventCard key={event.id || i} event={event} />
              ))
            ) : (
              <div className="py-20 text-center text-zinc-600 font-mono text-sm">
                No activity yet. Create a task to get started!
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-8 flex gap-4 justify-center">
            <Link 
              href="/create" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Create Task <Plus size={14} />
            </Link>
            <Link 
              href="/marketplace" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Browse Marketplace <ArrowRight size={14} />
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
