"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useReadContract, usePublicClient, useWriteContract } from "wagmi";
import { formatEther, parseAbiItem } from "viem";
import { Loader2, ArrowLeft, Shield, CheckCircle, Clock, FileCode, UploadCloud, User, FileKey, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
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

export default function BountyDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const bountyId = BigInt(id);
  const publicClient = usePublicClient({ chainId: 84532 });

  const { data: bounty, isLoading } = useReadContract({
    address: AUDIT_BOUNTY_ESCROW_ADDRESS,
    abi: ABI,
    functionName: "getBounty",
    args: [bountyId],
    chainId: 84532,
  });

  /* --- SUBMISSION LOGIC --- */
  const { user } = useAuth();
  const { writeContract, isPending: isSubmitting } = useWriteContract();

  // Check if current user is a registered agent
  const { data: agentData } = useReadContract({
    address: AUDIT_BOUNTY_ESCROW_ADDRESS,
    abi: [
       {
           inputs: [{ internalType: "address", name: "", type: "address" }],
           name: "agents",
           outputs: [
               { internalType: "string", name: "name", type: "string" },
               { internalType: "string", name: "bio", type: "string" },
               { internalType: "address", name: "wallet", type: "address" },
               { internalType: "bool", name: "isRegistered", type: "bool" },
               { internalType: "uint256", name: "registeredAt", type: "uint256" },
               { internalType: "uint256", name: "stakedAmount", type: "uint256" },
               { internalType: "bool", name: "isSlashed", type: "bool" },
           ],
           stateMutability: "view",
           type: "function",
       }
    ],
    functionName: "agents",
    args: [user?.wallet?.address as `0x${string}`],
    chainId: 84532,
    query: { enabled: !!user?.wallet?.address }
  });

  const isRegisteredAgent = agentData?.[3] === true;
  const isSlashed = agentData?.[6] === true;

  // Access Control: Only Client and Assigned Agent can view report while open
  const isClient = bounty && user?.wallet?.address?.toLowerCase() === bounty.client.toLowerCase();
  const isAssignedAgent = bounty && user?.wallet?.address?.toLowerCase() === bounty.assignedAgent.toLowerCase();
  
  // If bounty isOpen, restricted. If not isOpen (Closed/Paid), public.
  const canViewReport = isClient || isAssignedAgent || (bounty && !bounty.isOpen);

  const [reportUri, setReportUri] = React.useState("");
  const [isSubmitOpen, setIsSubmitOpen] = React.useState(false);

  const handleSubmitWork = async () => {
      if (!reportUri) {
          toast.error("Please enter a valid IPFS URI or link");
          return;
      }
      try {
          writeContract({
              address: AUDIT_BOUNTY_ESCROW_ADDRESS,
              abi: [{
                  inputs: [
                      { name: "_bountyId", type: "uint256" },
                      { name: "_reportUri", type: "string" }
                  ],
                  name: "submitWork",
                  outputs: [],
                  stateMutability: "nonpayable",
                  type: "function"
              }],
              functionName: "submitWork",
              args: [bountyId, reportUri],
              chainId: 84532
          }, {
              onSuccess: () => {
                  toast.success("Work submitted successfully!");
                  setIsSubmitOpen(false);
              },
              onError: (err) => {
                  toast.error("Submission failed: " + (err as any).shortMessage || err.message);
              }
          });
      } catch (e: any) {
          console.error(e);
          toast.error("Error: " + e.message);
      }
  };

  // Fetch closed timestamp if bounty is closed
  const [closedAt, setClosedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
      const fetchClosedTime = async () => {
          if (!publicClient || !bounty || bounty.isOpen) return;

          try {
             // Find BountyFinalized event for this ID
             const logs = await publicClient.getLogs({
                address: AUDIT_BOUNTY_ESCROW_ADDRESS,
                event: parseAbiItem('event BountyFinalized(uint256 indexed bountyId, address indexed agent, uint256 amount, bool isValid)'),
                args: { bountyId: BigInt(id) },
                fromBlock: 'earliest',
                toBlock: 'latest'
             });

             if (logs.length > 0) {
                 const block = await publicClient.getBlock({ blockNumber: logs[0].blockNumber });
                 setClosedAt(Number(block.timestamp) * 1000);
             }
          } catch (e) {
              console.error("Failed to fetch closed time", e);
          }
      };
      
      fetchClosedTime();
  }, [bounty, publicClient, id]);

  if (isLoading) {
      return (
          <div className="min-h-screen bg-[#020202] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
      );
  }

  if (!bounty || bounty.client === "0x0000000000000000000000000000000000000000") {
      return (
          <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center space-y-4">
              <h1 className="text-2xl font-bold">Bounty Not Found</h1>
              <Link href="/" className="text-blue-500 hover:underline">Return to Marketplace</Link>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-violet-600 selection:text-white">
      <Navbar />

      <main className="pt-32 pb-20 px-4 md:px-6 max-w-5xl mx-auto">
        <Link href="/bounties" className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors font-mono text-xs uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bounties
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl md:text-5xl font-black text-white font-mono">BOUNTY #{id}</h1>
                    {bounty.isOpen ? (
                        bounty.assignedAgent !== "0x0000000000000000000000000000000000000000" ? (
                            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold font-mono uppercase tracking-widest rounded-sm flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin" /> In Review
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold font-mono uppercase tracking-widest rounded-sm">
                                Open
                            </span>
                        )
                    ) : (
                        <span className="px-3 py-1 bg-gray-500/10 text-gray-500 border border-gray-500/20 text-xs font-bold font-mono uppercase tracking-widest rounded-sm">
                            Closed
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm font-mono">
                    <User size={14} /> Created by <span className="text-white">{bounty.client.slice(0, 6)}...{bounty.client.slice(-4)}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-1">Total Reward</div>
                <div className="text-4xl font-bold font-mono text-white flex items-center gap-2 justify-end">
                    {formatEther(bounty.amount)} <span className="text-xl text-gray-500">ETH</span>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-sm">
                    <h2 className="text-lg font-bold font-mono uppercase tracking-widest mb-6 flex items-center gap-2 text-white">
                        <FileKey size={18} className="text-violet-500" /> Target Codebase
                    </h2>
                    
                    <div className="bg-black p-4 rounded-sm border border-white/5 font-mono text-sm text-gray-300 break-all mb-4">
                        {bounty.codeUri}
                    </div>

                    <a 
                        href={bounty.codeUri.startsWith('http') ? bounty.codeUri : `https://ipfs.io/ipfs/${bounty.codeUri}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-violet-400 hover:text-white transition-colors text-sm font-bold font-mono uppercase tracking-widest"
                    >
                        View Source <ExternalLink size={14} />
                    </a>
                </div>

                 <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold font-mono uppercase tracking-widest flex items-center gap-2 text-white">
                            <Shield size={18} className="text-violet-500" /> Audit Reports
                        </h2>
                        {/* Submit Button for Agents */}
                        {bounty.isOpen && isRegisteredAgent && !isSlashed && (
                             <button 
                                onClick={() => setIsSubmitOpen(!isSubmitOpen)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest text-xs rounded-sm transition-colors flex items-center gap-2"
                             >
                                 <UploadCloud size={14} /> {isSubmitOpen ? "Cancel" : "Submit Work"}
                             </button>
                        )}
                    </div>

                    {/* Submission Form */}
                    {isSubmitOpen && (
                        <div className="mb-8 bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-sm animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-emerald-400 font-bold font-mono text-sm uppercase tracking-widest mb-4">New Submission</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">Report URI (IPFS / PDF Link)</label>
                                    <input 
                                        type="text" 
                                        value={reportUri}
                                        onChange={(e) => setReportUri(e.target.value)}
                                        placeholder="ipfs://..."
                                        className="w-full bg-black border border-white/10 rounded-sm p-3 text-sm text-white font-mono focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <button 
                                    onClick={handleSubmitWork}
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest text-xs rounded-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                    Confirm Submission
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {bounty.reportUri ? (
                        canViewReport ? (
                            <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-sm">
                                 <div className="flex items-center justify-between">
                                     <div>
                                         <h3 className="text-emerald-400 font-bold text-sm mb-1">Report Submitted</h3>
                                         <p className="text-gray-400 text-xs font-mono">
                                             Submitted by: {bounty.assignedAgent.slice(0,6)}...{bounty.assignedAgent.slice(-4)}
                                             {bounty.assignedAgent === user?.wallet?.address && " (You)"}
                                         </p>
                                     </div>
                                     <a 
                                        href={bounty.reportUri.startsWith('http') ? bounty.reportUri : `https://ipfs.io/ipfs/${bounty.reportUri}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-emerald-400 transition-colors"
                                     >
                                         View Report
                                     </a>
                                 </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-900/10 border border-yellow-500/20 p-6 rounded-sm text-center">
                                <Loader2 className="w-8 h-8 text-yellow-500 mx-auto mb-3 animate-spin" />
                                <h3 className="text-yellow-500 font-bold font-mono text-sm uppercase tracking-widest mb-1">Report Under Review</h3>
                                <p className="text-gray-500 text-xs font-mono max-w-xs mx-auto">
                                    The assigned agent has submitted their work. The client is currently reviewing the audit report.
                                </p>
                            </div>
                        )
                    ) : (
                         <div className="text-center py-8">
                             {bounty.isOpen ? (
                                <>
                                    <p className="text-gray-500 text-sm mb-2">No reports submitted yet.</p>
                                    <div className="text-xs text-violet-500 font-mono uppercase tracking-widest animate-pulse">
                                        Agents are analyzing...
                                    </div>
                                </>
                             ) : (
                                <p className="text-gray-500 text-sm font-mono uppercase tracking-widest">
                                    Bounty Closed
                                </p>
                             )}
                         </div>
                    )}
                </div>
            </div>

            <aside className="space-y-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-sm">
                     <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gray-500 mb-4">Timeline</h3>
                     <div className="space-y-4">
                         <div className="flex gap-3">
                             <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                             <div>
                                 <div className="text-sm font-bold text-white">Bounty Created</div>
                                 <div className="text-xs text-gray-500 font-mono">{new Date(Number(bounty.createdAt) * 1000).toLocaleString()}</div>
                             </div>
                         </div>
                         {bounty.reportUri && (
                             <div className="flex gap-3">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-yellow-500"></div>
                                <div>
                                    <div className="text-sm font-bold text-white">Work Submitted</div>
                                    <div className="text-xs text-gray-500 font-mono">Under Review</div>
                                </div>
                            </div>
                         )}
                         {!bounty.isOpen && bounty.assignedAgent !== "0x0000000000000000000000000000000000000000" && (
                             <div className="flex gap-3">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500"></div>
                                <div>
                                    <div className="text-sm font-bold text-white">Report Verified</div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {closedAt ? new Date(closedAt).toLocaleString() : "Recently"}
                                    </div>
                                </div>
                            </div>
                         )}
                     </div>
                </div>
            </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
