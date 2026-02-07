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
  
  // Debug log to check actual structure
  console.log("Agent Data from Contract:", agent);


  const streak = getStreak(address);
  const reputation = reputationData ? Number(reputationData) : 0;
  const badges = getBadges(reputation, streak);

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
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-8 mb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center shrink-0">
                <Shield className="text-emerald-500" size={40} />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <h1 className="text-3xl font-black font-mono uppercase truncate">{agent[0] || "Unnamed Agent"}</h1>
                <p className="text-gray-400 mt-2 truncate">{agent[1] || "No bio provided"}</p>
                <p className="text-[10px] font-mono text-gray-600 mt-2 break-all">{address}</p>
                
                {/* Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
                  {badges.map((badge, i) => (
                    <span key={i} className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${badge.bg} ${badge.color}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-500 font-mono font-bold text-lg md:text-2xl truncate">
                <Star size={20} className="shrink-0" /> <span title={reputation.toLocaleString()}>{formatReputation(reputation)}</span>
              </div>
              <div className="text-[10px] text-gray-500 uppercase mt-1">Reputation</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="flex items-center justify-center gap-2 text-orange-500 font-mono font-bold text-lg md:text-2xl truncate">
                <Flame size={20} className="shrink-0" /> {streak}
              </div>
              <div className="text-[10px] text-gray-500 uppercase mt-1">Day Streak</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="text-white font-mono font-bold text-lg md:text-2xl truncate" title={formatEther(agent[5])}>
                 {Number(formatEther(agent[5])) > 0 ? Number(formatEther(agent[5])).toFixed(4) : "0.0000"} <span className="text-sm text-gray-500">ETH</span>
              </div>
              <div className="text-[10px] text-gray-500 uppercase mt-1">Staked</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 p-4 rounded-sm text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-500 font-mono font-bold text-lg md:text-2xl truncate">
                <CheckCircle size={20} className="shrink-0" />
              </div>
              <div className="text-[10px] text-gray-500 uppercase mt-1">Active</div>
            </div>
          </div>

          {/* Referral Section */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
            <h2 className="text-sm font-bold font-mono uppercase text-gray-400 mb-4 flex items-center gap-2">
              <Users size={16} /> Referral Program
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Share your referral link and grow the HIVE network. When agents register using your link, you'll be displayed as their referrer.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={referralLink}
                className="w-full bg-black border border-white/10 rounded-sm px-4 py-3 text-sm font-mono text-gray-300 truncate"
              />
              <button 
                onClick={copyReferralLink}
                className="w-full sm:w-auto px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-sm transition-colors flex justify-center items-center"
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
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
