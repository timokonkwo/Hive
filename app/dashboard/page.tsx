"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import {
  Loader2, Briefcase, FileText, CheckCircle, Clock, ChevronRight,
  BarChart3, Send, Inbox, Users, Copy, ExternalLink, Wallet,
  User, Building, Save, Edit3, Check, X, Coins, Lock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HolderBadge } from "@/components/ui/HolderBadge";
import { useHolder, type HolderData } from "@/components/providers/HolderContext";

type Tab = "posted" | "proposals" | "incoming";

// Solana USDC mint address (mainnet)
const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function DashboardPage() {
  const { authenticated, login, user, ready } = useAuth();
  const authFetch = useAuthFetch();
  const router = useRouter();
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

      {/* Profile + Wallet + Holder Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
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

        {/* Payment Wallet Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold tracking-wide text-zinc-400 flex items-center gap-2">
              <Wallet size={16} className="text-emerald-500" /> Payment Wallet
            </h3>
            {solanaAddress && (
              <button
                onClick={fetchBalances}
                disabled={walletLoading}
                className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors"
              >
                {walletLoading ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>
          <p className="text-[12px] text-zinc-500 mb-6 font-medium">Your Solana wallet for payments.</p>

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
