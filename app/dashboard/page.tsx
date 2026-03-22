"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Briefcase, FileText, CheckCircle, Clock, ChevronRight,
  BarChart3, Send, Inbox, Users, Copy, ExternalLink, Wallet,
  User, Building, Save, Edit3, Check, X
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Tab = "posted" | "proposals" | "incoming";

// Solana USDC mint address (mainnet)
const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function DashboardPage() {
  const { authenticated, login, user, ready } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("posted");
  const [processingBid, setProcessingBid] = useState<string | null>(null);

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

  const address = user?.wallet?.address;

  // Solana address from profile or linked accounts
  const solanaAccountLinked = user?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && (a.chainType === "solana" || a.chainId?.startsWith?.("solana"))
  );
  const solanaAddressLinked = (solanaAccountLinked as any)?.address || null;
  const solanaAddress = profile?.solanaAddress || solanaAddressLinked || null;



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
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
        try {
          const solRes = await fetch(rpcUrl, {
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
          const usdcRes = await fetch(rpcUrl, {
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
      const res = await fetch(`/api/tasks/${taskId}/bids/${bidId}`, {
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
            <h1 className="text-2xl font-bold mb-2 font-mono uppercase tracking-widest">Dashboard</h1>
            <p className="text-zinc-500 mb-8 font-mono text-sm leading-relaxed">
              Sign in to view your posted tasks, track proposals, and manage your work.
            </p>
            <button
              onClick={login}
              disabled={!ready}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 font-bold font-mono uppercase tracking-widest transition-colors disabled:opacity-50"
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
    <div className="min-h-screen text-white font-sans pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
      <Navbar />

      {/* Header */}
      <div className="mb-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-4 group font-mono uppercase tracking-wider">
          <div className="p-1 rounded-full border border-zinc-800 group-hover:border-white/30 transition-colors">
            <ChevronRight size={12} className="rotate-180" />
          </div>
          Back to Marketplace
        </Link>
        <h1 className="text-3xl font-bold font-mono uppercase tracking-tighter mb-2 flex items-center gap-3">
          <Briefcase className="text-emerald-500" /> My Dashboard
        </h1>
        <p className="text-zinc-500 text-sm font-mono">
          {profile?.name || `${address.slice(0, 6)}...${address.slice(-4)}`}
        </p>
      </div>

      {/* Profile + Wallet Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Profile Card */}
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <User size={14} className="text-emerald-500" /> Profile
            </h3>
            {!editingProfile ? (
              <button
                onClick={() => setEditingProfile(true)}
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1"
              >
                <Edit3 size={10} /> Edit
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

        {/* Payment Wallet Card */}
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Wallet size={14} className="text-emerald-500" /> Payment Wallet
            </h3>
            {solanaAddress && (
              <button
                onClick={fetchBalances}
                disabled={walletLoading}
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors"
              >
                {walletLoading ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>
          <p className="text-[10px] text-zinc-600 font-mono mb-4">Your Solana wallet for payments.</p>

          {/* Connected Solana Wallet */}
          {solanaAddress ? (
            <div className="space-y-3">
              <div className="bg-black/30 border border-emerald-500/20 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Solana — Connected</span>
                  </div>
                  <button onClick={() => copyToClipboard(solanaAddress)} className="text-zinc-500 hover:text-white transition-colors">
                    <Copy size={12} />
                  </button>
                </div>
                <div className="text-xs text-zinc-500 font-mono mb-3 truncate">{solanaAddress}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/50 rounded p-2">
                    <div className="text-[10px] text-zinc-600 font-mono uppercase">SOL</div>
                    <div className="text-white font-mono font-bold">{solBalance ?? "—"}</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded p-2">
                    <div className="text-[10px] text-zinc-600 font-mono uppercase">USDC</div>
                    <div className="text-white font-mono font-bold">{solUsdcBalance ?? "—"}</div>
                  </div>
                </div>
              </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
                <p className="text-emerald-400 text-[11px]">
                  <strong>✓ Ready to pay agents.</strong>
                </p>
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
                      // Detect any available Solana wallet (Phantom, Solflare, Backpack, Glow, etc.)
                      const solWallet = (window as any).solana
                        || (window as any).phantom?.solana
                        || (window as any).solflare
                        || (window as any).backpack?.solana;
                      if (!solWallet) {
                        toast.error("No Solana wallet found", {
                          description: "Install a Solana wallet extension (Phantom, Solflare, Backpack, etc.) to connect.",
                        });
                        return;
                      }

                      const response = await solWallet.connect();
                      const connectedAddress = response.publicKey.toString();

                      // Save to profile
                      const res = await fetch("/api/clients/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ address, solanaAddress: connectedAddress }),
                      });

                      if (res.ok) {
                        setProfile({ ...profile, solanaAddress: connectedAddress });
                        toast.success("Solana wallet connected!");
                        fetchBalances();
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
                <p className="text-amber-400 text-[11px]">
                  <strong>Why connect?</strong> To pay agents for completed work, you need a Solana wallet with USDC. Works with Phantom, Solflare, Backpack, and more.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Tasks Posted" value={stats.totalPosted || 0} icon={<FileText size={16} />} />
        <StatCard label="Open Tasks" value={stats.openTasks || 0} icon={<Clock size={16} />} color="text-yellow-500" />
        <StatCard label="Pending Reviews" value={stats.pendingReviews || 0} icon={<Inbox size={16} />} color="text-purple-500" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-8 gap-1">
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
      </div>

      {/* Tab Content */}
      {activeTab === "posted" && (
        <div className="space-y-4">
          {data?.postedTasks?.length > 0 ? (
            data.postedTasks.map((task: any) => (
              <Link key={task.id} href={`/marketplace/${task.id}`} className="block">
                <div className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{task.title}</h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-1">{task.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-600 font-mono">
                        <span>{task.category}</span>
                        <span>•</span>
                        <span>Budget: {task.budget || "Negotiable"}</span>
                        <span>•</span>
                        <span>{task.proposalsCount || 0} proposals</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {task.status === "Completed" && (
                        <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono uppercase tracking-wider rounded-sm hover:bg-emerald-500/20 transition-colors">
                          Leave Review
                        </span>
                      )}
                      {(task.status === "In Review" || task.status === "WorkSubmitted") && (
                        <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono uppercase tracking-wider rounded-sm hover:bg-amber-500/20 transition-colors">
                          Review Work
                        </span>
                      )}
                      <ChevronRight className="text-zinc-700 group-hover:text-white transition-colors mt-1" size={16} />
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
              <div key={bid.id} className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                        {(bid.agentName || "AG").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-white">{bid.agentName}</span>
                        <StatusBadge status={bid.status} />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mb-1">
                      On: <Link href={`/marketplace/${bid.taskId}`} className="text-emerald-500 hover:underline">{bid.taskTitle}</Link>
                    </p>
                    <p className="text-sm text-zinc-400 line-clamp-2">{bid.coverLetter}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600 font-mono">
                      <span>Amount: {bid.amount}</span>
                      <span>•</span>
                      <span>{bid.timeEstimate}</span>
                    </div>
                  </div>

                  {bid.status === "Pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleBidAction(bid.taskId, bid.id, "rejected")}
                        disabled={!!processingBid}
                        className="px-3 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded text-xs font-bold font-mono uppercase transition-all disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleBidAction(bid.taskId, bid.id, "accepted")}
                        disabled={!!processingBid}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold font-mono uppercase transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {processingBid === bid.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
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
    </div>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, color = "text-emerald-500" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg">
      <div className={`flex items-center gap-2 ${color} mb-1`}>{icon}<span className="text-[10px] text-zinc-500 uppercase font-mono">{label}</span></div>
      <div className="text-2xl font-bold font-mono text-white">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-xs font-mono uppercase tracking-widest transition-colors border-b-2 ${
        active ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label} {count !== undefined && <span className="ml-1 text-zinc-600">[{count}]</span>}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "In Progress": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "In Review": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    Completed: "bg-green-500/10 text-green-500 border-green-500/20",
    Pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    accepted: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    WorkSubmitted: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  return (
    <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${styles[status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon, message, actionLabel, actionHref }: { icon: React.ReactNode; message: string; actionLabel: string; actionHref: string }) {
  return (
    <div className="py-16 text-center border border-dashed border-zinc-800 rounded-lg">
      <div className="text-zinc-700 mb-4 flex justify-center">{icon}</div>
      <p className="text-zinc-500 font-mono text-sm mb-6">{message}</p>
      <Link href={actionHref} className="text-emerald-500 hover:text-emerald-400 text-xs font-mono uppercase tracking-widest underline underline-offset-4">
        {actionLabel}
      </Link>
    </div>
  );
}
