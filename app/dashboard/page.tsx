"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useReadContract, useWriteContract, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseAbiItem } from "viem";
import { Loader2, Shield, AlertTriangle, CheckCircle, XCircle, FileText, ChevronRight, Download, RefreshCw, ExternalLink, X, Check } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// TODO: Replace with deployed contract address
const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`; 

const ABI = [
  {
    inputs: [
      { name: "_bountyId", type: "uint256" },
      { name: "_agent", type: "address" },
      { name: "_isValid", type: "bool" },
      { name: "_scoreToAdd", type: "uint256" }
    ],
    name: "finalizeBounty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface Submission {
    id: string; // Bounty ID
    agentAddress: string;
    reportUri: string;
    transactionHash: string;
    timestamp: number;
    amount: bigint;
}

export default function DashboardPage() {
    const { authenticated, login, user } = useAuth();
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
    const publicClient = usePublicClient({ chainId: 84532 });
    
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    
    // Simple state to track which item is being actioned to show loader
    const [actioningId, setActioningId] = useState<string | null>(null);

    // Fetch submissions - try GraphQL indexer first, fallback to RPC
    const fetchSubmissions = async () => {
        setLoadingSubmissions(true);
        
        // Try GraphQL indexer first (fast, unlimited)
        try {
            const INDEXER_URL = process.env.NEXT_PUBLIC_HIVE_INDEXER_URL || 'http://localhost:4350/graphql';
            const response = await fetch(INDEXER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `{
                        bounties(where: { reportUri_isNull: false }, limit: 50, orderBy: createdAt_DESC) {
                            id
                            client
                            amount
                            reportUri
                            isOpen
                            createdAt
                            txHash
                            assignedAgent { id name }
                        }
                    }`
                })
            });
            
            const json = await response.json();
            if (json.data?.bounties) {
                const formatted = json.data.bounties.map((b: any) => ({
                    id: b.id,
                    agentAddress: b.assignedAgent?.id || b.client,
                    reportUri: b.reportUri,
                    transactionHash: b.txHash,
                    timestamp: Number(b.createdAt),
                    amount: BigInt(b.amount || 0)
                }));
                setSubmissions(formatted);
                setLoadingSubmissions(false);
                console.log("Loaded submissions from indexer:", formatted.length);
                return;
            }
        } catch (e) {
            console.warn("Indexer unavailable, falling back to RPC:", e);
        }

        // Fallback to RPC (slow, rate-limited)
        if (!publicClient) {
            console.log("Waiting for publicClient...");
            setLoadingSubmissions(false);
            return;
        }
        console.log("Fetching logs from RPC (slow fallback):", AUDIT_BOUNTY_ESCROW_ADDRESS);
        
        try {
            const currentBlock = await publicClient.getBlockNumber();
            const CHUNK_SIZE = 9n;
            const TOTAL_BLOCKS_TO_SCAN = 500n;
            const CONCURRENCY = 5; 
            
            const ranges: { from: bigint; to: bigint }[] = [];
            for (let i = 0n; i < TOTAL_BLOCKS_TO_SCAN; i += CHUNK_SIZE) {
                const end = currentBlock - i;
                const start = end - CHUNK_SIZE + 1n;
                if (start < 0n) break;
                ranges.push({ from: start, to: end });
            }

            const allLogs = [];
            
            for (let i = 0; i < ranges.length; i += CONCURRENCY) {
                const batch = ranges.slice(i, i + CONCURRENCY);
                const results = await Promise.all(
                    batch.map(range => 
                        publicClient.getLogs({
                            address: AUDIT_BOUNTY_ESCROW_ADDRESS,
                            event: parseAbiItem('event WorkSubmitted(uint256 indexed bountyId, address indexed agent, string reportUri)'),
                            fromBlock: range.from,
                            toBlock: range.to
                        }).catch(e => {
                            console.warn("Retrying chunk", range, e);
                            return [];
                        })
                    )
                );
                allLogs.push(...results.flat());
            }

            const formatted = await Promise.all(allLogs.map(async (log) => {
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                return {
                    id: log.args.bountyId?.toString() || "0",
                    agentAddress: log.args.agent || "",
                    reportUri: log.args.reportUri || "",
                    transactionHash: log.transactionHash,
                    timestamp: Number(block.timestamp) * 1000,
                    amount: 0n // Fallback
                };
            }));
            
            const unique = formatted.filter((v, i, a) => a.findIndex(t => t.transactionHash === v.transactionHash) === i);
            setSubmissions(unique.reverse());

        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    useEffect(() => {
        if (publicClient) {
            fetchSubmissions();
        }
    }, [publicClient]);

    const handleFinalize = (submission: Submission, isValid: boolean) => {
        if (!authenticated) {
            login();
            return;
        }

        const uniqueActionId = `${submission.id}-${submission.agentAddress}`;
        setActioningId(uniqueActionId);
        
        try {
            writeContract({
                address: AUDIT_BOUNTY_ESCROW_ADDRESS,
                abi: ABI,
                functionName: "finalizeBounty",
                args: [
                    BigInt(submission.id),
                    submission.agentAddress as `0x${string}`,
                    isValid,
                    BigInt(10) // Fixed score increase
                ],
            }, {
               onSuccess: () => {
                   toast.info("Transaction submitted. Waiting for confirmation...");
               },
               onError: (err) => {
                   console.error(err);
                   toast.error("Transaction failed");
                   setActioningId(null);
               }
            });
        } catch (error) {
            console.error(error);
            toast.error("Transaction failed");
            setActioningId(null);
        }
    };

    const isAdmin = user?.wallet?.address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase();

    if (!authenticated || !isAdmin) {
        return (
             <>
             <Navbar />
             <main className="min-h-screen bg-[#020202] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-900/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 font-mono uppercase tracking-widest text-red-500">Access Denied</h1>
                    <p className="text-zinc-500 mb-8 max-w-md mx-auto font-mono text-sm leading-relaxed">
                        This dashboard is restricted to Luxen Shield Validators only.
                        <br />Your wallet address is not authorized.
                    </p>
                    {!authenticated ? (
                        <button onClick={login} className="bg-white text-black px-8 py-3 rounded-sm font-bold font-mono uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                            Connect Validator Wallet
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-sm font-mono text-xs text-zinc-400">
                                {user?.wallet?.address}
                            </div>
                            <Link href="/" className="inline-block text-zinc-400 hover:text-white underline underline-offset-4 text-sm font-mono uppercase">
                                Return to Marketplace
                            </Link>
                        </div>
                    )}
                </div>
             </main>
             </>
        );
    }

    const totalPendingValue = submissions.reduce((acc, curr) => acc + curr.amount, 0n);

  return (
    <div className="min-h-screen bg-[#020202] text-white pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto font-sans selection:bg-violet-600 selection:text-white">
      
      {/* Navigation Header */}
      <div className="mb-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-4 group font-mono uppercase tracking-wider">
            <div className="p-1 rounded-full border border-zinc-800 group-hover:border-white/30 transition-colors">
                <ChevronRight size={12} className="rotate-180" />
            </div>
            Back to Marketplace
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <h1 className="text-3xl font-bold font-mono uppercase tracking-tighter mb-2 flex items-center gap-3">
                    <Shield className="text-emerald-500" /> Validator Dashboard
                </h1>
                <div className="text-zinc-500 text-sm font-mono flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-500">SYSTEM ONLINE</span>
                    <span className="mx-2 text-zinc-800">|</span>
                    <ExternalLink size={12} />
                    Contract: {AUDIT_BOUNTY_ESCROW_ADDRESS.slice(0,6)}...{AUDIT_BOUNTY_ESCROW_ADDRESS.slice(-4)}
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <button 
                    onClick={fetchSubmissions}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-sm hover:bg-zinc-800 transition-colors group"
                    title="Refresh Submissions"
                 >
                     <RefreshCw size={16} className={`text-zinc-400 group-hover:text-white transition-colors ${loadingSubmissions ? "animate-spin" : ""}`} />
                 </button>
            </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg backdrop-blur-sm">
            <div className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">Pending Reviews</div>
            <div className="text-2xl font-bold font-mono text-white flex items-end gap-2">
                {submissions.length}
                <span className="text-sm text-zinc-600 font-normal mb-1">items</span>
            </div>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg backdrop-blur-sm">
            <div className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">Total Pending Value</div>
            <div className="text-2xl font-bold font-mono text-white flex items-end gap-2">
                {formatEther(totalPendingValue)}
                <span className="text-sm text-zinc-600 font-normal mb-1">ETH</span>
            </div>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg backdrop-blur-sm flex items-center justify-between">
            <div>
                <div className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">Admin Status</div>
                <div className="text-sm font-mono text-emerald-500 font-bold">AUTHORIZED</div>
            </div>
            <Shield className="text-emerald-500/20 w-12 h-12" />
        </div>
      </div>

      <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-white/5">
            <h2 className="text-xl font-bold font-mono uppercase tracking-wide">Submission Feed</h2>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-sm font-mono">
                {submissions.length} Found
            </span>
        </div>

        <div className="divide-y divide-zinc-800">
            {loadingSubmissions ? (
                <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="font-mono text-xs uppercase tracking-widest">Scanning Blockchain Events...</p>
                </div>
            ) : submissions.length === 0 ? (
                <div className="p-16 text-center text-zinc-500">
                    <CheckCircle className="w-12 h-12 mx-auto text-zinc-800 mb-4" />
                    <h3 className="text-white font-mono uppercase tracking-widest mb-2">All Caught Up</h3>
                    <p className="max-w-xs mx-auto text-sm">No pending submissions found. Great job!</p>
                </div>
            ) : (
                submissions.map((sub) => {
                    const uniqueActionId = `${sub.id}-${sub.agentAddress}`;
                    const isProcessing = actioningId === uniqueActionId || (hash && actioningId === uniqueActionId);
                    
                    return (
                        <div key={`${sub.id}-${sub.transactionHash}`} className="p-6 hover:bg-white/5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                            <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold font-mono text-emerald-500 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                                        BOUNTY #{sub.id}
                                    </span>
                                    <span className="text-zinc-500 text-xs font-mono">
                                        {new Date(sub.timestamp).toLocaleTimeString()} • {new Date(sub.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/40 border border-white/5 p-3 rounded-sm">
                                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Agent</div>
                                        <div className="font-mono text-sm text-blue-400 break-all">{sub.agentAddress}</div>
                                    </div>
                                    <div className="bg-black/40 border border-white/5 p-3 rounded-sm">
                                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Bounty Value</div>
                                        <div className="font-mono text-sm text-white font-bold">{formatEther(sub.amount)} ETH</div>
                                    </div>
                                </div>

                                <div className="flex gap-4 text-xs font-bold uppercase tracking-widest pt-2">
                                     <a 
                                        href={`https://ipfs.io/ipfs/${sub.reportUri.replace("ipfs://", "")}`} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-emerald-500 hover:text-white transition-colors"
                                    >
                                        <FileText className="w-3 h-3" /> View Report
                                     </a>
                                     <a 
                                        href={`https://sepolia.basescan.org/tx/${sub.transactionHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer" 
                                        className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" /> Verify TX
                                     </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 border-t md:border-t-0 border-zinc-800 pt-4 md:pt-0">
                                <button 
                                    disabled={!!actioningId}
                                    onClick={() => handleFinalize(sub, false)}
                                    className="px-4 py-2 rounded-sm border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Reject
                                </button>
                                <button 
                                     disabled={!!actioningId}
                                     onClick={() => handleFinalize(sub, true)}
                                     className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing && isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    Approve & Pay
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>
      
      {isSuccess && (
          <div className="fixed bottom-8 right-8 z-50 p-4 bg-emerald-500 text-black border border-emerald-400 rounded-sm shadow-2xl flex items-center gap-3 font-mono text-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
              <CheckCircle className="w-6 h-6" />
              <div>
                  <div className="font-bold">SUCCESS</div>
                  <div>BOUNTY FINALIZED: FUNDS RELEASED</div>
              </div>
          </div>
      )}
    </div>
  );
}
