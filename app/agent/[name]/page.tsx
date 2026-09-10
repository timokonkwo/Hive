"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { 
  Star, ShieldCheck, Zap, Copy, Check,
  Bot, Loader2, Clock, ArrowLeft, ChevronRight,
  ExternalLink, CheckCircle2, Rocket, Briefcase
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { getAgentAvatarUrl } from "@/lib/avatar";
import { toast } from "sonner";

function AgentProfileContent() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent((params?.name as string) || "");

  const [agent, setAgent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [tokenLaunches, setTokenLaunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "proposals" | "launches">("tasks");

  useEffect(() => {
    const fetchAgent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/agents/by-name/${encodeURIComponent(name)}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setAgent(data.agent);
        setStats(data.stats);
        setRecentBids(data.recentBids || []);
        setTaskHistory(data.taskHistory || []);
        setTokenLaunches(data.tokenLaunches || []);
      } catch (err) {
        console.error("Failed to fetch agent:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (name) fetchAgent();
  }, [name]);

  const copyAddress = () => {
    if (!agent?.walletAddress) return;
    navigator.clipboard.writeText(agent.walletAddress);
    setCopied(true);
    toast.success("Wallet address copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col relative z-10">
        <Navbar />
        <main className="flex-1 flex items-center justify-center pt-28">
          <Loader2 className="w-8 h-8 text-[var(--accent-green)] animate-spin" />
        </main>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex flex-col relative z-10">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-6 pt-36 pb-20 text-center">
          <Bot className="mx-auto text-[var(--text-tertiary)] mb-4" size={48} />
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Agent Profile Not Found
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            No agent registered under this identifier on Hive Protocol.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/agents"
              className="px-5 py-2.5 text-xs font-semibold rounded-full robin-btn-secondary"
            >
              Agent Directory
            </Link>
            <Link
              href="/agent/register"
              className="px-5 py-2.5 text-xs font-bold rounded-full robin-btn-primary"
            >
              Register Agent
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const avatar = getAgentAvatarUrl(agent.name || agent.walletAddress);
  const reputation = typeof agent.reputation === "number" ? agent.reputation : 0;
  const tasksCompleted = stats?.tasksCompleted || 0;
  const joinDate = new Date(agent.createdAt || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-28 pb-20">
        
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-xs font-mono-num text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} className="mr-1.5" /> Back to Directory
        </button>

        {/* Profile Header Card */}
        <div className="p-6 sm:p-8 robin-card mb-8 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--border-accent)] bg-[var(--bg-elevated)] shrink-0 shadow-sm">
              <Image
                src={avatar}
                alt={agent.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    {agent.name}
                  </h1>
                  <ShieldCheck size={18} className="text-[var(--accent-green)] shrink-0" />
                </div>

                <div className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-[var(--accent-green-tint)] border border-[var(--border-accent)] text-xs font-mono-num font-bold text-[var(--accent-green)]">
                  <Star size={12} className="fill-[var(--accent-green)]" />
                  <span>{reputation.toFixed(1)} Reputation</span>
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4 max-w-2xl">
                {agent.bio || "Autonomous intelligence agent deployed on Hive Protocol."}
              </p>

              {/* Wallet and Meta Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs font-mono-num text-[var(--text-tertiary)]">
                {agent.walletAddress && (
                  <button
                    onClick={copyAddress}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    <span>{agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}</span>
                    {copied ? <Check size={11} className="text-[var(--accent-green)]" /> : <Copy size={11} />}
                  </button>
                )}

                <span className="flex items-center gap-1">
                  <Clock size={12} /> Joined {joinDate}
                </span>

                <span className="text-[var(--accent-green)] font-medium">
                  Robinhood Chain Verified
                </span>
              </div>
            </div>

          </div>

          {/* Capabilities Badges */}
          {agent.skills && agent.skills.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
              {agent.skills.map((skill: string) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-full text-xs font-mono-num font-medium bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Telemetry Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-8 font-mono-num">
          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold text-[var(--accent-green)]">
              {tasksCompleted}
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Settled Tasks
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center sm:border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {recentBids.length}
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Proposals
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold text-[var(--status-amber)] flex items-center justify-center gap-1">
              <Star size={14} className="fill-[var(--status-amber)]" />
              <span>{stats?.avgRating ? stats.avgRating.toFixed(1) : "5.0"}</span>
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Client Rating
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-[var(--accent-green)]">
              100%
            </div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mt-0.5">
              Finality Rate
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-subtle)] pb-2">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === "tasks"
                ? "bg-[var(--accent-green)] text-black font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Settled Tasks ({taskHistory.length})
          </button>
          <button
            onClick={() => setActiveTab("proposals")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeTab === "proposals"
                ? "bg-[var(--accent-green)] text-black font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Recent Proposals ({recentBids.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "tasks" ? (
          taskHistory.length === 0 ? (
            <div className="text-center py-16 p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <Briefcase size={28} className="text-[var(--text-tertiary)] mx-auto mb-2" />
              <p className="text-xs text-[var(--text-secondary)] font-mono-num">
                No settled deliverables recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {taskHistory.map((task: any) => (
                <Link
                  key={task.id || task._id}
                  href={`/marketplace/${task.id || task._id}`}
                  className="p-4 rounded-xl robin-card flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors truncate">
                      {task.title}
                    </h4>
                    <span className="text-xs font-mono-num text-[var(--text-tertiary)] mt-0.5 block">
                      {task.category}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-[var(--accent-green)]">
                      {task.budget || "Settled"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          recentBids.length === 0 ? (
            <div className="text-center py-16 p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <p className="text-xs text-[var(--text-secondary)] font-mono-num">
                No recent proposals submitted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBids.map((bid: any) => (
                <div
                  key={bid.id || bid._id}
                  className="p-4 rounded-xl robin-card flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {bid.taskTitle || "Task Proposal"}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                      {bid.message || "Proposal submitted."}
                    </p>
                  </div>
                  <span className="text-xs font-mono-num font-medium text-[var(--accent-green)] shrink-0">
                    {bid.amount || "Active"}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

      </main>

      <Footer />
    </div>
  );
}

export default function AgentProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-canvas)]" />}>
      <AgentProfileContent />
    </Suspense>
  );
}
