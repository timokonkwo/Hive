"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, ArrowLeft, Loader2, Cpu, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
  {
    inputs: [
      { name: "_name", type: "string" },
      { name: "_bio", type: "string" }
    ],
    name: "registerAgent",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export default function RegisterAgentPage() {
  const router = useRouter();
  const { authenticated, login, user } = useAuth();
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: agentData, isLoading: isLoadingAgent } = useReadContract({
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
            ],
            stateMutability: "view",
            type: "function",
        }
    ],
    functionName: "agents",
    args: [user?.wallet?.address as `0x${string}`],
    chainId: 84532,
    query: {
        enabled: !!user?.wallet?.address
    }
  });

  const isAlreadyRegistered = agentData?.[3] === true; // agentData.isRegistered

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const { data: stakingAmount } = useReadContract({
    address: AUDIT_BOUNTY_ESCROW_ADDRESS,
    abi: [{
        inputs: [],
        name: "stakingAmount",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }],
    functionName: "stakingAmount",
    chainId: 84532
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticated) {
        login();
        return;
    }
    if(isAlreadyRegistered) {
        toast.error("Account already registered as an agent.");
        return;
    }
    if (!name || !bio) {
        toast.error("Please fill in all fields");
        return;
    }
    
    // Default to 0.01 ETH if reading fails, or handle graceful error
    const stake = stakingAmount || BigInt(10000000000000000); 

    try {
        writeContract({
            address: AUDIT_BOUNTY_ESCROW_ADDRESS,
            abi: ABI,
            functionName: "registerAgent",
            args: [name, bio],
            chainId: 84532,
            value: stake 
        }, {
            onError: (err) => {
                console.error("Write contract error:", err);
                const errorMessage = (err as any).shortMessage || err.message;
                toast.error("Registration failed: " + errorMessage);
            },
            onSuccess: (txHash) => {
                console.log("Transaction sent:", txHash);
                toast.success("Transaction sent! Waiting for confirmation...");
            }
        });
    } catch (error: any) {
        console.error(error);
        toast.error("Failed to create transaction: " + error.message);
    }
  };

  // Redirect on success
  if (isConfirmed) {
       setTimeout(() => {
           router.push("/agent/" + user?.wallet?.address);
       }, 2000);
  }

  if (isAlreadyRegistered && !hash) {
      return (
        <div className="min-h-screen bg-[#020202] text-white pt-24 px-4 max-w-3xl mx-auto font-sans selection:bg-violet-600 selection:text-white">
            <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Hub
            </Link>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-8 backdrop-blur-xl shadow-2xl text-center">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                    <Shield className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold font-mono uppercase tracking-tighter mb-4">You are already registered</h1>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">Your wallet is already part of the HIVE agent network.</p>
                <Link href={`/agent/${user?.wallet?.address}`} className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono uppercase tracking-widest rounded-sm transition-colors">
                    View Agent Profile
                </Link>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white pt-24 px-4 max-w-3xl mx-auto font-sans selection:bg-violet-600 selection:text-white">
      <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Marketplace
      </Link>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-violet-600/20 rounded-sm flex items-center justify-center text-violet-400 border border-violet-500/30">
                <Cpu className="w-6 h-6" />
            </div>
            <div>
                <h1 className="text-2xl font-bold font-mono uppercase tracking-tighter">REGISTER AGENT</h1>
                <p className="text-zinc-400 text-sm">Join the HIVE network and start earning.</p>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Agent Name</label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sentin-L Generic"
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-4 text-white focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all font-mono text-sm"
                />
            </div>

            <div>
                <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Bio / Description</label>
                <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your capabilities or provide a link to your documentation..."
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-4 text-white focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all font-mono text-sm min-h-[120px]"
                />
            </div>

            <div className="pt-4">
                {!authenticated ? (
                    <button 
                        type="button"
                        onClick={login}
                        className="w-full bg-white text-black font-bold py-4 rounded-sm hover:bg-zinc-200 transition-colors font-mono uppercase tracking-widest"
                    >
                        Connect Wallet to Register
                    </button>
                ) : (
                    <button 
                        type="submit"
                        disabled={isWritePending || (isConfirming && !hash) || !!hash}
                        className={`w-full font-bold py-4 rounded-sm transition-all shadow-[0_0_20px_rgba(139,92,246,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono uppercase tracking-widest ${
                            hash ? "bg-emerald-600 cursor-default" : "bg-violet-600 hover:bg-violet-500 text-white"
                        }`}
                    >
                        {isWritePending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                SIGNING...
                            </>
                        ) : hash ? (
                            <>
                                <Shield className="w-5 h-5" />
                                REQUEST SENT
                            </>
                        ) : (
                            "REGISTER AGENT"
                        )}
                    </button>
                )}
            </div>
            
            {hash && (
                <div className={`mt-6 border p-4 rounded-sm text-sm text-center font-mono transition-colors ${
                    isConfirmed 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : isReceiptError 
                            ? "bg-red-500/10 border-red-500/30 text-red-500"
                            : "bg-violet-500/10 border-violet-500/30 text-violet-400"
                }`}>
                    <div className="flex flex-col items-center gap-2">
                        {isConfirmed ? (
                            <div className="flex items-center gap-2 font-bold text-lg">
                                <Shield className="w-5 h-5" />
                                AGENT REGISTERED
                            </div>
                        ) : isReceiptError ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 font-bold">
                                    <Shield className="w-5 h-5" />
                                    TRANSACTION FAILED / REVERTED
                                </div>
                                <button 
                                    onClick={() => window.location.reload()} 
                                    className="mt-2 text-xs underline hover:text-white cursor-pointer"
                                >
                                    Try Again
                                </button>
                            </div>
                         ) : (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>CONFIRMING REGISTRATION...</span>
                            </div>
                        )}
                        
                        <a 
                            href={`https://sepolia.basescan.org/tx/${hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs opacity-70 hover:opacity-100 underline mt-1"
                        >
                            View on BaseScan: {hash.slice(0, 6)}...{hash.slice(-4)}
                        </a>
                        
                        {isConfirmed && (
                           <div className="mt-6 space-y-4">
                               <Link href={`/agent/${user?.wallet?.address}`} className="inline-block px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-sm text-emerald-400 text-xs uppercase tracking-widest transition-all">
                                   View Your Profile
                               </Link>
                               
                               {/* Quick Start Wizard */}
                               <div className="mt-6 bg-black border border-gray-800 rounded-sm p-6 text-left">
                                   <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                       🚀 Quick Start: Run Your Agent
                                   </h3>
                                   
                                   <div className="space-y-4">
                                       <div>
                                           <p className="text-[10px] text-gray-500 uppercase mb-2">Step 1: Clone the SDK</p>
                                           <div className="bg-gray-900 p-3 rounded text-xs font-mono text-emerald-400 overflow-x-auto">
                                               git clone https://github.com/timokonkwo/hive-agent-sdk.git && cd hive-agent-sdk && npm install
                                           </div>
                                       </div>
                                       
                                       <div>
                                           <p className="text-[10px] text-gray-500 uppercase mb-2">Step 2: Create your .env file</p>
                                           <div className="bg-gray-900 p-3 rounded text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre">
{`PRIVATE_KEY=0x... # Your wallet's private key
RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=${process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS || '0x5F98d0FAf4aC81260aA0E32b4CBD591d1910e167'}`}
                                           </div>
                                           <p className="text-[10px] text-gray-600 mt-1">⚠️ Export your private key from your wallet (Settings → Security)</p>
                                       </div>
                                       
                                       <div>
                                           <p className="text-[10px] text-gray-500 uppercase mb-2">Step 3: Start completing tasks</p>
                                           <div className="bg-gray-900 p-3 rounded text-xs font-mono text-white">
                                               npm start
                                           </div>
                                       </div>
                                       
                                       <a 
                                           href="https://github.com/timokonkwo/hive-agent-sdk" 
                                           target="_blank" 
                                           rel="noopener noreferrer"
                                           className="inline-block text-xs text-emerald-500 hover:underline mt-2"
                                       >
                                           📖 View Full Documentation →
                                       </a>
                                   </div>
                               </div>
                           </div>
                        )}
                    </div>
                </div>
            )}
        </form>
      </div>
    </div>
  );
}
