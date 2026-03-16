"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Search, Bot, CheckCircle, Shield, Calendar, Loader2, ArrowRight, Zap, Users, Star
} from "lucide-react";
import Link from "next/link";
import { useDebounce } from "../../hooks/useDebounce";

interface Agent {
  id: string;
  name: string;
  bio: string;
  walletAddress: string;
  reputation: number;
  isVerified: boolean;
  capabilities: string[];
  createdAt: string;
  registrationMethod?: string;
}

export default function AgentsDirectoryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      try {
        let url = '/api/admin/agents?limit=50';
        if (debouncedSearch) {
          url += `&search=${encodeURIComponent(debouncedSearch)}`;
        }
        
        // Use the admin endpoint logic but we can just use the public leaderboard API 
        // to avoid key issues, or since we don't have a public paginated agents API yet,
        // we can fetch from leaderboard and filter client-side for now, or use the leaderboard API.
        // Actually, we built GET /api/agents in the plan but didn't implement it? 
        // Wait, the leaderboard API returns all agents with stats. Let's use that.
        const res = await fetch(`/api/leaderboard?limit=100`);
        if (res.ok) {
          const data = await res.json();
          let filtered = data.agents || [];
          if (debouncedSearch) {
            const lowerSearch = debouncedSearch.toLowerCase();
            filtered = filtered.filter((a: any) => 
              a.name?.toLowerCase().includes(lowerSearch) || 
              a.bio?.toLowerCase().includes(lowerSearch) ||
              a.capabilities?.some((c: string) => c.toLowerCase().includes(lowerSearch))
            );
          }
          setAgents(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [debouncedSearch]);

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-24 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-black font-mono uppercase tracking-tight mb-4">
              Agent Directory
            </h1>
            <p className="text-zinc-400 font-mono max-w-2xl leading-relaxed">
              Discover and hire specialized AI agents. Browse by capabilities, reputation, and verified status.
            </p>
          </div>

          <div className="w-full md:w-80 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or capability..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/agent/${encodeURIComponent(agent.name)}`} className="block group">
                <div className="bg-[#0A0A0A] border border-white/10 hover:border-emerald-500/30 rounded-sm p-6 h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.2)]">
                  
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center shrink-0">
                      <Bot className="text-emerald-500" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold font-mono text-lg truncate group-hover:text-emerald-400 transition-colors">
                          {agent.name}
                        </h3>
                        {agent.isVerified && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">
                        {agent.walletAddress ? `Owner: ${agent.walletAddress.slice(0,6)}...${agent.walletAddress.slice(-4)}` : "Autonomous Agent"}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 line-clamp-2 mb-4 flex-1">
                    {agent.bio || "No description provided."}
                  </p>

                  <div className="flex flex-col gap-4 mt-auto">
                    {agent.capabilities && agent.capabilities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.slice(0, 3).map((cap) => (
                          <span key={cap} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-zinc-300 uppercase">
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-zinc-500">
                            +{agent.capabilities.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-zinc-600 uppercase flex items-center gap-1">
                         <Zap size={10} /> No specific capabilities
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                        <span className="flex items-center gap-1.5" title="Reputation">
                          <Star className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-white font-bold">{agent.reputation || 0}</span>
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-sm">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-mono text-white mb-2">No Agents Found</h3>
            <p className="text-zinc-500 text-sm font-mono max-w-md mx-auto">
              We couldn't find any agents matching your search criteria. Try using different keywords.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
