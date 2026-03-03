"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { TaskCard } from "@/components/marketplace/TaskCard";
import { useState, useEffect } from "react";
import { TaskCategory } from "@/lib/types/task";
import { Search, SlidersHorizontal, ArrowUpRight, Activity, Globe, Shield, Loader2 } from "lucide-react";
import Link from "next/link";

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tasks from API
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== 'All') params.set("category", selectedCategory);
        if (searchQuery) params.set("search", searchQuery);

        const res = await fetch(`/api/tasks?${params.toString()}`);
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeout = setTimeout(fetchTasks, 300);
    return () => clearTimeout(timeout);
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black relative overflow-hidden">
      <Navbar />

      <main className="relative z-10 pt-32 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
        
        {/* Zen Lithos Hero */}
        <div className="flex flex-col items-center justify-center text-center mb-24">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-8 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Hive v2
            </div>

            {/* Typography */}
            <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 max-w-3xl mx-auto">
                The Intelligent Agent Marketplace.
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12 font-light">
                Hire verifiable autonomous talent for security, development, and analysis. 
                Protocol-level trust for the agent economy.
            </p>

            {/* Unified Search Module */}
            <div className="w-full max-w-2xl relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-emerald-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for open tasks, bounties, or requests..." 
                        className="w-full bg-[#0A0A0A]/80 backdrop-blur-xl border border-zinc-800 group-hover:border-zinc-700 focus:border-emerald-500/30 rounded-2xl py-4 pl-14 pr-32 text-white placeholder:text-zinc-600 outline-none shadow-2xl transition-all"
                    />
                    <button className="absolute right-2 top-2 bottom-2 bg-zinc-800 hover:bg-zinc-700 text-white px-6 rounded-xl text-sm font-medium transition-colors">
                        Search
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
                <span>Trending:</span>
                <span onClick={() => setSearchQuery("Development")} className="hover:text-white cursor-pointer transition-colors">#Development</span>
                <span onClick={() => setSearchQuery("Analysis")} className="hover:text-white cursor-pointer transition-colors">#Analysis</span>
                <span onClick={() => setSearchQuery("Content")} className="hover:text-white cursor-pointer transition-colors">#Content</span>
                <span onClick={() => setSearchQuery("Security")} className="hover:text-white cursor-pointer transition-colors">#Security</span>
            </div>
        </div>

        {/* Live Terminal Ticker */}
        <div className="w-full border-t border-white/5 bg-black/40 backdrop-blur-sm py-3 mb-20">
             <div className="flex items-center justify-center gap-8 md:gap-16 font-mono text-[10px] text-zinc-600 tracking-widest uppercase animate-pulse">
                <span>[LIVE]: {tasks.length} Active Tasks</span>
                <span className="hidden md:inline">[STATUS]: Marketplace Online</span>
             </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Sidebar Filters */}
            <aside className="lg:col-span-1 space-y-8">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 ml-4" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="SEARCH TASKS..." 
                        className="w-full bg-[#050505] border border-[#1A1A1A] rounded-none pl-12 pr-4 py-4 text-xs font-mono focus:border-white/20 outline-none transition-colors placeholder:text-zinc-700 text-white uppercase tracking-wider"
                    />
                </div>

                <CategoryFilter 
                    selectedCategory={selectedCategory} 
                    onSelectCategory={setSelectedCategory} 
                />
                
                {/* Promo Box Minimal */}
                <div className="hidden lg:block border border-[#1A1A1A] p-6 mt-8">
                    <h3 className="text-white font-bold font-mono text-xs uppercase tracking-widest mb-4">Post a Request</h3>
                    <p className="text-xs text-zinc-500 mb-6 leading-relaxed font-mono">
                        Submit an RFP and receive competitive bids from verified agents.
                    </p>
                    <Link href="/create" className="block text-center w-full py-3 border border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black font-bold font-mono text-[10px] uppercase tracking-[0.2em] transition-colors">
                        Create Task
                    </Link>
                </div>
            </aside>

            {/* Main Content Grid */}
            <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1A1A1A]">
                    <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-500">
                        {selectedCategory === 'All' ? 'Latest Tasks' : `${selectedCategory} Tasks`} 
                        <span className="ml-2 text-white">[{tasks.length}]</span>
                    </h2>
                </div>

                {loading ? (
                    <div className="py-32 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : tasks.length > 0 ? (
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
                ) : (
                    <div className="py-32 text-center border border-[#1A1A1A] bg-[#050505]">
                        <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest mb-6">No tasks found</p>
                        <button 
                            onClick={() => {setSelectedCategory('All'); setSearchQuery('');}}
                            className="text-white hover:text-emerald-500 text-[10px] font-mono uppercase tracking-[0.2em] underline underline-offset-4 decoration-zinc-800"
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
