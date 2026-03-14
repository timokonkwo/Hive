"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Shield, Users, FileText, CheckCircle,
  Clock, BarChart3, ChevronRight, AlertTriangle, Inbox, Zap
} from "lucide-react";
import Link from "next/link";

type AdminTab = "overview" | "tasks" | "agents" | "activity";

export default function AdminDashboardPage() {
  const { user, authenticated, login, ready } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const isAdmin = user?.wallet?.address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/stats?address=${user?.wallet?.address}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Admin fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, user?.wallet?.address]);

  // Access denied
  if (!authenticated || !isAdmin) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold font-mono uppercase tracking-widest">Access Denied</h1>
        <p className="text-gray-500 mt-2 text-sm">You are not a platform administrator.</p>
        {!authenticated && (
          <button onClick={login} disabled={!ready} className="mt-6 px-6 py-3 bg-emerald-500 text-black font-bold font-mono uppercase transition-colors hover:bg-emerald-400 disabled:opacity-50">
            Sign In
          </button>
        )}
        <Link href="/marketplace" className="mt-4 text-zinc-500 hover:text-white text-xs font-mono uppercase underline">Return to Marketplace</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="min-h-screen text-white font-sans pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
      <Navbar />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-mono uppercase tracking-tighter flex items-center gap-3">
            <Shield className="text-emerald-500" /> Admin Panel
          </h1>
          <p className="text-zinc-500 text-sm font-mono mt-1">Platform management and analytics</p>
        </div>
        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-xs font-mono font-bold uppercase">
          Admin
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Tasks" value={stats.totalTasks} icon={<FileText size={16} />} />
        <StatCard label="Open" value={stats.openTasks} icon={<Clock size={16} />} color="text-yellow-500" />
        <StatCard label="In Progress" value={stats.inProgressTasks} icon={<Zap size={16} />} color="text-blue-500" />
        <StatCard label="Completed" value={stats.completedTasks} icon={<CheckCircle size={16} />} color="text-green-500" />
        <StatCard label="Agents" value={stats.totalAgents} icon={<Users size={16} />} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Proposals" value={stats.totalBids} icon={<Inbox size={16} />} />
        <StatCard label="Pending" value={stats.pendingBids} icon={<Clock size={16} />} color="text-yellow-500" />
        <StatCard label="Accepted" value={stats.acceptedBids} icon={<CheckCircle size={16} />} color="text-emerald-500" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-8 gap-1">
        {(["overview", "tasks", "agents", "activity"] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-mono uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === tab ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Tasks */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Recent Tasks</h3>
            <div className="space-y-3">
              {data?.recentTasks?.slice(0, 8).map((task: any) => (
                <Link key={task.id} href={`/marketplace/${task.id}`} className="block">
                  <div className="flex items-center justify-between p-3 bg-black/30 rounded hover:bg-black/50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate group-hover:text-emerald-400 transition-colors">{task.title}</div>
                      <div className="text-[10px] text-zinc-600 font-mono">{task.category} • {task.status} • {task.proposalsCount || 0} proposals</div>
                    </div>
                    <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Agents */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Registered Agents</h3>
            <div className="space-y-3">
              {data?.recentAgents?.slice(0, 8).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 bg-black/30 rounded">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">
                    {(agent.name || "AG").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{agent.name || "Unnamed"}</div>
                    <div className="text-[10px] text-zinc-600 font-mono">{agent.walletAddress?.slice(0, 10)}... • Rep: {agent.reputation || 0}</div>
                  </div>
                </div>
              ))}
              {(!data?.recentAgents || data.recentAgents.length === 0) && (
                <div className="text-zinc-600 text-sm text-center py-4">No agents registered yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-3">
          {data?.recentTasks?.map((task: any) => (
            <Link key={task.id} href={`/marketplace/${task.id}`} className="block">
              <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium group-hover:text-emerald-400 transition-colors">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="text-xs text-zinc-600 font-mono">
                      {task.category} • Budget: {task.budget || "Negotiable"} • {task.proposalsCount || 0} proposals • Posted by {task.clientName || task.clientAddress?.slice(0, 10)}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {activeTab === "agents" && (
        <div className="space-y-3">
          {data?.recentAgents?.map((agent: any) => (
            <div key={agent.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
                  {(agent.name || "AG").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{agent.name || "Unnamed Agent"}</div>
                  <div className="text-xs text-zinc-600 font-mono">
                    {agent.walletAddress} • Reputation: {agent.reputation || 0} • Verified: {agent.isVerified ? "Yes" : "No"}
                  </div>
                  {agent.bio && <div className="text-xs text-zinc-500 mt-1">{agent.bio}</div>}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentAgents || data.recentAgents.length === 0) && (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">No agents found</div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-3">
          {data?.recentActivity?.map((item: any) => (
            <div key={item.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                item.type === "TaskCreated" ? "bg-blue-500/10 text-blue-500" :
                item.type === "BidSubmitted" ? "bg-yellow-500/10 text-yellow-500" :
                item.type === "ProposalAccepted" ? "bg-emerald-500/10 text-emerald-500" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                {item.type === "TaskCreated" ? "T" : item.type === "BidSubmitted" ? "B" : item.type === "ProposalAccepted" ? "✓" : "?"}
              </div>
              <div className="flex-1">
                <div className="text-sm text-white">{item.type.replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-[10px] text-zinc-600 font-mono">
                  {item.actorName || item.actorAddress?.slice(0, 10)} • {item.metadata?.taskTitle || ""} • {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentActivity || data.recentActivity.length === 0) && (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">No activity yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-white" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg">
      <div className={`flex items-center gap-2 ${color} mb-1`}>{icon}<span className="text-[10px] text-zinc-500 uppercase font-mono">{label}</span></div>
      <div className="text-2xl font-bold font-mono text-white">{value || 0}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "In Progress": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Completed: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${styles[status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
      {status}
    </span>
  );
}
