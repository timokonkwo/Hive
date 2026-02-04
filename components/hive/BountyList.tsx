"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { Loader2, ArrowRight, Shield, Clock } from "lucide-react";
import Link from "next/link";

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

export const BountyList = ({ filterStatus = 'all' }: { filterStatus?: 'all' | 'open' | 'closed' }) => {
  // 1. Get the total number of bounties
  const { data: counter } = useReadContract({
    address: AUDIT_BOUNTY_ESCROW_ADDRESS,
    abi: ABI,
    functionName: "bountyCounter",
    chainId: 84532,
  });

  const count = counter ? Number(counter) : 0;
  
  // 2. Prepare calls for the last 20 bounties (or all if < 20)
  // We want to show the newest first.
  const bountyIds: number[] = [];
  if (count > 0) {
      // Loop from count down to max(1, count - 20) for broader filtering context
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

  if (isLoading && count > 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-[#0A0A0A] border border-white/10 rounded-sm">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="p-8 text-center bg-[#0A0A0A] border border-white/10 rounded-sm">
        <Shield className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest">No Active Bounties</h3>
        <p className="text-gray-600 text-xs mt-1">Be the first to deploy code for analysis.</p>
        <Link href="/create" className="mt-4 inline-block px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold font-mono uppercase tracking-widest rounded-sm transition-colors">
            Deploy Now
        </Link>
      </div>
    );
  }

  // Filter the results
  const filteredBounties = bountiesData?.map((result, index) => {
      if (!result.result) return null;
      return { ...result.result as any, id: bountyIds[index] };
  }).filter(bounty => {
      if (!bounty) return false;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'open') return bounty.isOpen;
      if (filterStatus === 'closed') return !bounty.isOpen;
      return true;
  }) || [];

  if (filteredBounties.length === 0) {
       return (
        <div className="p-12 text-center bg-[#0A0A0A] border border-white/10 rounded-sm">
            <p className="text-gray-500 font-mono text-sm">No {filterStatus} bounties found.</p>
        </div>
       );
  }

  return (
    <div className="space-y-4">
      {filteredBounties.map((bounty) => {
        const id = bounty.id;
        
        return (
            <Link href={`/bounty/${id}`} key={id} className="block group bg-[#0A0A0A] border border-white/10 hover:border-violet-500/50 p-5 rounded-sm transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-violet-500 w-4 h-4 -rotate-45" />
                </div>
                
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${bounty.isOpen ? "bg-emerald-500 shadow-[0_0_8px_#10B981]" : "bg-gray-500"}`}></div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                            Bounty #{id}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-white font-bold font-mono">
                        <span className="text-lg">{formatEther(bounty.amount)}</span>
                        <span className="text-xs text-gray-500">ETH</span>
                    </div>
                </div>
                
                <div className="mb-4">
                    <p className="text-xs text-gray-300 font-mono truncate bg-white/5 p-2 rounded-sm border border-white/5 group-hover:bg-white/10 transition-colors">
                        {bounty.codeUri}
                    </p>
                </div>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 font-mono uppercase">
                        <Clock size={12} />
                        {new Date(Number(bounty.createdAt) * 1000).toLocaleDateString()}
                    </div>
                    
                    {bounty.isOpen ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-sm border border-emerald-500/20 font-mono uppercase tracking-wide">
                            Open for Agents
                        </span>
                    ) : (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-sm font-mono uppercase tracking-wide">
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
