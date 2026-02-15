"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { Loader2, ArrowRight, Shield, Clock, Filter, ChevronDown, Code, Cpu, PenTool, Layout } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { parseMetadata } from "@/lib/ipfs";
import { TaskMetadata, TaskCategory } from "@/lib/types/task";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
  {
    inputs: [],
    name: "bountyCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_bountyId", type: "uint256" }],
    name: "getBounty",
    outputs: [
      {
        components: [
          { internalType: "address", name: "client", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "string", name: "codeUri", type: "string" },
          { internalType: "bool", name: "isOpen", type: "bool" },
          { internalType: "address", name: "assignedAgent", type: "address" },
          { internalType: "string", name: "reportUri", type: "string" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
        ],
        internalType: "struct AuditBountyEscrow.Bounty",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface BountyListProps {
    filterStatus?: 'all' | 'open' | 'closed';
    selectedCategory?: TaskCategory | 'All';
}

export const BountyList = ({ filterStatus = 'all', selectedCategory = 'All' }: BountyListProps) => {
  const [sortBy, setSortBy] = useState<'newest' | 'reward'>('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // 1. Get the total number of bounties
  const { data: counter } = useReadContract({
    address: AUDIT_BOUNTY_ESCROW_ADDRESS,
    abi: ABI,
    functionName: "bountyCounter",
    chainId: 84532,
  });

  const count = counter ? Number(counter) : 0;
  
  // 2. Prepare calls for the last 20 bounties (or all if < 20)
  const bountyIds: number[] = [];
  if (count > 0) {
      for (let i = count; i >= Math.max(1, count - 20); i--) {
          bountyIds.push(i);
      }
  }

  const { data: bountiesData, isLoading } = useReadContracts({
    contracts: bountyIds.map((id) => ({
      address: AUDIT_BOUNTY_ESCROW_ADDRESS,
      abi: ABI,
      functionName: "getBounty",
      args: [BigInt(id)],
      chainId: 84532,
    })),
  });

  // Process and Filter Bounties
  const processedBounties = useMemo(() => {
    if (!bountiesData) return [];

    return bountiesData
        .map((result, index) => {
            if (!result.result) return null;
            const rawBounty = result.result as any;
            
            // Parse Metadata
            const metadata = parseMetadata(rawBounty.codeUri) || {
                title: "Legacy Task",
                description: rawBounty.codeUri,
                category: 'Other', // Fallback for legacy items
                tags: []
            } as TaskMetadata;

            return { 
                ...rawBounty, 
                id: bountyIds[index],
                metadata 
            };
        })
        .filter(bounty => {
            if (!bounty) return false;
            
            // Status Filter
            if (filterStatus === 'open' && !bounty.isOpen) return false;
            if (filterStatus === 'closed' && bounty.isOpen) return false;

            // Category Filter
            if (selectedCategory !== 'All') {
                // If metadata category is undefined/null, treat as 'Other' or skip?
                // Let's treat undefined as 'Security' if it looks like a legacy audit 
                // but we handled that in parseMetadata fallback.
                if (bounty.metadata.category !== selectedCategory) return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'reward') {
                return Number(b.amount) - Number(a.amount);
            }
            return b.id - a.id; 
        });
  }, [bountiesData, filterStatus, sortBy, bountyIds, selectedCategory]);

  if (isLoading && count > 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-[#0A0A0A] border border-white/10 rounded-sm">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="p-8 text-center bg-[#0A0A0A] border border-white/10 rounded-sm">
        <Shield className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">No Active Tasks</h3>
        <p className="text-gray-600 text-xs mt-1">Be the first to hire an autonomous agent.</p>
        <Link href="/create" className="mt-4 inline-block px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold font-mono uppercase tracking-widest rounded-sm transition-colors">
            Create Task
        </Link>
      </div>
    );
  }

  if (processedBounties.length === 0) {
       return (
        <div className="p-12 text-center bg-[#0A0A0A] border border-white/10 rounded-sm">
            <p className="text-gray-500 font-mono text-sm">No {filterStatus} tasks found in this category.</p>
        </div>
       );
  }

  const getCategoryIcon = (category: string) => {
      switch(category) {
          case 'Security': return <Shield size={14} className="text-emerald-500" />;
          case 'Development': return <Code size={14} className="text-blue-500" />;
          case 'Analysis': return <Cpu size={14} className="text-purple-500" />;
          case 'Content': return <PenTool size={14} className="text-orange-500" />;
          case 'Design': return <Layout size={14} className="text-pink-500" />;
          default: return <Shield size={14} className="text-gray-500" />;
      }
  };

  return (
    <div className="space-y-4">
      {/* Sorting Header */}
      <div className="flex justify-end mb-4 relative">
        <button 
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
        >
            <Filter size={12} />
            Sort: <span className="text-emerald-400">{sortBy === 'newest' ? 'Newest' : 'Reward'}</span>
            <ChevronDown size={12} />
        </button>
        
        {isSortOpen && (
            <div className="absolute top-8 right-0 bg-[#0A0A0A] border border-zinc-800 rounded-sm p-1 z-10 min-w-[120px] shadow-xl">
                <button 
                    onClick={() => { setSortBy('newest'); setIsSortOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-900 transition-colors ${sortBy === 'newest' ? 'text-emerald-400' : 'text-gray-400'}`}
                >
                    Newest
                </button>
                <button 
                    onClick={() => { setSortBy('reward'); setIsSortOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-900 transition-colors ${sortBy === 'reward' ? 'text-emerald-400' : 'text-gray-400'}`}
                >
                    Highest Reward
                </button>
            </div>
        )}
      </div>

      {processedBounties.map((bounty) => {
        const id = bounty.id;
        const meta = bounty.metadata;
        
        return (
            <Link href={`/bounty/${id}`} key={id} className="block group bg-[#0A0A0A] border border-white/10 hover:border-emerald-500/50 p-5 rounded-sm transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-emerald-500 w-4 h-4 -rotate-45" />
                </div>
                
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                         <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border flex items-center gap-1.5 ${
                             meta.category === 'Security' ? 'bg-emerald-900/10 text-emerald-500 border-emerald-500/20' :
                             meta.category === 'Development' ? 'bg-blue-900/10 text-blue-500 border-blue-500/20' :
                             meta.category === 'Analysis' ? 'bg-purple-900/10 text-purple-500 border-purple-500/20' :
                             meta.category === 'Design' ? 'bg-pink-900/10 text-pink-500 border-pink-500/20' :
                             'bg-gray-800 text-gray-400 border-gray-700'
                         }`}>
                             {getCategoryIcon(meta.category)}
                             {meta.category}
                         </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                            Task #{id}
                        </span>
                    </div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate pr-8">
                         {meta.title}
                     </h3>
                     <div className="flex items-center gap-1 text-white font-bold font-mono shrink-0 ml-4">
                        <span className="text-lg">{formatEther(bounty.amount)}</span>
                        <span className="text-xs text-gray-500">ETH</span>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 font-mono uppercase">
                        <Clock size={12} />
                        {new Date(Number(bounty.createdAt) * 1000).toLocaleDateString()}
                    </div>
                    
                    {bounty.isOpen ? (
                        <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-wide flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Open for Agents
                        </span>
                    ) : (
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wide">
                            Closed
                        </span>
                    )}
                </div>
            </Link>
        );
      })}
    </div>
  );
};
