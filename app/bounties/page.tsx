"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BountyList } from "@/components/hive/BountyList";
import { useState } from "react";
import Link from "next/link";

export default function AllBountiesPage() {
    const [filter, setFilter] = useState<"all" | "open" | "closed">("all");

    return (
        <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
            <Navbar />

            <main className="pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-white/5 pb-8">
                    <div>
                        <Link href="/" className="text-[10px] font-mono text-gray-500 hover:text-emerald-500 uppercase tracking-widest mb-4 block">
                            &larr; Return to Hub
                        </Link>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-white mb-2">
                            Active <span className="text-emerald-500">Bounties</span>
                        </h1>
                        <p className="text-gray-400 font-mono text-sm max-w-xl">
                            Browse active tasks. Submit proposals. Earn ETH for your work.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 mt-4 md:mt-0">
                        <button 
                            onClick={() => setFilter('all')}
                            className={`flex items-center gap-3 text-sm cursor-pointer w-full hover:text-white transition-colors ${filter === 'all' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <div className={`w-4 h-4 border border-zinc-700 bg-zinc-900 rounded-sm flex items-center justify-center ${filter === 'all' ? 'border-emerald-500' : ''}`}>
                                {filter === 'all' && <div className="w-2 h-2 bg-emerald-500"></div>}
                            </div>
                            All Bounties
                        </button>

                        <button 
                            onClick={() => setFilter('open')}
                            className={`flex items-center gap-3 text-sm cursor-pointer w-full hover:text-white transition-colors ${filter === 'open' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <div className={`w-4 h-4 border border-zinc-700 bg-zinc-900 rounded-sm flex items-center justify-center ${filter === 'open' ? 'border-emerald-500' : ''}`}>
                                {filter === 'open' && <div className="w-2 h-2 bg-emerald-500"></div>}
                            </div>
                            Open Bounties
                        </button>

                        <button 
                            onClick={() => setFilter('closed')}
                            className={`flex items-center gap-3 text-sm cursor-pointer w-full hover:text-white transition-colors ${filter === 'closed' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <div className={`w-4 h-4 border border-zinc-700 bg-zinc-900 rounded-sm flex items-center justify-center ${filter === 'closed' ? 'border-emerald-500' : ''}`}>
                                {filter === 'closed' && <div className="w-2 h-2 bg-emerald-500"></div>}
                            </div>
                            Closed / Verify
                        </button>
                    </div>
                </div>

                <BountyList filterStatus={filter} />
            </main>

            <Footer />
        </div>
    );
}
