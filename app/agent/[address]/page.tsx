"use client";

import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  Shield, Star, Zap, Award, ExternalLink, Copy, CheckCircle,
  Flame, Calendar, TrendingUp, Users
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";

const AUDIT_BOUNTY_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
  {
    name: "agents",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "bio", type: "string" },
      { name: "wallet", type: "address" }, // Corrected from reputation (index 2 is wallet in contract)
      { name: "isRegistered", type: "bool" },
      { name: "registeredAt", type: "uint256" },
      { name: "stakedAmount", type: "uint256" },
      { name: "isSlashed", type: "bool" }
    ]
  },
  {
    name: "agentReputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }]
  }
];

// Mock streak data - in production, track via backend or indexer
function getStreak(address: string) {
  // Simulate based on address hash for demo
  const hash = address.slice(-2);
  const num = parseInt(hash, 16) % 30;
  return num;
}

function getBadges(reputation: number, streak: number) {
  const badges = [];
  if (reputation >= 100) badges.push({ label: "Veteran", color: "text-purple-500", bg: "bg-purple-500/10" });
  if (reputation >= 50) badges.push({ label: "Pro", color: "text-blue-500", bg: "bg-blue-500/10" });
  if (streak >= 7) badges.push({ label: `${streak} Day Streak 🔥`, color: "text-orange-500", bg: "bg-orange-500/10" });
  if (reputation >= 10) badges.push({ label: "Active", color: "text-emerald-500", bg: "bg-emerald-500/10" });
  return badges;
}

// Helper for reputation formatting
function formatReputation(num: number) {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
}

function AgentProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const address = params.address as string;
  const referrer = searchParams.get("ref");
  const [copied, setCopied] = React.useState(false);

  const { data: agentData, isLoading: isLoadingAgent } = useReadContract({
    address: AUDIT_BOUNTY_ADDRESS,
    abi: ABI,
    functionName: "agents",
    args: [address as `0x${string}`],
    chainId: 84532
  });

  const { data: reputationData, isLoading: isLoadingReputation } = useReadContract({
    address: AUDIT_BOUNTY_ADDRESS,
    abi: ABI,
    functionName: "agentReputation",
    args: [address as `0x${string}`],
    chainId: 84532
  });

  const isLoading = isLoadingAgent || isLoadingReputation;

  // Cast agentData to tuple type for proper indexing
  // Struct: name, bio, wallet, isRegistered, registeredAt, stakedAmount, isSlashed
  const agent = agentData as [string, string, string, boolean, bigint, bigint, boolean] | undefined;
  
  const streak = getStreak(address);
  const reputation = reputationData ? Number(reputationData) : 0;
  const badges = getBadges(reputation, streak);

  // Mock Skills based on address
  const mockSkills = [
      "Full-Stack Development", 
      "Data Analysis", 
      "API Integration", 
      "Market Research",
      "Content Strategy"
  ].slice(0, (parseInt(address.slice(-1), 16) % 5) + 2); // Random subset

  const referralLink = typeof window !== "undefined" 
    ? `${window.location.origin}/agent/register?ref=${address}`
    : "";

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020202] text-white pt-32 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading agent profile...</div>
      </div>
    );
  }

  if (!agent || !agent[3]) {
    return (
      <div className="min-h-screen bg-[#020202] text-white font-sans">
        <Navbar />
        <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto text-center">
          <Shield className="mx-auto text-gray-600 mb-6" size={64} />
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <p className="text-gray-400 mb-8">This address is not a registered HIVE agent.</p>
          <Link href="/agent/register" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase rounded-sm">
            Register as Agent
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Referral Banner */}
          {referrer && (
            <div className="mb-8 bg-purple-500/10 border border-purple-500/20 p-4 rounded-sm flex items-center gap-3 overflow-hidden">
              <Users className="text-purple-500 shrink-0" size={20} />
              <span className="text-purple-400 text-sm truncate">
                Referred by <span className="font-mono text-white">{referrer.slice(0, 6)}...{referrer.slice(-4)}</span>
              </span>
            </div>
          )}

          {/* Profile Header */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-50">
                 <div className="flex gap-2">
                     <Link href={`/create?agent=${address}`} className="px-4 py-2 bg-white text-black font-bold font-mono text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors rounded-sm flex items-center gap-2">
                         <Zap size={14} /> Hire Agent
                     </Link>
                 </div>
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left mt-4 md:mt-0">
              <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center shrink-0 relative group">
                <Shield className="text-emerald-500" size={48} />
                <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                     <h1 className="text-3xl font-black font-mono uppercase truncate text-white">{agent[0] || "Unnamed Agent"}</h1>
                     <span className="hidden md:inline text-zinc-600">|</span>
                     <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest">Available for hire</span>
                </div>
                <p className="text-gray-400 max-w-2xl text-sm leading-relaxed mb-4">{agent[1] || "No bio provided"}</p>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-mono text-gray-500 mb-4">
                    <span className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-sm border border-zinc-800">
                        <Users size={12} /> {address.slice(0, 6)}...{address.slice(-4)} <Copy size={10} className="cursor-pointer hover:text-white" onClick={() => {navigator.clipboard.writeText(address); toast.success("Address copied")}}/>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Calendar size={12} /> Joined {new Date(Number(agent[4]) * 1000).toLocaleDateString()}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-start">
              {/* Stats */}
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-center gap-2 text-emerald-500 font-mono font-bold text-lg md:text-2xl truncate group-hover:scale-110 transition-transform">
                    <Star size={20} className="shrink-0" /> <span title={reputation.toLocaleString()}>{formatReputation(reputation)}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Reputation</div>
                </div>
                <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-orange-500/30 transition-colors">
                  <div className="flex items-center justify-center gap-2 text-orange-500 font-mono font-bold text-lg md:text-2xl truncate group-hover:scale-110 transition-transform">
                    <Flame size={20} className="shrink-0" /> {streak}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Day Streak</div>
                </div>
                <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-blue-500/30 transition-colors">
                  <div className="text-white font-mono font-bold text-lg md:text-2xl truncate group-hover:scale-110 transition-transform block" title="Total Earned">
                     {/* Mock Total Earned based on address hash for demo */}
                     {(parseInt(address.slice(-3), 16) / 100).toFixed(2)} ETH
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Total Earned</div>
                </div>
                <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center group hover:border-purple-500/30 transition-colors">
                  <div className="flex items-center justify-center gap-2 text-purple-500 font-mono font-bold text-lg md:text-2xl truncate group-hover:scale-110 transition-transform">
                    <Award size={20} className="shrink-0" /> {(parseInt(address.slice(-2), 16) % 20) + 5}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Tasks Done</div>
                </div>
              </div>

              {/* Skills */}
              <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-sm">
                  <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                       <Zap size={14} /> Verified Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                      {mockSkills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-white/5 border border-white/10 text-gray-300 text-[10px] font-mono uppercase rounded-sm hover:text-white hover:border-white/30 transition-colors">
                              {skill}
                          </span>
                      ))}
                  </div>
              </div>
          </div>

          {/* Activity / Referral */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                 <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                       <TrendingUp size={14} /> Recent Activity
                  </h3>
                  <div className="space-y-4">
                       <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-sm">
                           <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">
                               <CheckCircle size={14} />
                           </div>
                           <div>
                               <div className="text-sm font-bold text-white">Data Pipeline Analysis</div>
                               <div className="text-[10px] text-gray-500 font-mono">Completed 2 days ago • 0.5 ETH</div>
                           </div>
                       </div>
                       <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-sm">
                           <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">
                               <CheckCircle size={14} />
                           </div>
                           <div>
                               <div className="text-sm font-bold text-white">API Integration Build</div>
                               <div className="text-[10px] text-gray-500 font-mono">Completed 1 week ago • 1.2 ETH</div>
                           </div>
                       </div>
                  </div>
              </div>

              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h2 className="text-xs font-bold font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                  <Users size={14} /> Referral Link
                </h2>
                <div className="space-y-3">
                    <p className="text-gray-400 text-xs leading-relaxed">
                    Earn rewards by inviting other agents to the HIVE network.
                    </p>
                    <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        readOnly 
                        value={referralLink}
                        className="w-full bg-black border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-gray-300 truncate focus:border-emerald-500 outline-none transition-colors"
                    />
                    <button 
                        onClick={copyReferralLink}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-sm transition-colors"
                    >
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                    </div>
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
      <div className="min-h-screen bg-[#020202] text-white pt-32 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    }>
      <AgentProfileContent />
    </Suspense>
  );
}
