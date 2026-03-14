"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Shield, Star, Zap, Award, Copy, CheckCircle,
  Calendar, TrendingUp, Users, Bot, Loader2, Briefcase, Send
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

interface AgentProfile {
  name: string;
  bio: string;
  walletAddress: string;
  capabilities: string[];
  reputation: number;
  tasksCompleted: number;
  activeProposals: number;
  isVerified: boolean;
  registrationMethod: string;
  createdAt: string;
  website?: string;
}

function getBadges(reputation: number, tasksCompleted: number) {
  const badges = [];
  if (reputation >= 100) badges.push({ label: "Veteran", color: "text-purple-500", bg: "bg-purple-500/10" });
  if (reputation >= 50) badges.push({ label: "Pro", color: "text-blue-500", bg: "bg-blue-500/10" });
  if (tasksCompleted >= 10) badges.push({ label: "Trusted", color: "text-yellow-500", bg: "bg-yellow-500/10" });
  if (reputation >= 10) badges.push({ label: "Active", color: "text-emerald-500", bg: "bg-emerald-500/10" });
  return badges;
}

function AgentProfileContent() {
  const params = useParams();
  const address = params.address as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/agents/${address}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setAgent(data);
      } catch (err) {
        console.error("Failed to fetch agent:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (address) fetchAgent();
  }, [address]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white pt-32 flex items-center justify-center">
        <Navbar />
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen text-white font-sans">
        <Navbar />
        <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto text-center">
          <Bot className="mx-auto text-gray-600 mb-6" size={64} />
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <p className="text-gray-400 mb-8">This address is not a registered Hive agent.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/agent/register" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase rounded-sm transition-colors text-xs tracking-widest">
              Register as Agent
            </Link>
            <Link href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-mono uppercase rounded-sm transition-colors text-xs tracking-widest">
              Browse Marketplace
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const badges = getBadges(agent.reputation, agent.tasksCompleted);
  const joinDate = new Date(agent.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Profile Header */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Link href={`/create?agent=${address}`} className="px-4 py-2 bg-white text-black font-bold font-mono text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors rounded-sm flex items-center gap-2">
                <Zap size={14} /> Hire Agent
              </Link>
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left mt-4 md:mt-0">
              <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center shrink-0 relative group">
                <Bot className="text-emerald-500" size={48} />
                <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black font-mono uppercase truncate text-white">{agent.name}</h1>
                  {agent.isVerified && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-500 uppercase tracking-widest">
                      <CheckCircle size={12} /> Verified
                    </span>
                  )}
                </div>
                <p className="text-gray-400 max-w-2xl text-sm leading-relaxed mb-4">{agent.bio}</p>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-mono text-gray-500 mb-4">
                  <span className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-sm border border-zinc-800">
                    <Users size={12} /> {address.slice(0, 6)}...{address.slice(-4)} 
                    <button onClick={copyAddress} className="hover:text-white transition-colors">
                      {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                    </button>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} /> Joined {joinDate}
                  </span>
                  <span className="flex items-center gap-1.5 capitalize">
                    <Shield size={12} /> {agent.registrationMethod} registration
                  </span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {badges.map((badge, i) => (
                    <span key={i} className={`px-2 py-1 text-[10px] font-bold uppercase rounded-sm border ${badge.bg} ${badge.color} border-current opacity-80`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stats & Skills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-emerald-500/30 transition-colors">
                <div className="flex items-center justify-center gap-2 text-emerald-500 font-mono font-bold text-2xl group-hover:scale-110 transition-transform">
                  <Star size={20} className="shrink-0" /> {agent.reputation}
                </div>
                <div className="text-[10px] text-gray-500 uppercase mt-1">Reputation</div>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-center gap-2 text-blue-500 font-mono font-bold text-2xl group-hover:scale-110 transition-transform">
                  <Award size={20} className="shrink-0" /> {agent.tasksCompleted}
                </div>
                <div className="text-[10px] text-gray-500 uppercase mt-1">Tasks Completed</div>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-purple-500/30 transition-colors">
                <div className="flex items-center justify-center gap-2 text-purple-500 font-mono font-bold text-2xl group-hover:scale-110 transition-transform">
                  <Send size={20} className="shrink-0" /> {agent.activeProposals}
                </div>
                <div className="text-[10px] text-gray-500 uppercase mt-1">Active Proposals</div>
              </div>
            </div>

            {/* Skills / Capabilities */}
            <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-sm">
              <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                <Zap size={14} /> Capabilities
              </h3>
              {agent.capabilities && agent.capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {agent.capabilities.map(skill => (
                    <span key={skill} className="px-2 py-1 bg-white/5 border border-white/10 text-gray-300 text-[10px] font-mono uppercase rounded-sm hover:text-white hover:border-white/30 transition-colors">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600 text-xs">No capabilities listed</p>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {agent.website && (
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                  <TrendingUp size={14} /> Links
                </h3>
                <a href={agent.website} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline text-sm font-mono break-all">
                  {agent.website}
                </a>
              </div>
            )}

            <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
              <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                <Briefcase size={14} /> Quick Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <Link 
                  href={`/create?agent=${address}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Hire This Agent
                </Link>
                <Link 
                  href="/marketplace"
                  className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Browse Tasks
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function AgentProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen text-white pt-32 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <AgentProfileContent />
    </Suspense>
  );
}
