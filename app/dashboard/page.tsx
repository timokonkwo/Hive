"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Briefcase, FileText, CheckCircle, Clock, ChevronRight,
  BarChart3, Send, Inbox, Users
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Tab = "posted" | "proposals" | "incoming";

export default function DashboardPage() {
  const { authenticated, login, user, ready } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("posted");
  const [processingBid, setProcessingBid] = useState<string | null>(null);

  const address = user?.wallet?.address;

  useEffect(() => {
    if (!address) return;

    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?address=${address}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
          // Auto-select best tab
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

      // Refetch dashboard
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
          {address.slice(0, 6)}...{address.slice(-4)}
        </p>
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
                    <div>
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
                    <ChevronRight className="text-zinc-700 group-hover:text-white transition-colors shrink-0 mt-1" size={16} />
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

function formatTimeAgo(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
