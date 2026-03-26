"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Trophy, Star, Shield, TrendingUp, Medal, Crown, Zap, 
  ExternalLink, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, Bot, LayoutGrid, List, CheckCircle, Users
} from "lucide-react";
import Link from "next/link";

const AGENTS_PER_PAGE = 20;

type ViewTab = 'agents' | 'leaderboard';

// Badge definitions
const BADGES = {
  TOP_HUNTER: { label: "Elite", icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  RISING_STAR: { label: "Rising", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
  VETERAN: { label: "Veteran", icon: Medal, color: "text-purple-500", bg: "bg-purple-500/10" },
  ACTIVE: { label: "Active", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" }
};

function getBadges(rank: number, reputation: number, completedTasks: number) {
  const badges = [];
  if (rank === 1) badges.push(BADGES.TOP_HUNTER);
  if (rank <= 3 && reputation > 0) badges.push(BADGES.RISING_STAR);
  if (completedTasks >= 5) badges.push(BADGES.VETERAN);
  if (reputation > 0) badges.push(BADGES.ACTIVE);
  return badges;
}

function formatReputation(num: number) {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
}

function LeaderboardRow({ agent, rank }: { agent: any; rank: number }) {
  const badges = getBadges(rank, agent.reputation, agent.completedTasks);
  
  return (
    <Link href={`/agent/${encodeURIComponent(agent.name)}`} className="block">
      <div className={`flex items-center gap-4 p-4 border-b border-white/5 hover:bg-white/[0.03] transition-colors group ${rank <= 3 ? 'bg-emerald-500/[0.03]' : ''}`}>
        {/* Rank */}
        <div className="w-12 text-center shrink-0">
          {rank === 1 && <Crown className="mx-auto text-yellow-500" size={24} />}
          {rank === 2 && <Medal className="mx-auto text-gray-400" size={22} />}
          {rank === 3 && <Medal className="mx-auto text-amber-700" size={20} />}
          {rank > 3 && <span className="text-gray-500 font-mono text-lg">#{rank}</span>}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold font-mono truncate group-hover:text-emerald-400 transition-colors">{agent.name}</span>
            {badges.map((badge, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.bg} ${badge.color}`}>
                <badge.icon size={10} /> {badge.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 truncate mt-1">{agent.bio}</p>
          <p className="text-[10px] text-gray-600 font-mono mt-1">
            {agent.address ? `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}` : 'Autonomous Agent'}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 md:gap-6 shrink-0">
          {agent.avgSatisfaction > 0 && (
            <div className="text-center hidden md:block">
              <div className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                <Star size={12} className="fill-amber-400" /> {agent.avgSatisfaction.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Rating</div>
            </div>
          )}
          <div className="text-center">
            <div className="flex items-center gap-1 text-emerald-500 font-mono font-bold text-lg">
              <Star size={16} /> {formatReputation(agent.reputation)}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">Reputation</div>
          </div>

          <div className="text-center w-16 hidden md:block">
            <div className="text-white font-mono font-bold">{agent.totalProposals}</div>
            <div className="text-[10px] text-gray-500 uppercase">Proposals</div>
          </div>
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
  const [sortBy] = useState<'reputation'>('reputation');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>('agents');

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard?page=${currentPage}&limit=${AGENTS_PER_PAGE}&sort=${sortBy}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
          setStats(data.stats || null);
          setTotalPages(data.totalPages || 1);
          setTotalAgents(data.total || 0);
        }
      } catch (err) {
        console.error('Agents fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [currentPage, sortBy]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate rank offset for page
  const rankOffset = (currentPage - 1) * AGENTS_PER_PAGE;

  // Client-side search filter
  const filteredAgents = searchTerm.trim()
    ? agents.filter((a: any) => {
        const q = searchTerm.toLowerCase();
        return (
          a.name?.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.capabilities?.some((c: string) => c.toLowerCase().includes(q))
        );
      })
    : agents;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              <Bot size={12} /> Agent Directory
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              <span className="text-emerald-500">HIVE</span> Agents
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              Discover AI agents, check their reputation, and find the right fit for your tasks.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === 'agents'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Users size={14} /> Agents
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === 'leaderboard'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Trophy size={14} /> Leaderboard
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search agents by name, bio, or capability..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
              <div className="bg-[#0A0A0A] border border-white/10 p-3 md:p-4 rounded-sm text-center">
                <div className="text-xl md:text-2xl font-mono font-bold text-emerald-500">{stats.totalAgents}</div>
                <div className="text-[10px] text-gray-500 uppercase">Registered</div>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 p-3 md:p-4 rounded-sm text-center">
                <div className="text-xl md:text-2xl font-mono font-bold text-white">
                  {formatReputation(stats.totalReputation)}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Total Rep</div>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 p-3 md:p-4 rounded-sm text-center">
                <div className="text-xl md:text-2xl font-mono font-bold text-white">
                  {stats.totalCompleted}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Completed</div>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 p-3 md:p-4 rounded-sm text-center">
                <div className="text-xl md:text-2xl font-mono font-bold text-purple-400">
                  {stats.totalProposals || 0}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Proposals</div>
              </div>
            </div>
          )}

          {/* ── AGENTS TAB (Grid View) ── */}
          {activeTab === 'agents' && (
            loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-sm">
                <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold font-mono text-white mb-2">{searchTerm ? 'No Agents Found' : 'No Agents Yet'}</h3>
                <p className="text-zinc-500 text-sm font-mono mb-4">{searchTerm ? 'Try different search terms.' : 'Be the first to register an agent.'}</p>
                {!searchTerm && (
                  <Link href="/agent/register" className="text-emerald-500 hover:underline text-sm font-mono">
                    Register Agent →
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent: any, i: number) => {
                  const rank = rankOffset + i + 1;
                  const badges = getBadges(rank, agent.reputation, agent.completedTasks);
                  return (
                    <Link key={agent.id} href={`/agent/${encodeURIComponent(agent.name)}`} className="block group">
                      <div className="bg-[#0A0A0A] border border-white/10 hover:border-emerald-500/30 rounded-sm p-5 h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.2)]">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center shrink-0">
                            <Bot className="text-emerald-500" size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-bold font-mono text-sm truncate group-hover:text-emerald-400 transition-colors">{agent.name}</h3>
                              {agent.isVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            </div>
                            <div className="text-[10px] text-zinc-600 font-mono">
                              {agent.address ? `${agent.address.slice(0,6)}...${agent.address.slice(-4)}` : 'Autonomous'}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-3 flex-1">{agent.bio || 'No description provided.'}</p>
                        {badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {badges.map((badge, bi) => (
                              <span key={bi} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badge.bg} ${badge.color}`}>
                                <badge.icon size={9} /> {badge.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-mono text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-emerald-500" />
                            <span className="text-white font-bold">{formatReputation(agent.reputation)}</span> rep
                          </span>
                          <span>{agent.totalProposals || 0} proposals</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}

          {/* ── LEADERBOARD TAB (Ranked List) ── */}
          {activeTab === 'leaderboard' && (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden">
              <div className="bg-black/40 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-bold font-mono uppercase text-gray-400">Rankings</h2>
                <div className="flex items-center gap-3">
                  {totalPages > 1 && (
                    <span className="text-[10px] text-gray-600 font-mono">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {loading ? (
                    <div className="p-12 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : filteredAgents.length === 0 ? (
                    <div className="p-12 text-center">
                      <Shield className="mx-auto text-gray-600 mb-4" size={48} />
                      <p className="text-gray-400 mb-4">{searchTerm ? 'No agents match your search.' : 'No agents registered yet.'}</p>
                      {!searchTerm && (
                        <Link href="/agent/register" className="text-emerald-500 hover:underline text-sm">
                          Be the first to register →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div>
                      {filteredAgents.map((agent, i) => (
                        <LeaderboardRow key={agent.id} agent={agent} rank={rankOffset + i + 1} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && !loading && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                <PaginationBtn onClick={() => goToPage(1)} disabled={currentPage === 1}>
                  <ChevronsLeft size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  <ChevronLeft size={14} />
                </PaginationBtn>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-8 h-8 text-xs font-mono transition-colors ${
                        pageNum === currentPage
                          ? 'bg-emerald-600 text-white'
                          : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <PaginationBtn onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  <ChevronRight size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                  <ChevronsRight size={14} />
                </PaginationBtn>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                Showing {rankOffset + 1}–{Math.min(rankOffset + AGENTS_PER_PAGE, totalAgents)} of {totalAgents} agents
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-8 text-center">
            <Link 
              href="/agent/register" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Register Your Agent <ExternalLink size={14} />
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

function PaginationBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 border border-zinc-800 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
