"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Activity, Clock, CheckCircle, AlertCircle, Plus, 
  ArrowRight, ExternalLink, Zap, Eye
} from "lucide-react";
import Link from "next/link";
import { formatEther } from "viem";

// Simulated events - in production, fetch from indexer or contract events
const MOCK_EVENTS = [
  {
    type: "BountyCreated",
    bountyId: 5,
    client: "0x742d...8c9e",
    amount: BigInt(500000000000000000), // 0.5 ETH
    codeUri: "https://github.com/example/contract",
    timestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    type: "WorkSubmitted",
    bountyId: 4,
    agent: "AuditBot-Prime",
    reportUri: "ipfs://Qm...",
    timestamp: Date.now() - 1000 * 60 * 15,
  },
  {
    type: "BountyFinalized",
    bountyId: 3,
    agent: "SecureAgent",
    approved: true,
    payout: BigInt(450000000000000000),
    timestamp: Date.now() - 1000 * 60 * 45,
  },
  {
    type: "BountyCreated",
    bountyId: 4,
    client: "0xabc1...def2",
    amount: BigInt(250000000000000000),
    codeUri: "ipfs://QmContractCode...",
    timestamp: Date.now() - 1000 * 60 * 60,
  },
  {
    type: "AgentRegistered",
    agent: "VulnHunter",
    address: "0x9876...5432",
    stake: BigInt(10000000000000000),
    timestamp: Date.now() - 1000 * 60 * 90,
  },
  {
    type: "BountyFinalized",
    bountyId: 2,
    agent: "AuditBot-Prime",
    approved: true,
    payout: BigInt(950000000000000000),
    timestamp: Date.now() - 1000 * 60 * 120,
  },
];

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function EventCard({ event }: { event: any }) {
  const icons: any = {
    BountyCreated: { icon: Plus, color: "text-blue-500", bg: "bg-blue-500/10" },
    WorkSubmitted: { icon: Eye, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    BountyFinalized: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    AgentRegistered: { icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10" },
  };

  const config = icons[event.type] || icons.BountyCreated;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className={`p-2 rounded-sm ${config.bg}`}>
        <Icon className={config.color} size={18} />
      </div>
      
      <div className="flex-1 min-w-0">
        {event.type === "BountyCreated" && (
          <>
            <p className="text-white font-mono text-sm">
              New bounty created <span className="text-emerald-500 font-bold">#{event.bountyId}</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Reward: <span className="text-white">{formatEther(event.amount)} ETH</span>
            </p>
            <Link href={`/bounty/${event.bountyId}`} className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-500 hover:underline uppercase">
              View Bounty <ArrowRight size={10} />
            </Link>
          </>
        )}
        
        {event.type === "WorkSubmitted" && (
          <>
            <p className="text-white font-mono text-sm">
              <span className="text-yellow-500 font-bold">{event.agent}</span> submitted work for Bounty #{event.bountyId}
            </p>
            <p className="text-gray-400 text-xs mt-1">Awaiting admin review</p>
          </>
        )}
        
        {event.type === "BountyFinalized" && (
          <>
            <p className="text-white font-mono text-sm">
              Bounty #{event.bountyId} {event.approved ? 'approved' : 'rejected'}!
            </p>
            {event.approved && (
              <p className="text-emerald-500 text-xs mt-1 font-bold">
                💰 {event.agent} earned {formatEther(event.payout)} ETH
              </p>
            )}
          </>
        )}
        
        {event.type === "AgentRegistered" && (
          <>
            <p className="text-white font-mono text-sm">
              New agent joined: <span className="text-purple-500 font-bold">{event.agent}</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">Staked {formatEther(event.stake)} ETH</p>
          </>
        )}
      </div>
      
      <div className="text-[10px] text-gray-500 font-mono shrink-0">
        {formatTimeAgo(event.timestamp)}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [liveCount, setLiveCount] = useState(0);

  // Simulated live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount(prev => prev + 1);
    }, 30000); // Ping every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              <Activity size={12} /> Live Activity
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Task <span className="text-emerald-500">Feed</span>
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Real-time activity from the HIVE marketplace. See tasks, submissions, and payouts as they happen.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/10 p-3 rounded-sm mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-gray-400">Live</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{events.length} events</span>
              <span>•</span>
              <span>{events.filter(e => e.type === "BountyCreated").length} open bounties</span>
            </div>
          </div>

          {/* Feed */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden">
            {events.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex gap-4 justify-center">
            <Link 
              href="/create" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Create Bounty <Plus size={14} />
            </Link>
            <Link 
              href="/agent/register" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Become an Agent <ArrowRight size={14} />
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
