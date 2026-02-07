"use client";

import React from "react";
import { useReadContract, useWriteContract, useReadContracts } from "wagmi";
import { formatEther, parseAbiItem } from "viem";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Shield, Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const BOUNTY_ABI = [
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
  {
      inputs: [],
      name: "owner",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
  },
  {
      inputs: [
          { internalType: "uint256", name: "_bountyId", type: "uint256" },
          { internalType: "address", name: "_agent", type: "address" },
          { internalType: "bool", name: "_isValid", type: "bool" },
          { internalType: "uint256", name: "_scoreToAdd", type: "uint256" }
      ],
      name: "finalizeBounty",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
  }
] as const;

// Define Bounty interface
interface Bounty {
    client: string;
    amount: bigint;
    codeUri: string;
    isOpen: boolean;
    assignedAgent: string;
    reportUri: string;
    createdAt: bigint;
}

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const { writeContract, isPending: isFinalizing } = useWriteContract();
    
    // Check owner
    const { data: ownerAddress } = useReadContract({
        address: AUDIT_BOUNTY_ESCROW_ADDRESS,
        abi: BOUNTY_ABI,
        functionName: "owner",
        chainId: 84532
    });

    // TODO: Fetch all bounties and filter for those needing review (assignedAgent != 0 and isOpen == true)
    // For now, we might iterate IDs 0-20 as a simple indexer
    const bountyIds = Array.from({ length: 20 }, (_, i) => BigInt(i));
    
    const { data: bountiesData, isLoading } = useReadContracts({
        contracts: bountyIds.map(id => ({
            address: AUDIT_BOUNTY_ESCROW_ADDRESS,
            abi: BOUNTY_ABI,
            functionName: "getBounty",
            args: [id],
            chainId: 84532
        }))
    });

    const pendingBounties = bountiesData?.map((result, index) => {
        const bounty = result.result as unknown as Bounty;
        return {
            id: index,
            data: bounty
        };
    }).filter(b => 
        b.data && 
        b.data.isOpen && 
        b.data.assignedAgent !== "0x0000000000000000000000000000000000000000"
    );

    const handleFinalize = (bountyId: number, agent: string, isValid: boolean) => {
        writeContract({
            address: AUDIT_BOUNTY_ESCROW_ADDRESS,
            abi: BOUNTY_ABI,
            functionName: "finalizeBounty",
            args: [BigInt(bountyId), agent as `0x${string}`, isValid, BigInt(10)], // Default 10 score points
            chainId: 84532
        }, {
            onSuccess: () => toast.success(`Bounty #${bountyId} finalized as ${isValid ? "Valid" : "Invalid"}`),
            onError: (err) => toast.error("Finalization failed: " + (err as any).message)
        });
    };

    if (isLoading) return <div className="min-h-screen bg-[#020202] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

    if (user?.wallet?.address !== ownerAddress) {
        return (
            <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center">
                <AlertTriangle className="text-red-500 mb-4" size={48} />
                <h1 className="text-2xl font-bold font-mono uppercase tracking-widest">Access Denied</h1>
                <p className="text-gray-500 mt-2">You are not the protocol administrator.</p>
                <Link href="/" className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm font-mono text-sm uppercase tracking-widest transition-colors">Return to Marketplace</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
            <Navbar />
            
            <main className="pt-32 pb-20 px-4 md:px-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <h1 className="text-3xl font-black font-mono uppercase tracking-tight flex items-center gap-3">
                        <Shield size={32} className="text-emerald-500" /> Admin Validation
                    </h1>
                    <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-sm text-xs font-mono font-bold uppercase tracking-widest">
                        Protocol Admin
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {pendingBounties && pendingBounties.length > 0 ? (
                        pendingBounties.map((bounty) => (
                            <div key={bounty.id} className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6 flex flex-col md:flex-row gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-emerald-500 font-mono font-bold text-lg">#{bounty.id}</span>
                                        <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-widest border border-yellow-500/20">Needs Review</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="bg-black p-3 rounded-sm border border-white/5">
                                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Target Code</div>
                                            <div className="text-xs text-white font-mono truncate">{bounty.data?.codeUri}</div>
                                            <a href={bounty.data?.codeUri.startsWith('http') ? bounty.data?.codeUri : `https://ipfs.io/ipfs/${bounty.data?.codeUri}`} target="_blank" className="text-[10px] text-emerald-500 hover:underline mt-1 block">View Code</a>
                                        </div>
                                        <div className="bg-black p-3 rounded-sm border border-white/5">
                                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Submitted Report</div>
                                            <div className="text-xs text-white font-mono truncate">{bounty.data?.reportUri}</div>
                                            <a href={bounty.data?.reportUri.startsWith('http') ? bounty.data?.reportUri : `https://ipfs.io/ipfs/${bounty.data?.reportUri}`} target="_blank" className="text-[10px] text-emerald-500 hover:underline mt-1 block">View Report</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                        <span>Agent: {bounty.data?.assignedAgent}</span>
                                        <span>•</span>
                                        <span>Reward: {formatEther(bounty.data?.amount || 0n)} ETH</span>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center gap-3 border-l border-white/10 pl-6 border-t md:border-t-0 pt-6 md:pt-0">
                                    <button 
                                        onClick={() => handleFinalize(bounty.id, bounty.data!.assignedAgent, true)}
                                        disabled={isFinalizing}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest text-xs rounded-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={14} /> Approve & Pay
                                    </button>
                                    <button 
                                        onClick={() => handleFinalize(bounty.id, bounty.data!.assignedAgent, false)}
                                        disabled={isFinalizing}
                                        className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-500/20 hover:border-red-500/40 font-bold font-mono uppercase tracking-widest text-xs rounded-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-[#0A0A0A] border border-white/10 rounded-sm">
                            <CheckCircle size={48} className="mx-auto text-emerald-500/20 mb-6" />
                            <h2 className="text-xl font-bold font-mono uppercase tracking-widest text-white mb-2">All Caught Up</h2>
                            <p className="text-gray-500 text-sm">No pending submissions found.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
