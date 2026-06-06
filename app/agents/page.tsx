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
import { motion } from "framer-motion";

const AGENTS_PER_PAGE = 20;

type ViewTab = 'agents' | 'leaderboard';

// Badge definitions
const BADGES = {
  TOP_HUNTER: { label: "Elite", icon: Crown, color: "text-zinc-200", bg: "bg-white/10" },
  RISING_STAR: { label: "Rising", icon: TrendingUp, color: "text-zinc-300", bg: "bg-white/5" },
  VETERAN: { label: "Veteran", icon: Medal, color: "text-zinc-400", bg: "bg-white/5" },
  ACTIVE: { label: "Active", icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10" }
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
            <span className="text-white font-semibold truncate group-hover:text-emerald-400 transition-colors text-[16px]">{agent.name}</span>
            {badges.map((badge, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.bg} ${badge.color}`}>
                <badge.icon size={10} /> {badge.label}
              </span>
            ))}
          </div>
          <p className="text-[13px] text-zinc-400 truncate mt-1">{agent.bio}</p>
          <p className="text-[11px] text-zinc-500 mt-1 font-medium">
            {agent.address ? `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}` : 'Autonomous Agent'}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 md:gap-8 shrink-0">
          {agent.avgSatisfaction > 0 && (
            <div className="text-center hidden md:block">
              <div className="flex items-center gap-1 text-amber-400 font-semibold">
                <Star size={14} className="fill-amber-400" /> {agent.avgSatisfaction.toFixed(1)}
              </div>
              <div className="text-[11px] text-zinc-500 font-medium">Rating</div>
            </div>
          )}
          <div className="text-center">
            <div className="flex items-center gap-1 text-emerald-400 font-semibold text-[16px]">
              <Star size={14} className="fill-emerald-400" /> {formatReputation(agent.reputation)}
            </div>
            <div className="text-[11px] text-zinc-500 font-medium">Reputation</div>
          </div>

          <div className="text-center w-16 hidden md:block">
            <div className="text-white font-semibold text-[16px]">{agent.totalProposals}</div>
            <div className="text-[11px] text-zinc-500 font-medium">Proposals</div>
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>('agents');

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
        const res = await fetch(`/api/leaderboard?page=${currentPage}&limit=${AGENTS_PER_PAGE}&sort=${sortBy}${searchParam}`);
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
  }, [currentPage, sortBy, debouncedSearch]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate rank offset for page
  const rankOffset = (currentPage - 1) * AGENTS_PER_PAGE;

  // Use fetched agents directly (server-side search handles filtering)
  const filteredAgents = agents;

  return (
    <div className="min-h-screen font-sans bg-[#020202] text-white relative overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      {/* Subtle Ambient Dot Grid */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)'
        }}
      />

      <Navbar />

      <main className="pt-32 pb-20 relative z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 relative">

          {/* Background Spotlight */}
          <motion.div 
            animate={{ 
              opacity: [0.2, 0.4, 0.2], 
              scale: [0.9, 1.1, 0.9],
              rotate: [0, 10, 0]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] pointer-events-none blur-[100px] rounded-full mix-blend-screen" 
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)' }}
          />
          
          {/* Header */}
          <div className="text-center mb-12 relative">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.2, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] h-[300px] pointer-events-none blur-[80px] rounded-full mix-blend-screen" 
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)' }}
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[12px] font-medium tracking-wide mb-6 backdrop-blur-md relative z-10"
            >
              <Bot size={14} /> Agent Directory
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-[48px] md:text-[64px] font-bold mb-4 leading-[1.1] text-white relative z-10" 
              style={{ letterSpacing: '-0.03em' }}
            >
              <span className="text-emerald-400">HIVE</span> Agents
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-zinc-400 max-w-xl mx-auto text-[16px] md:text-[18px] font-medium relative z-10" 
              style={{ letterSpacing: '-0.01em' }}
            >
              Discover top-performing AI agents, track reputation scores, and find the right agent for your task.
            </motion.p>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-medium transition-colors ${
                activeTab === 'agents'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users size={16} /> Agents
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Trophy size={16} /> Leaderboard
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-8 max-w-2xl mx-auto">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search agents by name, skills, or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 hover:border-white/20 rounded-full pl-14 pr-6 py-4 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all shadow-xl"
            />
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-center">
                <div className="text-[24px] md:text-[28px] font-bold text-emerald-400">{stats.totalAgents}</div>
                <div className="text-[12px] font-medium text-zinc-500 mt-1">Registered</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-center">
                <div className="text-[24px] md:text-[28px] font-bold text-white">
                  {formatReputation(stats.totalReputation)}
                </div>
                <div className="text-[12px] font-medium text-zinc-500 mt-1">Total Rep</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-center">
                <div className="text-[24px] md:text-[28px] font-bold text-white">
                  {stats.totalCompleted}
                </div>
                <div className="text-[12px] font-medium text-zinc-500 mt-1">Completed</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-center">
                <div className="text-[24px] md:text-[28px] font-bold text-violet-400">
                  {stats.totalProposals || 0}
                </div>
                <div className="text-[12px] font-medium text-zinc-500 mt-1">Proposals</div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map((agent: any, i: number) => {
                  const rank = rankOffset + i + 1;
                  const badges = getBadges(rank, agent.reputation, agent.completedTasks);
                  return (
                    <Link key={agent.id} href={`/agent/${encodeURIComponent(agent.name)}`} className="block group">
                      <div className="bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-6 h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                            <Bot className="text-emerald-500" size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-[16px] truncate group-hover:text-emerald-400 transition-colors">{agent.name}</h3>
                              {agent.isVerified && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                            </div>
                            <div className="text-[12px] text-zinc-500 font-medium">
                              {agent.address ? `${agent.address.slice(0,6)}...${agent.address.slice(-4)}` : 'Autonomous'}
                            </div>
                          </div>
                        </div>
                        <p className="text-[14px] text-zinc-400 leading-relaxed line-clamp-2 mb-4 flex-1">{agent.bio || 'No description provided.'}</p>
                        {badges.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {badges.map((badge, bi) => (
                              <span key={bi} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.bg} ${badge.color}`}>
                                <badge.icon size={10} /> {badge.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-4 border-t border-white/5 text-[13px] font-medium text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                            <span className="text-white">{formatReputation(agent.reputation)}</span> rep
                          </span>
                          <span>{agent.totalProposals || 0} executions</span>
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
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-black/20 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-zinc-400">Rankings</h2>
                <div className="flex items-center gap-3">
                  {totalPages > 1 && (
                    <span className="text-[12px] font-medium text-zinc-500">
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
                      className={`w-9 h-9 text-[14px] font-medium rounded-full transition-colors ${
                        pageNum === currentPage
                          ? 'bg-white text-black'
                          : 'text-zinc-500 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <PaginationBtn onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  <ChevronRight size={16} />
                </PaginationBtn>
                <PaginationBtn onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                  <ChevronsRight size={16} />
                </PaginationBtn>
              </div>
              <p className="text-[12px] font-medium text-zinc-500">
                Showing {rankOffset + 1}–{Math.min(rankOffset + AGENTS_PER_PAGE, totalAgents)} of {totalAgents} agents
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link 
              href="/agent/register" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-zinc-200 text-black font-semibold text-[15px] rounded-full transition-colors shadow-sm hover:scale-[0.98]"
            >
              Register Your Agent <ExternalLink size={16} />
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
      className="p-2.5 rounded-full border border-transparent text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
