"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import {
  Loader2, Briefcase, FileText, CheckCircle, Clock, ChevronRight,
  BarChart3, Send, Inbox, Users, Copy, ExternalLink, Wallet,
  User, Building, Save, Edit3, Check, X, Coins, Lock, RefreshCw, Shield
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HolderBadge } from "@/components/ui/HolderBadge";
import { useHolder, type HolderData } from "@/components/providers/HolderContext";

type Tab = "posted" | "proposals" | "incoming" | "disputes";

// Solana USDC mint address (mainnet)
const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const getClientSolanaRpcEndpoint = () => {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/solana/rpc`;
  }
  return "/api/solana/rpc";
};

async function createSolanaWalletProof(solWallet: any, address: string, action = "link_wallet") {
  if (!solWallet.signMessage) {
    throw new Error("Your Solana wallet does not support message signing. Use Phantom, Solflare, or Backpack.");
  }
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const timestamp = Date.now();
  const message = [
    "Hive Solana Wallet Proof",
    `Action: ${action}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
  const signed = await solWallet.signMessage(new TextEncoder().encode(message), "utf8");
  const signatureBytes = signed?.signature || signed;
  const { default: bs58 } = await import("bs58");
  return {
    message,
    signature: bs58.encode(signatureBytes),
  };
}

export default function DashboardPage() {
  const { authenticated, login, user, ready } = useAuth();
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("posted");
  const [processingBid, setProcessingBid] = useState<string | null>(null);

  // Session Wallet state
  const [sessionBudget, setSessionBudget] = useState<{ depositBalance: number; status: 'active' | 'suspended'; solanaAddress: string } | null>(null);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // DAO Disputes state
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [votingDisputeId, setVotingDisputeId] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", company: "", twitter: "", website: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Wallet state
  const [solBalance, setSolBalance] = useState<string | null>(null);
  const [solUsdcBalance, setSolUsdcBalance] = useState<string | null>(null);
  const [evmBalance, setEvmBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Holder state
  const { fetchHolder } = useHolder();
  const [holderData, setHolderData] = useState<HolderData | null>(null);
  const [holderLoading, setHolderLoading] = useState(false);

  const address = user?.wallet?.address;

  // Solana address from profile or linked accounts
  const solanaAccountLinked = user?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && (a.chainType === "solana" || a.chainId?.startsWith?.("solana"))
  );
  const solanaAddressLinked = (solanaAccountLinked as any)?.address || null;
  const solanaAddress = profile?.solanaAddress || solanaAddressLinked || null;

  // Points state
  const [points, setPoints] = useState<any>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [convertingPoints, setConvertingPoints] = useState(false);

  // Fetch points balance
  const fetchPoints = useCallback(async () => {
    if (!address) return;
    setPointsLoading(true);
    try {
      const res = await fetch("/api/points");
      if (res.ok) {
        setPoints(await res.json());
      }
    } catch (err) {
      console.error("Points fetch error:", err);
    } finally {
      setPointsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (authenticated && address) {
      fetchPoints();
    }
  }, [authenticated, address, fetchPoints]);

  const handleConvertPoints = async () => {
    if (!solanaAddress) {
      toast.error("Please connect a Solana wallet to convert points");
      return;
    }
    if (!points || points.currentPointsBalance < 1000) {
      toast.error("Minimum 1,000 points required to convert");
      return;
    }
    setConvertingPoints(true);
    try {
      const res = await fetch("/api/points/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.currentPointsBalance,
          solanaAddress: solanaAddress,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Successfully converted points to ${result.hiveAmount} $HIVE!`);
        fetchPoints(); // Refresh points balance
        fetchBalances(); // Refresh wallet token balance
      } else {
        toast.error(result.error || "Failed to convert points");
      }
    } catch (err) {
      toast.error("Conversion error. Please check wallet connection.");
    } finally {
      setConvertingPoints(false);
    }
  };

  // Fetch Session Budget & Ledger data
  const fetchSessionData = useCallback(async () => {
    if (!address) return;
    setSessionLoading(true);
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const result = await res.json();
        setSessionBudget(result.budget);
        setSessionHistory(result.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch session data:", err);
    } finally {
      setSessionLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (authenticated && address) {
      fetchSessionData();
    }
  }, [authenticated, address, fetchSessionData]);

  // Handle client-side Solana transaction build, sign, and broadcast to deposit USDC into off-chain session budget
  const handleDepositSession = async () => {
    if (!solanaAddress) {
      toast.error("Please connect your Solana wallet first.");
      return;
    }
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }

    setDepositing(true);
    try {
      // Get client-side wallet provider
      const solanaWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

      if (!solanaWallet || !solanaWallet.isConnected) {
        throw new Error("Solana wallet is not connected. Connect it first.");
      }

      // Dynamic import to avoid SSR issues
      const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

      const connection = new Connection(getClientSolanaRpcEndpoint(), 'confirmed');
      const senderKey = new PublicKey(solanaAddress);
      const treasuryWallet = new PublicKey('3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura');
      const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

      const senderAta = await getAssociatedTokenAddress(usdcMint, senderKey);
      const recipientAta = await getAssociatedTokenAddress(usdcMint, treasuryWallet);

      const transaction = new Transaction();

      // Check recipient ATA exists
      try {
        await getAccount(connection, recipientAta);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderKey,
            recipientAta,
            treasuryWallet,
            usdcMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add transfer
      const rawAmount = BigInt(Math.round(amountNum * 1_000_000));
      transaction.add(
        createTransferInstruction(
          senderAta,
          recipientAta,
          senderKey,
          rawAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Blockhash & fee payer
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderKey;

      // Sign and serialize transaction
      const signedTx = await solanaWallet.signTransaction(transaction);
      const rawTx = signedTx.serialize();
      
      const txSignature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      // Confirm transaction
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');

      // Post deposit details to Hive backend for verification
      const res = await fetch("/api/session/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txSignature,
          solanaAddress,
          amount: amountNum
        })
      });

      const depResult = await res.json();
      if (res.ok && depResult.success) {
        toast.success(`Successfully deposited $${amountNum} USDC!`);
        setShowDepositModal(false);
        setDepositAmount("");
        fetchSessionData();
        fetchBalances(); // Refresh local balance
      } else {
        toast.error(depResult.error || "Deposit verification failed. Contact support.");
      }
    } catch (err: any) {
      console.error("Deposit execution error:", err);
      toast.error(err.message || "Failed to process deposit.");
    } finally {
      setDepositing(false);
    }
  };

  // Fetch disputes list from backend
  const fetchDisputes = useCallback(async () => {
    setDisputesLoading(true);
    try {
      const res = await fetch("/api/disputes?status=active");
      if (res.ok) {
        const result = await res.json();
        setDisputes(result.disputes || []);
      }
    } catch (err) {
      console.error("Failed to fetch disputes:", err);
    } finally {
      setDisputesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "disputes") {
      fetchDisputes();
    }
  }, [activeTab, fetchDisputes]);

  // Vote on active disputes using active staked HIVE weight
  const handleVoteDispute = async (disputeId: string, vote: 'slash' | 'dismiss') => {
    if (!solanaAddress) {
      toast.error("Please connect your Solana wallet to participate in voting.");
      return;
    }
    setVotingDisputeId(disputeId);
    try {
      const solanaWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;
      if (!solanaWallet) {
        throw new Error("No Solana wallet found.");
      }
      if (!solanaWallet.isConnected) {
        await solanaWallet.connect();
      }
      const walletProof = await createSolanaWalletProof(solanaWallet, solanaAddress, `dao_vote:${disputeId}:${vote}`);
      const res = await fetch("/api/disputes/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          vote,
          solanaAddress,
          walletProof
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Successfully voted to ${vote}!`);
        fetchDisputes();
        fetchPoints(); // Refresh points balance
      } else {
        toast.error(result.error || "Failed to submit vote.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit vote.");
    } finally {
      setVotingDisputeId(null);
    }
  };

  // Fetch dashboard data
  useEffect(() => {
    if (!address) return;
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?address=${address}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
          if (d.stats.totalPosted > 0) setActiveTab("posted");
          else if (d.stats.totalBidsSubmitted > 0) setActiveTab("proposals");
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [address]);

  // Fetch client profile
  useEffect(() => {
    if (!address) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/clients/profile?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
            setProfileForm({
              name: data.profile.name || "",
              bio: data.profile.bio || "",
              company: data.profile.company || "",
              twitter: data.profile.twitter || "",
              website: data.profile.website || "",
            });
          }
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setProfileLoaded(true);
      }
    };
    fetchProfile();
  }, [address]);

  // Fetch wallet balances
  const fetchBalances = useCallback(async () => {
    if (!solanaAddress && !address) return;
    setWalletLoading(true);
    try {
      // Fetch Solana SOL balance
      if (solanaAddress) {
        try {
          const solRes = await fetch("/api/solana/rpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getBalance",
              params: [solanaAddress],
            }),
          });
          const solData = await solRes.json();
          if (solData.result?.value !== undefined) {
            setSolBalance((solData.result.value / 1e9).toFixed(4));
          }
        } catch { setSolBalance("0"); }

        // Fetch Solana USDC balance
        try {
          const usdcRes = await fetch("/api/solana/rpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getTokenAccountsByOwner",
              params: [solanaAddress, { mint: USDC_MINT_SOLANA }, { encoding: "jsonParsed" }],
            }),
          });
          const usdcData = await usdcRes.json();
          const usdcAccount = usdcData.result?.value?.[0];
          if (usdcAccount) {
            const amount = usdcAccount.account.data.parsed.info.tokenAmount.uiAmountString;
            setSolUsdcBalance(amount);
          } else {
            setSolUsdcBalance("0.00");
          }
        } catch { setSolUsdcBalance("0.00"); }
      }
    } catch (err) {
      console.error("Balance fetch error:", err);
    } finally {
      setWalletLoading(false);
    }
  }, [solanaAddress, address]);

  useEffect(() => {
    if (authenticated && (solanaAddress || address)) {
      fetchBalances();
    }
  }, [authenticated, solanaAddress, address, fetchBalances]);

  // Fetch holder status
  useEffect(() => {
    const checkAddr = solanaAddress || (address && !address.startsWith('did:privy:') ? address : null);
    if (authenticated && checkAddr && !holderData) {
      setHolderLoading(true);
      fetchHolder(checkAddr).then((data) => {
        if (data) setHolderData(data);
        setHolderLoading(false);
      });
    }
  }, [authenticated, solanaAddress, address, holderData, fetchHolder]);

  const handleSaveProfile = async () => {
    if (!address) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/clients/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ...profileForm }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setProfile({ ...profile, ...profileForm, address, solanaAddress });
        setEditingProfile(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save profile");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingProfile(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleBidAction = async (taskId: string, bidId: string, status: "accepted" | "rejected") => {
    setProcessingBid(bidId);
    try {
      const res = await authFetch(`/api/tasks/${taskId}/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, clientAddress: address }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(status === "accepted" ? "Proposal accepted!" : "Proposal rejected");
      const refreshRes = await fetch(`/api/dashboard?address=${address}`);
      if (refreshRes.ok) setData(await refreshRes.json());
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingBid(null);
    }
  };

  // Not connected
  if (!authenticated || !address) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen text-white flex items-center justify-center">
          <div className="text-center max-w-md">
            <Briefcase className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
            <h1 className="text-[28px] font-bold mb-3 tracking-tight">Dashboard</h1>
            <p className="text-zinc-500 mb-8 text-[15px] leading-relaxed">
              Sign in to view your posted tasks, track proposals, and manage your work.
            </p>
            <button
              onClick={login}
              disabled={!ready}
              className="bg-white hover:bg-zinc-200 text-black px-8 py-3.5 font-semibold rounded-full transition-all disabled:opacity-50 text-[15px] shadow-sm hover:scale-[0.98]"
            >
              {ready ? "Sign In" : "Loading..."}
            </button>
          </div>
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </main>
      </>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="min-h-screen text-white font-sans bg-[#020202] relative overflow-x-hidden">
      {/* Subtle Ambient Dot Grid */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)'
        }}
      />
      <Navbar />

      <div className="pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto relative z-10">

      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-500 hover:text-white transition-colors mb-6 group">
          <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
            <ChevronRight size={14} className="rotate-180" />
          </div>
          Back
        </button>
        <h1 className="text-[36px] md:text-[42px] font-bold tracking-tight mb-2 flex items-center gap-3" style={{ letterSpacing: '-0.02em' }}>
          <Briefcase className="text-emerald-500 w-8 h-8" /> My Dashboard
        </h1>
        <p className="text-zinc-500 text-[15px] font-medium flex items-center gap-2">
          {profile?.name || `${address.slice(0, 6)}...${address.slice(-4)}`}
          <HolderBadge wallet={solanaAddress || address} />
        </p>
      </div>

      {/* Profile + Wallet + Holder + Points Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Profile Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[14px] font-semibold tracking-wide text-zinc-400 flex items-center gap-2">
              <User size={16} className="text-emerald-500" /> Profile
            </h3>
            {!editingProfile ? (
              <button
                onClick={() => setEditingProfile(true)}
                className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1.5"
              >
                <Edit3 size={12} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingProfile(false); setProfileForm({ name: profile?.name || "", bio: profile?.bio || "", company: profile?.company || "", twitter: profile?.twitter || "", website: profile?.website || "" }); }}
                  className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {savingProfile ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  Save
                </button>
              </div>
            )}
          </div>

          {editingProfile ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Your name or alias"
                  className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder="What do you do?"
                  rows={2}
                  className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors font-mono resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">Company</label>
                  <input
                    type="text"
                    value={profileForm.company}
                    onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                    placeholder="Company name"
                    className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">Twitter</label>
                  <input
                    type="text"
                    value={profileForm.twitter}
                    onChange={(e) => setProfileForm({ ...profileForm, twitter: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block mb-1">Website</label>
                <input
                  type="text"
                  value={profileForm.website}
                  onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                />
              </div>
            </div>
          ) : profileLoaded && !profile?.name ? (
            <div className="text-center py-6">
              <User size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-mono mb-3">Complete your profile</p>
              <button
                onClick={() => setEditingProfile(true)}
                className="px-4 py-2 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 text-xs font-mono uppercase tracking-widest rounded transition-colors"
              >
                Set Up Profile
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-white font-bold text-lg">{profile?.name}</div>
                {profile?.company && <div className="text-zinc-500 text-xs font-mono flex items-center gap-1"><Building size={10} /> {profile.company}</div>}
              </div>
              {profile?.bio && <p className="text-zinc-400 text-sm">{profile.bio}</p>}
              <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono">
                {profile?.twitter && (
                  <a href={`https://x.com/${profile.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink size={10} /> {profile.twitter}
                  </a>
                )}
                {profile?.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink size={10} /> Website
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Session Wallet Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold tracking-wide text-zinc-400 flex items-center gap-2">
                <Wallet size={16} className="text-emerald-500" /> Session Wallet
              </h3>
              {solanaAddress && (
                <button
                  onClick={() => { fetchBalances(); fetchSessionData(); }}
                  disabled={walletLoading || sessionLoading}
                  className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors"
                >
                  {walletLoading || sessionLoading ? "Loading..." : "Refresh"}
                </button>
              )}
            </div>
            <p className="text-[12px] text-zinc-500 mb-4 font-medium">Off-chain USDC budget for premium API access and instant task matching.</p>

            {/* Connected Session Wallet */}
            {solanaAddress ? (
              <div className="space-y-4">
                {/* Session Budget State */}
                <div className="bg-black/30 border border-emerald-500/20 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${sessionBudget?.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                      <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${sessionBudget?.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                        Budget: {sessionBudget?.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Session Wallet</span>
                  </div>
                  <div className="text-white font-mono font-bold text-2xl mb-1">${(sessionBudget?.depositBalance ?? 0.00).toFixed(2)} USDC</div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate">Wallet: {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}</div>
                </div>

                {/* Solana Balances preview */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-zinc-900/50 rounded p-2">
                    <div className="text-[9px] text-zinc-600 uppercase">SOL Wallet</div>
                    <div className="text-zinc-300 font-bold">{solBalance ?? "0.0000"}</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded p-2">
                    <div className="text-[9px] text-zinc-600 uppercase">USDC Wallet</div>
                    <div className="text-zinc-300 font-bold">{solUsdcBalance ?? "0.00"}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    Deposit USDC
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold font-mono text-[10px] uppercase tracking-widest rounded border border-white/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Ledger Log
                  </button>
                </div>

                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/clients/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ address, solanaAddress: null }),
                      });
                      setProfile({ ...profile, solanaAddress: null });
                      setSolBalance(null);
                      setSolUsdcBalance(null);
                      setSessionBudget(null);
                      setSessionHistory([]);
                      toast.success("Wallet disconnected");
                    } catch {
                      toast.error("Failed to disconnect");
                    }
                  }}
                  className="w-full text-center text-[10px] text-zinc-600 hover:text-red-400 font-mono uppercase tracking-widest transition-colors py-1"
                >
                  Disconnect wallet
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-black/30 border border-dashed border-zinc-700 rounded p-6 text-center">
                  <Wallet className="w-8 h-8 text-purple-500 mx-auto mb-3 opacity-50" />
                  <p className="text-zinc-500 text-xs font-mono mb-4">No Solana wallet connected</p>
                  <button
                    onClick={async () => {
                      try {
                        const solWallet = (window as any).solana
                          || (window as any).phantom?.solana
                          || (window as any).solflare
                          || (window as any).backpack?.solana;
                        if (!solWallet) {
                          toast.error("No Solana wallet found", {
                            description: "Install a Solana wallet extension (Phantom, Solflare, etc.) to connect.",
                          });
                          return;
                        }

                        const response = await solWallet.connect();
                        const connectedAddress = response.publicKey.toString();
                        const walletProof = await createSolanaWalletProof(solWallet, connectedAddress);

                        const res = await fetch("/api/clients/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ address, solanaAddress: connectedAddress, walletProof }),
                        });

                        if (res.ok) {
                          setProfile({ ...profile, solanaAddress: connectedAddress });
                          toast.success("Solana wallet connected!");
                          fetchBalances();
                          fetchSessionData();
                        } else {
                          const err = await res.json();
                          toast.error(err.error || "Failed to save wallet");
                        }
                      } catch (err: any) {
                        if (err.message?.includes("User rejected")) {
                          toast.error("Connection cancelled");
                        } else {
                          toast.error("Failed to connect wallet");
                          console.error("Wallet connect error:", err);
                        }
                      }
                    }}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 mx-auto shadow-[0_0_15px_rgba(147,51,234,0.2)]"
                  >
                    <Wallet size={14} /> Connect Solana Wallet
                  </button>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded">
                  <p className="text-amber-400 text-[10px] leading-relaxed font-mono">
                    <strong>Router Mode:</strong> Connect your wallet to fund your off-chain Session Budget and pay for millisecond agent calls.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Holder Status Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[14px] font-semibold tracking-wide text-zinc-400 flex items-center gap-2">
              <Coins size={16} className="text-emerald-500" /> Holder Status
            </h3>
            <Link
              href="/token"
              className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1.5"
            >
              Details <ChevronRight size={12} />
            </Link>
          </div>

          {holderLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : holderData?.isHolder && holderData.tierInfo ? (
            <div className="space-y-4">
              {/* Tier Display */}
              <div className="bg-black/30 border border-white/5 rounded p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{holderData.tierInfo.emoji}</span>
                  <span className={`font-bold text-lg ${
                    holderData.tierInfo.id === 'og' ? 'text-amber-400' :
                    holderData.tierInfo.id === 'stacker' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>{holderData.tierInfo.label}</span>
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  {holderData.balance.toLocaleString()} $HIVE
                </div>
              </div>

              {/* Key Benefits */}
              <div>
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Active Perks</div>
                <ul className="space-y-1.5">
                  {(holderData.tierInfo.benefits || []).slice(0, 4).map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                      <CheckCircle size={10} className={`shrink-0 mt-0.5 ${
                        holderData.tierInfo.id === 'og' ? 'text-amber-500' :
                        holderData.tierInfo.id === 'stacker' ? 'text-blue-500' : 'text-emerald-500'
                      }`} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Premium API badge */}
              <Link
                href="/docs#x402-api"
                className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Lock size={12} />
                <span className="font-bold">Holder-Gated Premium API</span>
                <span className="text-emerald-600 ml-auto">Unlocked</span>
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <Coins size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-mono mb-1">
                {holderData ? `${holderData.balance.toLocaleString()} $HIVE` : 'No $HIVE detected'}
              </p>
              <p className="text-zinc-600 text-[11px] mb-4">Hold $HIVE for badges, API access, and perks</p>
              <a
                href="https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono font-bold uppercase tracking-widest rounded transition-colors"
              >
                <ExternalLink size={10} /> Get $HIVE
              </a>
            </div>
          )}
        </div>

        {/* Hive Points Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold tracking-wide text-zinc-400 flex items-center gap-2">
                <Coins size={16} className="text-emerald-500" /> Hive Points
              </h3>
              <button
                onClick={fetchPoints}
                disabled={pointsLoading}
                className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors"
              >
                {pointsLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4 font-medium">Earn points to convert into $HIVE.</p>

            <div className="bg-black/30 border border-emerald-500/20 rounded p-4 mb-4">
              <div className="text-[10px] text-zinc-500 font-mono uppercase">Current Balance</div>
              <div className="text-white font-mono font-bold text-2xl mb-1">{points?.currentPointsBalance ?? 0} PTS</div>
              <div className="text-[10px] text-zinc-600 font-mono">Total Earned: {points?.totalPointsEarned ?? 0} PTS</div>
            </div>

            {points?.currentPointsBalance > 0 && (
              <div className="bg-zinc-900/50 rounded p-3 text-xs font-mono text-zinc-400 mb-4">
                <div className="flex justify-between">
                  <span>Exchange Rate:</span>
                  <span className="text-white">10 PTS = 1 $HIVE</span>
                </div>
                <div className="flex justify-between mt-1 font-bold">
                  <span>Value:</span>
                  <span className="text-emerald-400">{(points.currentPointsBalance / 10).toFixed(1)} $HIVE</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-4">
            {!solanaAddress ? (
              <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded text-center">
                Connect your Solana wallet above to enable conversions.
              </div>
            ) : points?.currentPointsBalance < 1000 ? (
              <button
                disabled
                className="w-full py-2.5 bg-zinc-900 border border-white/5 text-zinc-500 font-bold font-mono text-xs uppercase tracking-widest rounded-lg cursor-not-allowed text-center"
              >
                Need 1,000 PTS to Convert
              </button>
            ) : (
              <button
                onClick={handleConvertPoints}
                disabled={convertingPoints}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {convertingPoints ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Convert to $HIVE
              </button>
            )}
            <Link
              href="/docs#hive-points"
              className="block text-center text-[10px] text-zinc-500 hover:text-emerald-400 font-mono uppercase tracking-widest"
            >
              How to earn points
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Tasks Posted" value={stats.totalPosted || 0} icon={<FileText size={16} />} />
        <StatCard label="Open Tasks" value={stats.openTasks || 0} icon={<Clock size={16} />} color="text-yellow-500" />
        <StatCard label="Pending Reviews" value={stats.pendingReviews || 0} icon={<Inbox size={16} />} color="text-purple-500" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
        <TabButton
          active={activeTab === "posted"}
          onClick={() => setActiveTab("posted")}
          label="My Tasks"
          count={stats.totalPosted}
        />
        <TabButton
          active={activeTab === "incoming"}
          onClick={() => setActiveTab("incoming")}
          label="Incoming Proposals"
          count={stats.incomingProposals}
        />
        <TabButton
          active={activeTab === "disputes"}
          onClick={() => setActiveTab("disputes")}
          label="DAO Slashing Disputes"
        />
      </div>

      {/* Tab Content */}
      {activeTab === "posted" && (
        <div className="space-y-4">
          {data?.postedTasks?.length > 0 ? (
            data.postedTasks.map((task: any) => (
              <Link key={task.id} href={`/marketplace/${task.id}`} className="block">
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-[16px] text-white group-hover:text-emerald-400 transition-colors">{task.title}</h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="text-[14px] text-zinc-400 line-clamp-2 leading-relaxed">{task.description}</p>
                      <div className="flex items-center gap-4 mt-4 text-[13px] text-zinc-500 font-medium">
                        <span>{task.category}</span>
                        <span>•</span>
                        <span>Budget: {task.budget || "Negotiable"}</span>
                        <span>•</span>
                        <span>{task.proposalsCount || 0} proposals</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {task.status === "Completed" && !task.hasReview && (
                        <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] font-semibold rounded-full hover:bg-amber-500/20 transition-colors">
                          Leave Review
                        </span>
                      )}
                      {task.status === "Completed" && task.hasReview && (
                        <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold rounded-full">
                          Reviewed ✓
                        </span>
                      )}
                      {(task.status === "In Review" || task.status === "WorkSubmitted") && (
                        <span className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] font-semibold rounded-full hover:bg-amber-500/20 transition-colors">
                          Review Work
                        </span>
                      )}
                      <ChevronRight className="text-zinc-600 group-hover:text-white transition-colors" size={20} />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <EmptyState
              icon={<FileText size={40} />}
              message="You haven't posted any tasks yet."
              actionLabel="Post Your First Task"
              actionHref="/create"
            />
          )}
        </div>
      )}

      {activeTab === "incoming" && (
        <div className="space-y-4">
          {data?.incomingProposals?.length > 0 ? (
            data.incomingProposals.map((bid: any) => (
              <div key={bid.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 font-bold text-[14px]">
                        {(bid.agentName || "AG").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-[16px] text-white block mb-0.5">{bid.agentName}</span>
                        <StatusBadge status={bid.status} />
                      </div>
                    </div>
                    <p className="text-[13px] text-zinc-500 mb-2 font-medium">
                      On: <Link href={`/marketplace/${bid.taskId}`} className="text-emerald-400 hover:underline">{bid.taskTitle}</Link>
                    </p>
                    <p className="text-[14px] text-zinc-400 line-clamp-2 leading-relaxed">{bid.coverLetter}</p>
                    <div className="flex items-center gap-4 mt-3 text-[13px] text-zinc-500 font-medium">
                      <span>Amount: <span className="text-zinc-300">{bid.amount}</span></span>
                      <span>•</span>
                      <span>{bid.timeEstimate}</span>
                    </div>
                  </div>
 
                  {bid.status === "Pending" && (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleBidAction(bid.taskId, bid.id, "rejected")}
                        disabled={!!processingBid}
                        className="px-6 py-2.5 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full text-[14px] font-semibold transition-all disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleBidAction(bid.taskId, bid.id, "accepted")}
                        disabled={!!processingBid}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-full text-[14px] font-semibold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingBid === bid.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Accept
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<Inbox size={40} />}
              message="No incoming proposals yet. Post a task to get started."
              actionLabel="Post a Task"
              actionHref="/create"
            />
          )}
        </div>
      )}

      {activeTab === "disputes" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-mono uppercase tracking-wide">Slashing Disputes</h2>
              <p className="text-zinc-500 text-xs font-mono mt-1">Staker slashing console. Vote using active staked HIVE weight.</p>
            </div>
            <button
              onClick={fetchDisputes}
              disabled={disputesLoading}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-full text-xs font-mono transition-colors"
            >
              {disputesLoading ? "Refreshing..." : "Refresh Disputes"}
            </button>
          </div>

          {disputesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : disputes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {disputes.map((dispute) => {
                const totalWeight = dispute.votesForSlash + dispute.votesAgainstSlash;
                const forPercent = totalWeight > 0 ? (dispute.votesForSlash / totalWeight) * 100 : 0;
                const againstPercent = totalWeight > 0 ? (dispute.votesAgainstSlash / totalWeight) * 100 : 0;
                const daysLeft = Math.max(0, Math.ceil((new Date(dispute.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                return (
                  <div key={dispute.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">
                          At Risk: {dispute.stakedAmount.toLocaleString()} HIVE
                        </span>
                        <h3 className="font-semibold text-lg text-white mt-3">Tool ID: {dispute.toolId}</h3>
                        <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate max-w-xs">Node: {dispute.providerAddress}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-amber-500 font-bold block">{daysLeft} days left</span>
                        <span className="text-[10px] text-zinc-600 font-mono block mt-0.5">Slot: {dispute.snapshotBlock}</span>
                      </div>
                    </div>

                    <p className="text-sm text-zinc-400 leading-relaxed font-sans">{dispute.reason}</p>

                    {/* Evidence link */}
                    {dispute.evidenceUri && (
                      <a
                        href={dispute.evidenceUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-mono"
                      >
                        <ExternalLink size={10} /> View Audit Evidence
                      </a>
                    )}

                    {/* Voting weight breakdown */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                        <span>Slash: {dispute.votesForSlash.toLocaleString()} HIVE ({forPercent.toFixed(1)}%)</span>
                        <span>Dismiss: {dispute.votesAgainstSlash.toLocaleString()} HIVE ({againstPercent.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex">
                        <div style={{ width: `${forPercent}%` }} className="bg-red-500 h-full" />
                        <div style={{ width: `${againstPercent}%` }} className="bg-emerald-500 h-full" />
                      </div>
                      <div className="text-right text-[10px] text-zinc-600 font-mono">
                        Total Voters: {dispute.voteCount}
                      </div>
                    </div>

                    {/* Voting actions */}
                    {new Date() < new Date(dispute.deadline) ? (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => handleVoteDispute(dispute.id, 'slash')}
                          disabled={votingDisputeId === dispute.id}
                          className="py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {votingDisputeId === dispute.id && <Loader2 size={12} className="animate-spin" />}
                          Vote Slash
                        </button>
                        <button
                          onClick={() => handleVoteDispute(dispute.id, 'dismiss')}
                          disabled={votingDisputeId === dispute.id}
                          className="py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {votingDisputeId === dispute.id && <Loader2 size={12} className="animate-spin" />}
                          Vote Dismiss
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2.5 text-zinc-500 text-xs font-mono border border-dashed border-white/5 rounded-lg bg-black/10">
                        Voting has ended. Awaiting settlement.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center border border-white/5 bg-white/[0.01] rounded-2xl">
              <Shield className="w-12 h-12 text-zinc-700 mx-auto mb-4 opacity-50" />
              <h3 className="text-base font-bold font-mono text-white mb-2 uppercase">No Active Disputes</h3>
              <p className="text-zinc-500 text-sm font-mono">All registered tool providers are currently operating securely.</p>
            </div>
          )}
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => { setShowDepositModal(false); setDepositAmount(""); }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold font-mono mb-2 uppercase tracking-wide">Fund Session Budget</h2>
            <p className="text-zinc-400 text-xs mb-6 font-mono leading-relaxed">
              Deposit USDC from your connected wallet to your off-chain session balance. 
              Authorized tool execution will deduct microfees directly from this balance.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Amount to Deposit</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    placeholder="10.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-sm pl-8 pr-16 py-3.5 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-lg font-bold"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">$</span>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">USDC</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-2">
                  <span>Wallet Balance: {solUsdcBalance ?? "0.00"} USDC</span>
                  <span>Minimum: $0.10</span>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-lg text-xs font-mono text-zinc-400 space-y-2">
                <div className="flex justify-between">
                  <span>Vault Address:</span>
                  <span className="text-white">3LQu...dura</span>
                </div>
                <div className="flex justify-between">
                  <span>Settlement Latency:</span>
                  <span className="text-emerald-400">Millisecond (Instant)</span>
                </div>
                <div className="flex justify-between">
                  <span>Protocol Fee:</span>
                  <span className="text-white">0.00%</span>
                </div>
              </div>

              <button
                onClick={handleDepositSession}
                disabled={depositing || !depositAmount || parseFloat(depositAmount) <= 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2 animate-pulse"
              >
                {depositing ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                {depositing ? "Processing Deposit..." : "Deposit USDC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-2xl max-w-2xl w-full shadow-2xl relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold font-mono mb-2 uppercase tracking-wide">Session Ledger Log</h2>
            <p className="text-zinc-400 text-xs mb-6 font-mono">
              The sliding log of deposits and tool invocations recorded against your session budget.
            </p>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {sessionHistory.length > 0 ? (
                <div className="border border-white/5 rounded-xl overflow-hidden font-mono text-xs">
                  <div className="grid grid-cols-12 bg-black/40 p-3 text-zinc-500 font-bold border-b border-white/5">
                    <div className="col-span-3">Time</div>
                    <div className="col-span-3">Type</div>
                    <div className="col-span-4">Tool / Signature</div>
                    <div className="col-span-2 text-right">Amount</div>
                  </div>
                  {sessionHistory.map((item) => {
                    const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const isDeposit = item.type === 'deposit';
                    const displayText = isDeposit 
                      ? `${item.settlementTxSignature?.slice(0, 4)}...${item.settlementTxSignature?.slice(-4)}`
                      : item.toolId;

                    return (
                      <div key={item.id} className="grid grid-cols-12 p-3 border-b border-white/5 hover:bg-white/[0.01] items-center text-zinc-400">
                        <div className="col-span-3 text-zinc-500">{dateStr}</div>
                        <div className="col-span-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isDeposit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {item.type}
                          </span>
                        </div>
                        <div className="col-span-4 truncate text-zinc-300">
                          {isDeposit && item.settlementTxSignature ? (
                            <a
                              href={`https://solscan.io/tx/${item.settlementTxSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-1 text-zinc-400 hover:text-white"
                            >
                              {displayText} <ExternalLink size={10} />
                            </a>
                          ) : (
                            displayText
                          )}
                        </div>
                        <div className={`col-span-2 text-right font-bold ${isDeposit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isDeposit ? `+$${item.amount.toFixed(2)}` : `-$${item.cost.toFixed(2)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-500 text-xs font-mono">
                  No execution logs recorded yet. Fund your balance to start.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, color = "text-emerald-400" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl shadow-sm">
      <div className={`flex items-center gap-2 ${color} mb-3 font-semibold`}>{icon}<span className="text-[13px] tracking-wide">{label}</span></div>
      <div className="text-[32px] font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2.5 text-[14px] font-medium rounded-full transition-all shadow-sm ${
        active ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
      }`}
    >
      {label} {count !== undefined && <span className={active ? "text-zinc-500" : "text-zinc-500"}>[{count}]</span>}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "In Progress": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "In Review": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Completed: "bg-green-500/10 text-green-400 border-green-500/20",
    Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    WorkSubmitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-[11px] font-semibold tracking-wide ${styles[status] || "bg-white/5 text-zinc-400 border-white/10"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon, message, actionLabel, actionHref }: { icon: React.ReactNode; message: string; actionLabel: string; actionHref: string }) {
  return (
    <div className="py-20 text-center border border-white/5 bg-white/[0.01] rounded-2xl">
      <div className="text-zinc-600 mb-6 flex justify-center opacity-50 scale-125">{icon}</div>
      <p className="text-zinc-400 text-[15px] font-medium mb-6">{message}</p>
      <Link href={actionHref} className="px-6 py-2.5 bg-white hover:bg-zinc-200 text-black text-[14px] font-semibold rounded-full transition-all shadow-sm">
        {actionLabel}
      </Link>
    </div>
  );
}
