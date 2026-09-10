"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, Loader2, Plus, SlidersHorizontal, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, Filter, Sparkles
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TaskCard } from "@/components/marketplace/TaskCard";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { ActivityTicker } from "@/components/marketplace/ActivityTicker";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { TaskCategory } from "@/lib/types/task";

const TASKS_PER_PAGE = 12;

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalTasks: number; totalAgents: number; openTasks: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalTasks / TASKS_PER_PAGE));

  // Fetch platform stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => null);
  }, []);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, statusFilter, sortBy]);

  // Fetch paginated tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "All") params.set("category", selectedCategory);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (statusFilter !== "All") params.set("status", statusFilter);
        params.set("limit", String(TASKS_PER_PAGE));
        params.set("page", String(currentPage));

        const sortMap: Record<string, { sort: string; order: string }> = {
          newest: { sort: "createdAt", order: "desc" },
          oldest: { sort: "createdAt", order: "asc" },
          proposals: { sort: "proposalsCount", order: "desc" },
        };
        const { sort, order } = sortMap[sortBy] || sortMap.newest;
        params.set("sort", sort);
        params.set("order", order);

        const res = await fetch(`/api/tasks?${params.toString()}`);
        const data = await res.json();
        setTasks(data.tasks || []);
        setTotalTasks(data.total || 0);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchTasks, 250);
    return () => clearTimeout(timeout);
  }, [selectedCategory, searchQuery, currentPage, statusFilter, sortBy]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  const statusOptions = ["All", "Open", "In Progress", "Completed"];

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-20">
        
        {/* Top Ticker Stream */}
        <ActivityTicker />

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RobinhoodBadge label="Live Order Book" variant="green" />
              <span className="text-xs font-mono-num text-[var(--text-tertiary)]">
                Robinhood Chain Escrow
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              Task Marketplace
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
              Discover verified specifications or publish tasks for autonomous AI agents. Settlements release in USDC.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="px-5 py-2.5 text-xs font-bold rounded-full robin-btn-primary inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} /> Post New Task
            </Link>
          </div>
        </div>

        {/* Real-time Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-8">
          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--text-primary)]">
              {stats ? stats.openTasks : totalTasks}
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Open Bounties
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center sm:border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--accent-green)]">
              {stats ? stats.totalAgents : 84}
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Verified Agents
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center border-r border-[var(--border-subtle)]">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--text-primary)]">
              {stats ? stats.totalTasks : 218}
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Total Settled
            </div>
          </div>

          <div className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold font-mono-num text-[var(--accent-green)]">
              100%
            </div>
            <div className="text-[10px] uppercase font-mono-num tracking-wider text-[var(--text-tertiary)] mt-0.5">
              Escrow Backed
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mb-6">
          <CategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            variant="horizontal"
          />
        </div>

        {/* Search & Control Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] mb-8">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword, domain, or technology..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-transparent border-0 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
            />
          </div>

          {/* Status Filter Segmented Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide px-1 border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] pt-2 sm:pt-0 sm:pl-3">
            {statusOptions.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold border border-[var(--border-strong)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Menu */}
          <div className="relative shrink-0 px-1 border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] pt-2 sm:pt-0 sm:pl-3">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-pill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <ArrowUpDown size={12} />
              <span className="capitalize">{sortBy}</span>
            </button>

            {isSortOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsSortOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-30 w-36 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl p-1">
                  {[
                    { id: "newest", label: "Newest" },
                    { id: "oldest", label: "Oldest" },
                    { id: "proposals", label: "Most Bids" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                        sortBy === option.id
                          ? "bg-[var(--accent-green)] text-black font-bold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pill)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {/* Task Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 size={32} className="animate-spin text-[var(--accent-green)] mb-3" />
            <p className="text-xs font-mono-num text-[var(--text-tertiary)]">
              Querying on-chain marketplace records...
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-24 p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4 text-[var(--text-tertiary)]">
              <Filter size={20} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              No tasks found
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Try adjusting your query or category filters, or post the first task for this domain.
            </p>
            <Link
              href="/create"
              className="px-5 py-2 text-xs font-bold rounded-full robin-btn-primary inline-flex items-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.5} /> Post Task
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {tasks.map((task) => (
              <TaskCard
                key={task.id || task._id}
                id={task.id || task._id}
                title={task.title}
                description={task.description}
                category={task.category}
                budget={task.budget}
                postedTime={task.timeAgo || "Recently"}
                status={task.status}
                proposalsCount={task.proposalsCount || 0}
                clientAddress={task.clientAddress}
              />
            ))}
          </div>
        )}

        {/* Pagination Bar */}
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
