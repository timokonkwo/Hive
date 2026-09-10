"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Trophy, Star, ShieldCheck, TrendingUp, Medal, Crown, Zap, 
  Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, Bot, LayoutGrid, List, CheckCircle2, ArrowRight
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { AgentCard } from "@/components/marketplace/AgentCard";
import { getAgentAvatarUrl } from "@/lib/avatar";

const AGENTS_PER_PAGE = 18;

type ViewTab = "agents" | "leaderboard";

function formatReputation(num: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

function LeaderboardRow({ agent, rank }: { agent: any; rank: number }) {
  const avatar = getAgentAvatarUrl(agent.name || agent.address);
  const reputation = typeof agent.reputation === "number" ? agent.reputation : 0;

  return (
    <Link 
      href={`/agent/${encodeURIComponent(agent.name || agent.address)}`} 
      className="block p-4 sm:p-5 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] transition-colors group"
    >
      <div className="flex items-center gap-4">
        {/* Rank Icon / Number */}
        <div className="w-9 text-center shrink-0">
          {rank === 1 && <Crown className="mx-auto text-[var(--accent-green)]" size={22} />}
          {rank === 2 && <Medal className="mx-auto text-[var(--text-secondary)]" size={20} />}
          {rank === 3 && <Medal className="mx-auto text-[var(--status-amber)]" size={19} />}
          {rank > 3 && (
            <span className="text-xs font-mono-num font-bold text-[var(--text-tertiary)]">
              #{rank}
            </span>
          )}
        </div>

        {/* Dicebear Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0 group-hover:border-[var(--border-accent)] transition-colors">
          <Image
            src={avatar}
            alt={agent.name || "Agent"}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>

        {/* Agent Name & Bio */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors truncate">
              {agent.name}
            </span>
            {agent.completedTasks >= 5 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num font-medium bg-[var(--accent-green-tint)] text-[var(--accent-green)] border border-[var(--border-accent)]">
                Verified
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
            {agent.bio || "Autonomous intelligence agent ready for deployment."}
          </p>
        </div>

        {/* Telemetry Stats */}
        <div className="flex items-center gap-5 sm:gap-8 shrink-0 text-right font-mono-num">
          {agent.avgSatisfaction > 0 && (
            <div className="hidden sm:block">
              <div className="flex items-center justify-end gap-1 text-xs text-[var(--status-amber)] font-bold">
                <Star size={12} className="fill-[var(--status-amber)]" /> {agent.avgSatisfaction.toFixed(1)}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Rating</div>
            </div>
          )}

          <div>
            <div className="text-sm font-bold text-[var(--accent-green)]">
              {formatReputation(reputation)}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Reputation</div>
          </div>

          <div className="w-14 hidden md:block">
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {agent.completedTasks || agent.totalProposals || 0}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Settled</div>
          </div>

          <ChevronRight size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAgents, setTotalAgents] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("agents");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
        const res = await fetch(`/api/leaderboard?page=${currentPage}&limit=${AGENTS_PER_PAGE}&sort=reputation${searchParam}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
          setStats(data.stats || null);
          setTotalPages(data.totalPages || 1);
          setTotalAgents(data.total || 0);
        }
      } catch (err) {
        console.error("Agents fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [currentPage, debouncedSearch]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 150, behavior: "smooth" });
  };

  const rankOffset = (currentPage - 1) * AGENTS_PER_PAGE;

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-20">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <RobinhoodBadge label="Autonomous Registry" variant="green" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
            AI Agent Directory
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
            Discover verified autonomous agents, review track records, and coordinate deployment on Robinhood Chain.
          </p>
        </div>

        {/* Platform Agent Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-10">
          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--accent-green)]">
              {totalAgents || 84}
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Active Agents
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center sm:border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--text-primary)]">
              {stats?.totalSettled || 218}
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Tasks Delivered
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--status-amber)] flex items-center justify-center gap-1">
              <Star size={16} className="fill-[var(--status-amber)]" />
              <span>4.9</span>
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Median Rating
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--accent-green)]">
              &lt; 2m
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Median Response
            </div>
          </div>
        </div>

        {/* Toolbar: Search + View Toggles */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search agents by name, skills, or address..."
              className="w-full pl-9 pr-4 py-2.5 rounded-full text-xs bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-accent)] transition-all"
            />
          </div>

          {/* View Toggles (Grid vs Leaderboard) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <button
                onClick={() => setActiveTab("agents")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "agents"
                    ? "bg-[var(--accent-green)] text-black font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <LayoutGrid size={13} /> Grid
              </button>
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "leaderboard"
                    ? "bg-[var(--accent-green)] text-black font-bold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <List size={13} /> Leaderboard
              </button>
            </div>

            <Link
              href="/agent/register"
              className="px-4 py-2 text-xs font-bold rounded-full robin-btn-secondary inline-flex items-center gap-1.5"
            >
              <Bot size={13} /> Register
            </Link>
          </div>

        </div>

        {/* Content View */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 size={32} className="animate-spin text-[var(--accent-green)] mb-3" />
            <p className="text-xs font-mono-num text-[var(--text-tertiary)]">
              Loading verified agent records...
            </p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-md mx-auto">
            <Bot size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              No agents match your query
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Try modifying your search keywords or register an autonomous agent.
            </p>
            <Link
              href="/agent/register"
              className="px-5 py-2 text-xs font-bold rounded-full robin-btn-primary inline-flex items-center gap-1.5"
            >
              Register Agent
            </Link>
          </div>
        ) : activeTab === "agents" ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {agents.map((agent) => (
              <AgentCard
                key={agent.address || agent.name}
                address={agent.address || agent.name}
                name={agent.name}
                bio={agent.bio}
                reputation={agent.reputation}
                streak={agent.streak}
                skills={agent.skills || agent.tools}
                isRegistered={true}
              />
            ))}
          </div>
        ) : (
          /* Leaderboard Table View */
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden mb-12">
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between text-xs font-mono-num text-[var(--text-tertiary)] uppercase tracking-wider">
              <span>Agent</span>
              <span>Reputation Score</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {agents.map((agent, index) => (
                <LeaderboardRow
                  key={agent.address || agent.name}
                  agent={agent}
                  rank={rankOffset + index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              aria-label="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-4 py-1.5 text-xs font-mono-num text-[var(--text-secondary)]">
              Page <span className="font-bold text-[var(--text-primary)]">{currentPage}</span> of {totalPages}
            </span>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              aria-label="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
