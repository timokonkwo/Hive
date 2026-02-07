"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`; 

const ABI = [
  {
    inputs: [{ name: "_codeUri", type: "string" }],
    name: "createBounty",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export default function CreateBountyPage() {
  const router = useRouter();
  const { authenticated, login } = useAuth();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  if (isSuccess) {
    setTimeout(() => {
      router.push("/");
    }, 2000);
  }

  const [codeUri, setCodeUri] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated) {
      login();
      return;
    }
    if (!codeUri || !amount) {
      toast.error("Please fill in all fields");
      return;
    }

    if (hash) {
      return;
    }

    try {
      writeContract({
        address: AUDIT_BOUNTY_ESCROW_ADDRESS,
        abi: ABI,
        functionName: "createBounty",
        args: [codeUri],
        value: parseEther(amount),
      }, {
        onError: (err) => {
          const errorMessage = (err as any).shortMessage || err.message;
          
          if (errorMessage.includes("User denied") || errorMessage.includes("User rejected")) {
            toast("Transaction cancelled", {
              description: "You rejected the transaction signature."
            });
            return;
          }
          
          toast.error("Transaction failed", {
            description: errorMessage
          });
        },
        onSuccess: (txHash) => {
          toast.success("Transaction sent!", {
            description: "Waiting for confirmation..."
          });
        }
      });
    } catch (error: any) {
      toast.error("Error", {
        description: error.message
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans">
      <Navbar />
      <main className="pt-32 pb-20 px-4 max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Link>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-emerald-600/20 rounded-sm flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono">DEPLOY BOUNTY</h1>
              <p className="text-zinc-400 text-sm">Lock funds in escrow and summon the Agent Swarm.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Target Code (Reference)</label>
              <input 
                type="text" 
                value={codeUri}
                onChange={(e) => setCodeUri(e.target.value)}
                placeholder="https://github.com/username/repo or ipfs://..."
                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-4 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Bounty Reward (ETH)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1.0"
                  className="w-full bg-black border border-zinc-800 rounded-sm pl-4 pr-12 py-4 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-lg font-bold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">ETH</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2 font-mono ml-1">Funds are locked in the smart contract until a valid report is submitted.</p>
            </div>

            <div className="pt-4">
              {!authenticated ? (
                <button 
                  type="button"
                  onClick={login}
                  className="w-full bg-white text-black font-bold py-4 rounded-sm hover:bg-zinc-200 transition-colors font-mono uppercase tracking-widest"
                >
                  Connect Wallet to Deploy
                </button>
              ) : (
                <button 
                  type="submit"
                  disabled={isPending || isConfirming || !!hash}
                  className={`w-full font-bold py-4 rounded-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono uppercase tracking-widest ${
                    hash ? "bg-emerald-600 cursor-default" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      SIGNING...
                    </>
                  ) : hash ? (
                    <>
                      <Shield className="w-5 h-5" />
                      BOUNTY DEPLOYED
                    </>
                  ) : (
                    "DEPLOY BOUNTY"
                  )}
                </button>
              )}
            </div>
            
            {hash && (
              <div className={`mt-6 border p-4 rounded-sm text-sm text-center font-mono transition-colors ${
                isSuccess 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>
                <div className="flex flex-col items-center gap-2">
                  {isSuccess ? (
                    <div className="flex items-center gap-2 font-bold text-lg">
                      <Shield className="w-5 h-5" />
                      CONFIRMED ON-CHAIN
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>CONFIRMING TRANSACTION...</span>
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
                  
                  {isSuccess && (
                    <Link href="/dashboard" className="mt-2 inline-block px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-sm text-emerald-400 text-xs uppercase tracking-widest transition-all">
                      Manage Bounties
                    </Link>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
