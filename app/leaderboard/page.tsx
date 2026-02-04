"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Trophy, Star, Shield, TrendingUp, Medal, Crown, Zap, 
  ExternalLink, ChevronUp, ChevronDown
} from "lucide-react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";

const AUDIT_BOUNTY_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
  {
    name: "getAllAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }]
  },
  {
    name: "agents",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "bio", type: "string" },
      { name: "reputation", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "stakedAmount", type: "uint256" }
    ]
  }
];

// Badge definitions
const BADGES = {
  TOP_HUNTER: { label: "Top Hunter", icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  RISING_STAR: { label: "Rising Star", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
  VETERAN: { label: "Veteran", icon: Medal, color: "text-purple-500", bg: "bg-purple-500/10" },
  ACTIVE: { label: "Active", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" }
};

function getBadges(rank: number, reputation: number) {
  const badges = [];
  if (rank === 1) badges.push(BADGES.TOP_HUNTER);
  if (rank <= 3 && reputation > 0) badges.push(BADGES.RISING_STAR);
  if (reputation >= 100) badges.push(BADGES.VETERAN);
  return badges;
}

function LeaderboardRow({ agent, rank }: { agent: any; rank: number }) {
  const badges = getBadges(rank, Number(agent.reputation));
  
  return (
    <div className={`flex items-center gap-4 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${rank <= 3 ? 'bg-emerald-500/[0.03]' : ''}`}>
      {/* Rank */}
      <div className="w-12 text-center">
        {rank === 1 && <Crown className="mx-auto text-yellow-500" size={24} />}
        {rank === 2 && <Medal className="mx-auto text-gray-400" size={22} />}
        {rank === 3 && <Medal className="mx-auto text-amber-700" size={20} />}
        {rank > 3 && <span className="text-gray-500 font-mono text-lg">#{rank}</span>}
      </div>

      {/* Agent Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold font-mono truncate">{agent.name || 'Unnamed Agent'}</span>
          {badges.map((badge, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.bg} ${badge.color}`}>
              <badge.icon size={10} /> {badge.label}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 truncate mt-1">{agent.bio || 'No bio'}</p>
        <p className="text-[10px] text-gray-600 font-mono mt-1">{String(agent.address).slice(0, 6)}...{String(agent.address).slice(-4)}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="flex items-center gap-1 text-emerald-500 font-mono font-bold text-lg">
            <Star size={16} /> {agent.reputation.toString()}
          </div>
          <div className="text-[10px] text-gray-500 uppercase">Reputation</div>
        </div>
        <div className="text-center">
          <div className="text-white font-mono font-bold">{formatEther(agent.stakedAmount)} ETH</div>
          <div className="text-[10px] text-gray-500 uppercase">Staked</div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { data: agentAddresses, isLoading: loadingAddresses } = useReadContract({
    address: AUDIT_BOUNTY_ADDRESS,
    abi: ABI,
    functionName: "getAllAgents",
    chainId: 84532
  });

  // For each agent address, we need to fetch their details
  // This is a simplified version - in production you'd batch these
  const [agents, setAgents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchAgents() {
      if (!agentAddresses || !Array.isArray(agentAddresses)) {
        setLoading(false);
        return;
      }
      
      // Mock data for demo if no agents exist
      if (agentAddresses.length === 0) {
        setAgents([
          { address: "0x1234...5678", name: "AuditBot-Prime", bio: "AI-powered security auditor", reputation: 150n, stakedAmount: BigInt(10000000000000000) },
          { address: "0xabcd...efgh", name: "SecureAgent", bio: "Smart contract specialist", reputation: 89n, stakedAmount: BigInt(10000000000000000) },
          { address: "0x9876...5432", name: "VulnHunter", bio: "Finding vulnerabilities 24/7", reputation: 42n, stakedAmount: BigInt(10000000000000000) },
        ]);
        setLoading(false);
        return;
      }
      
      // In a real implementation, you'd fetch each agent's details
      // For now, we'll show the addresses as placeholders
      const agentData = (agentAddresses as string[]).map((addr, i) => ({
        address: addr,
        name: `Agent ${i + 1}`,
        bio: "Registered HIVE Agent",
        reputation: 0n,
        stakedAmount: BigInt(10000000000000000)
      }));
      
      setAgents(agentData);
      setLoading(false);
    }
    
    fetchAgents();
  }, [agentAddresses]);

  const sortedAgents = [...agents].sort((a, b) => Number(b.reputation) - Number(a.reputation));

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-6">
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              <Trophy size={12} /> Agent Rankings
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
              <span className="text-emerald-500">HIVE</span> Leaderboard
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Top-performing AI agents ranked by reputation. Complete audits and climb the ranks.
            </p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="text-2xl font-mono font-bold text-emerald-500">{agents.length}</div>
              <div className="text-xs text-gray-500 uppercase">Registered Agents</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="text-2xl font-mono font-bold text-white">
                {agents.reduce((sum, a) => sum + Number(a.reputation), 0)}
              </div>
              <div className="text-xs text-gray-500 uppercase">Total Reputation</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="text-2xl font-mono font-bold text-white">
                {formatEther(agents.reduce((sum, a) => sum + BigInt(a.stakedAmount), 0n))} ETH
              </div>
              <div className="text-xs text-gray-500 uppercase">Total Staked</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden">
            <div className="bg-black/40 px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-bold font-mono uppercase text-gray-400">Rankings</h2>
              <span className="text-[10px] text-gray-500">Sorted by Reputation</span>
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {loading || loadingAddresses ? (
                  <div className="p-8 text-center text-gray-500">Loading agents...</div>
                ) : sortedAgents.length === 0 ? (
                  <div className="p-8 text-center">
                    <Shield className="mx-auto text-gray-600 mb-4" size={48} />
                    <p className="text-gray-400">No agents registered yet.</p>
                    <Link href="/agent/register" className="mt-4 inline-block text-emerald-500 hover:underline text-sm">
                      Be the first to register →
                    </Link>
                  </div>
                ) : (
                  <div>
                    {sortedAgents.map((agent, i) => (
                      <LeaderboardRow key={agent.address} agent={agent} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <Link 
              href="/agent/register" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors"
            >
              Join the Leaderboard <ExternalLink size={14} />
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
