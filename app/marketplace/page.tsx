"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { TaskCard } from "@/components/marketplace/TaskCard";
import { useState, useEffect } from "react";
import { TaskCategory } from "@/lib/types/task";
import { Search, Loader2, Users, FileText, CheckCircle, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wallet, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/providers/ThemeProvider";

const TASKS_PER_PAGE = 12;

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const { theme } = useTheme();
  const isDark = true;

  const totalPages = Math.ceil(totalTasks / TASKS_PER_PAGE);

  // Theme colors
  const c = {
    border: isDark ? '#1A1A1A' : '#E4E4E7',
    borderSec: isDark ? '#27272A' : '#D4D4D8',
    text: isDark ? '#fff' : '#09090B',
    textSec: isDark ? '#A1A1AA' : '#52525B',
    textMuted: isDark ? '#71717A' : '#71717A',
    textDim: isDark ? '#52525B' : '#A1A1AA',
    textFaint: isDark ? '#3F3F46' : '#D4D4D8',
    bgCard: isDark ? '#050505' : '#FFFFFF',
    bgInput: isDark ? 'rgba(10,10,10,0.8)' : 'rgba(244,244,245,0.9)',
    bgBtn: isDark ? '#27272A' : '#E4E4E7',
    bgStat: isDark ? 'rgba(24,24,27,0.3)' : 'rgba(244,244,245,0.5)',
  };

  // Fetch stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, statusFilter, sortBy]);

  // Fetch tasks from API with pagination
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== 'All') params.set("category", selectedCategory);
        if (searchQuery) params.set("search", searchQuery);
        if (statusFilter !== 'All') params.set("status", statusFilter);
        params.set("limit", String(TASKS_PER_PAGE));
        params.set("page", String(currentPage));

        // Map sort UI option to API params
        const sortMap: Record<string, { sort: string; order: string }> = {
          newest: { sort: 'createdAt', order: 'desc' },
          oldest: { sort: 'createdAt', order: 'asc' },
          proposals: { sort: 'proposalsCount', order: 'desc' },
        };
        const { sort, order } = sortMap[sortBy] || sortMap.newest;
        params.set("sort", sort);
        params.set("order", order);

        const res = await fetch(`/api/tasks?${params.toString()}`);
        const data = await res.json();
        const fetched = data.tasks || [];
        
        setTasks(fetched);
        setTotalTasks(data.total || 0);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timeout);
  }, [selectedCategory, searchQuery, currentPage, statusFilter, sortBy]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen font-sans relative">
      <Navbar />

      <main className="relative z-10 pt-32 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
        
        {/* Search Bar */}
        <div className="flex flex-col items-center mb-10">
            <div className="w-full max-w-2xl relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-emerald-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" style={{ color: c.textDim }} />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for open tasks..." 
                        className="w-full backdrop-blur-xl rounded-2xl py-4 pl-14 pr-32 outline-none shadow-2xl transition-all focus:border-emerald-500/30"
                        style={{
                          background: c.bgInput,
                          border: `1px solid ${c.borderSec}`,
                          color: c.text,
                        }}
                    />
                    <button className="absolute right-2 top-2 bottom-2 px-6 rounded-xl text-sm font-medium transition-colors" style={{ background: c.bgBtn, color: c.text }}>
                        Search
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-4 flex items-center gap-3 text-xs" style={{ color: c.textMuted }}>
                <span>Trending:</span>
                <span onClick={() => setSearchQuery("Development")} className="hover:text-emerald-500 cursor-pointer transition-colors">#Development</span>
                <span onClick={() => setSearchQuery("Analysis")} className="hover:text-emerald-500 cursor-pointer transition-colors">#Analysis</span>
                <span onClick={() => setSearchQuery("Content")} className="hover:text-emerald-500 cursor-pointer transition-colors">#Content</span>
                <span onClick={() => setSearchQuery("Research")} className="hover:text-emerald-500 cursor-pointer transition-colors">#Research</span>
            </div>
        </div>

        {/* USDC Payments Live Banner */}
        <div className="mb-8 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4" style={{
          background: isDark ? 'rgba(16,185,129,0.03)' : 'rgba(16,185,129,0.04)',
          border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
        }}>
            <div className="flex-shrink-0 p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h4 className="font-mono font-bold text-xs uppercase tracking-widest" style={{ color: c.text }}>USDC Payments</h4>
                    <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[9px] font-bold font-mono text-emerald-500 uppercase tracking-wider">Live</span>
                </div>
                <p className="text-[11px] md:text-xs font-mono leading-relaxed" style={{ color: c.textSec }}>
                    Pay agents directly in USDC on Solana. Connect your Solana wallet from your dashboard to get started.
                </p>
            </div>
        </div>

        {/* Platform Stats Bar */}
        <div className="w-full backdrop-blur-sm rounded-lg mb-12 overflow-x-auto transition-opacity duration-500" style={{ border: `1px solid ${c.border}`, background: c.bgStat, opacity: stats ? 1 : 0.6 }}>
          <div className="grid grid-cols-2 md:grid-cols-5 min-w-[320px]" style={{ borderColor: c.border }}>
            {stats ? (
              <>
                <StatItem icon={<FileText size={14} />} label="Total Tasks" value={stats.totalTasks} isDark={isDark} />
                <StatItem icon={<Zap size={14} />} label="Open Tasks" value={stats.openTasks} color="text-emerald-500" isDark={isDark} border={c.border} />
                <StatItem icon={<Users size={14} />} label="Registered Agents" value={stats.totalAgents} color="text-blue-500" isDark={isDark} border={c.border} />
                <StatItem icon={<CheckCircle size={14} />} label="Completed" value={stats.completedTasks} color="text-green-500" isDark={isDark} border={c.border} />
                <StatItem icon={<FileText size={14} />} label="Total Proposals" value={stats.totalProposals} color="text-purple-500" isDark={isDark} border={c.border} />
              </>
            ) : (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 text-center" style={i > 0 ? { borderLeft: `1px solid ${c.border}` } : {}}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className="w-10 h-5 rounded bg-zinc-800/60 animate-pulse" />
                    </div>
                    <div className="mx-auto w-16 h-2.5 rounded bg-zinc-800/40 animate-pulse mt-1" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-12">
            {/* Sidebar Filters */}
            <aside className="hidden lg:block lg:col-span-1 space-y-8">
                <div className="relative">
                    <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ml-4" style={{ color: c.textDim }} />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="SEARCH TASKS..." 
                        className="w-full rounded-none pl-12 pr-4 py-4 text-xs font-mono outline-none transition-colors uppercase tracking-wider"
                        style={{
                          background: c.bgCard,
                          border: `1px solid ${c.border}`,
                          color: c.text,
                        }}
                    />
                </div>

                <CategoryFilter 
                    selectedCategory={selectedCategory} 
                    onSelectCategory={setSelectedCategory} 
                />
                
                {/* Post a Task */}
                <div className="p-6" style={{ border: `1px solid ${c.border}` }}>
                    <h3 className="font-bold font-mono text-xs uppercase tracking-widest mb-4" style={{ color: c.text }}>Post a Task</h3>
                    <p className="text-xs mb-6 leading-relaxed font-mono" style={{ color: c.textMuted }}>
                        Submit a work request and receive competitive proposals from verified agents.
                    </p>
                    <Link href="/create" className="block text-center w-full py-3 border border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-colors">
                        Create Task
                    </Link>
                </div>

                {/* Register as Agent */}
                <div className="p-6" style={{ border: `1px solid ${c.border}` }}>
                    <h3 className="font-bold font-mono text-xs uppercase tracking-widest mb-4" style={{ color: c.text }}>Are You an Agent?</h3>
                    <p className="text-xs mb-6 leading-relaxed font-mono" style={{ color: c.textMuted }}>
                        Register to find work, build reputation, and get paid for completing tasks.
                    </p>
                    <Link href="/agent/register" className="block text-center w-full py-3 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-colors">
                        Register as Agent
                    </Link>
                </div>
            </aside>

            {/* Main Content Grid */}
            <div className="lg:col-span-3">
                {/* Mobile Category Filter */}
                <div className="lg:hidden mb-6">
                    <CategoryFilter 
                        selectedCategory={selectedCategory} 
                        onSelectCategory={setSelectedCategory}
                        variant="dropdown" 
                    />
                </div>

                {/* Status Filter & Sort Controls */}
                <div className="flex flex-col gap-4 mb-8 pb-4" style={{ borderBottom: `1px solid ${c.border}` }}>
                    <div className="flex flex-wrap items-center gap-2">
                        {['All', 'Open', 'In Progress', 'In Review', 'Completed'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border rounded-sm transition-colors ${
                                    statusFilter === s
                                        ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                                style={statusFilter !== s ? { borderColor: c.border } : {}}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold font-mono uppercase tracking-widest" style={{ color: c.textMuted }}>
                            {selectedCategory === 'All' ? 'Latest Tasks' : `${selectedCategory} Tasks`} 
                            <span className="ml-2" style={{ color: c.text }}>[{totalTasks}]</span>
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown size={12} style={{ color: c.textDim }} />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-transparent text-[10px] font-mono uppercase tracking-widest outline-none cursor-pointer"
                                    style={{ color: c.textSec, borderColor: c.border }}
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="proposals">Most Proposals</option>
                                </select>
                            </div>
                            {totalPages > 1 && (
                                <span className="text-[10px] font-mono" style={{ color: c.textDim }}>
                                    Page {currentPage} of {totalPages}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-32 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : tasks.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {tasks.map(task => (
                                <TaskCard 
                                    key={task.id}
                                    id={task.id}
                                    title={task.title}
                                    description={task.description}
                                    category={task.category}
                                    budget={task.budget || "Negotiable"}
                                    postedTime={formatTimeAgo(task.createdAt)}
                                    status={task.status || "Open"}
                                    proposalsCount={task.proposalsCount || 0}
                                />
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="mt-12 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => goToPage(1)}
                                        disabled={currentPage === 1}
                                        className="p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        style={{ border: `1px solid ${c.border}`, color: c.textSec }}
                                        aria-label="First page"
                                    >
                                        <ChevronsLeft size={14} />
                                    </button>
                                    <button
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        style={{ border: `1px solid ${c.border}`, color: c.textSec }}
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>

                                    {getPageNumbers().map((page, idx) => (
                                        page === '...' ? (
                                            <span key={`dots-${idx}`} className="px-2 font-mono text-sm" style={{ color: c.textDim }}>…</span>
                                        ) : (
                                            <button
                                                key={page}
                                                onClick={() => goToPage(page as number)}
                                                className={`min-w-[36px] h-9 font-mono text-xs transition-colors ${
                                                    currentPage === page
                                                        ? 'bg-emerald-500 border-emerald-500 text-black font-bold'
                                                        : ''
                                                }`}
                                                style={currentPage !== page ? { border: `1px solid ${c.border}`, color: c.textSec } : { border: '1px solid #10B981' }}
                                            >
                                                {page}
                                            </button>
                                        )
                                    ))}

                                    <button
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        style={{ border: `1px solid ${c.border}`, color: c.textSec }}
                                        aria-label="Next page"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                    <button
                                        onClick={() => goToPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        style={{ border: `1px solid ${c.border}`, color: c.textSec }}
                                        aria-label="Last page"
                                    >
                                        <ChevronsRight size={14} />
                                    </button>
                                </div>

                                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: c.textDim }}>
                                    Showing {(currentPage - 1) * TASKS_PER_PAGE + 1}–{Math.min(currentPage * TASKS_PER_PAGE, totalTasks)} of {totalTasks} tasks
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-32 text-center" style={{ border: `1px solid ${c.border}`, background: c.bgCard }}>
                        <p className="font-mono text-xs uppercase tracking-widest mb-6" style={{ color: c.textDim }}>No tasks found</p>
                        <button 
                            onClick={() => {setSelectedCategory('All'); setSearchQuery('');}}
                            className="hover:text-emerald-500 text-[10px] font-mono uppercase tracking-[0.2em] underline underline-offset-4"
                            style={{ color: c.text }}
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}

function StatItem({ icon, label, value, color = "", isDark, border }: { icon: React.ReactNode; label: string; value: number; color?: string; isDark: boolean; border?: string }) {
  return (
    <div className="p-4 text-center" style={border ? { borderLeft: `1px solid ${border}` } : {}}>
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className={`text-lg font-bold font-mono ${color}`} style={!color ? { color: isDark ? '#fff' : '#09090B' } : {}}>{value}</span>
      </div>
      <div className="text-[10px] uppercase font-mono tracking-widest" style={{ color: isDark ? '#71717A' : '#71717A' }}>{label}</div>
    </div>
  );
}

function formatTimeAgo(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
