"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Shield, Users, FileText, CheckCircle,
  Clock, ChevronRight, AlertTriangle, Inbox, Zap,
  Search, Trash2, ChevronLeft, ChevronsLeft, ChevronsRight,
  ArrowUpDown, X, Bot
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type AdminTab = "overview" | "tasks" | "agents" | "activity";

const AGENTS_PER_PAGE = 20;

export default function AdminDashboardPage() {
  const { user, authenticated, login, ready } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Agent management state
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsSearch, setAgentsSearch] = useState("");
  const [agentsSort, setAgentsSort] = useState("createdAt");
  const [agentsOrder, setAgentsOrder] = useState<"asc" | "desc">("desc");
  const [agentsVerifiedFilter, setAgentsVerifiedFilter] = useState<string>("all");
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const address = user?.wallet?.address;

  // Server-side admin verification
  useEffect(() => {
    if (!user?.wallet?.address) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    fetch(`/api/admin/verify?address=${user.wallet.address}`)
      .then(res => res.json())
      .then(data => {
        setIsAdmin(!!data.isAdmin);
        setAdminChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setAdminChecked(true);
      });
  }, [user?.wallet?.address]);

  // Fetch overview data
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

  // Fetch agents for management tab
  const fetchAgents = useCallback(async () => {
    if (!isAdmin || !address) return;
    setAgentsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(agentsPage),
        limit: String(AGENTS_PER_PAGE),
        sort: agentsSort,
        order: agentsOrder,
        address,
      });
      if (agentsSearch) params.set("search", agentsSearch);
      if (agentsVerifiedFilter !== "all") params.set("verified", agentsVerifiedFilter);

      const res = await fetch(`/api/admin/agents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setAgentsTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Agents fetch error:", err);
    } finally {
      setAgentsLoading(false);
    }
  }, [isAdmin, address, agentsPage, agentsSort, agentsOrder, agentsSearch, agentsVerifiedFilter]);

  useEffect(() => {
    if (activeTab === "agents") {
      const timeout = setTimeout(fetchAgents, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTab, fetchAgents]);

  // Reset to page 1 on filter change
  useEffect(() => { setAgentsPage(1); }, [agentsSearch, agentsVerifiedFilter, agentsSort, agentsOrder]);

  const handleDeleteAgent = async () => {
    if (!deleteModal || !address) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/agents/${deleteModal.id}?address=${address}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Agent "${deleteModal.name}" deleted.`);
        setDeleteModal(null);
        fetchAgents();
        // Refresh stats
        const statsRes = await fetch(`/api/admin/stats?address=${address}`);
        if (statsRes.ok) setData(await statsRes.json());
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete agent.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleVerified = async (agentId: string, currentlyVerified: boolean) => {
    if (!address) return;
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: !currentlyVerified, adminAddress: address }),
      });
      if (res.ok) {
        toast.success(currentlyVerified ? "Agent unverified." : "Agent verified.");
        fetchAgents();
      }
    } catch {
      toast.error("Failed to update agent.");
    }
  };

  const toggleSort = (field: string) => {
    if (agentsSort === field) {
      setAgentsOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setAgentsSort(field);
      setAgentsOrder("desc");
    }
  };

  const agentsTotalPages = Math.ceil(agentsTotal / AGENTS_PER_PAGE);

  // Access denied
  if (!authenticated || (!adminChecked) || (adminChecked && !isAdmin)) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center">
        <Navbar />
        {!adminChecked ? (
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        ) : (
          <>
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h1 className="text-2xl font-bold font-mono uppercase tracking-widest">Access Denied</h1>
            <p className="text-gray-500 mt-2 text-sm">You are not a platform administrator.</p>
            {!authenticated && (
              <button onClick={login} disabled={!ready} className="mt-6 px-6 py-3 bg-emerald-500 text-black font-bold font-mono uppercase transition-colors hover:bg-emerald-400 disabled:opacity-50">
                Sign In
              </button>
            )}
            <Link href="/marketplace" className="mt-4 text-zinc-500 hover:text-white text-xs font-mono uppercase underline">Return to Marketplace</Link>
          </>
        )}
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

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

      {/* ── Tasks Tab ── */}
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
                      {task.category} • Budget: {task.budget || "Negotiable"} • {task.proposalsCount || 0} proposals
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Agents Management Tab ── */}
      {activeTab === "agents" && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={agentsSearch}
                onChange={(e) => setAgentsSearch(e.target.value)}
                placeholder="Search agents by name or wallet..."
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors font-mono"
              />
              {agentsSearch && (
                <button onClick={() => setAgentsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Verified filter */}
            <div className="flex items-center gap-2">
              {["all", "true", "false"].map((v) => (
                <button
                  key={v}
                  onClick={() => setAgentsVerifiedFilter(v)}
                  className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded-lg transition-colors ${
                    agentsVerifiedFilter === v
                      ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {v === "all" ? "All" : v === "true" ? "Verified" : "Unverified"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_80px_80px_100px_120px] gap-4 px-4 py-3 bg-black/40 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <SortHeader label="Name" field="name" current={agentsSort} order={agentsOrder} onToggle={toggleSort} />
              <span>Wallet</span>
              <SortHeader label="Rep" field="reputation" current={agentsSort} order={agentsOrder} onToggle={toggleSort} />
              <span>Verified</span>
              <SortHeader label="Joined" field="createdAt" current={agentsSort} order={agentsOrder} onToggle={toggleSort} />
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            {agentsLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-sm font-mono">No agents found</div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="grid grid-cols-[1fr_120px_80px_80px_100px_120px] gap-4 px-4 py-3 border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors items-center text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold shrink-0">
                      {(agent.name || "AG").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{agent.name}</div>
                    </div>
                  </div>
                  <div className="text-zinc-500 text-xs font-mono truncate">
                    {agent.walletAddress ? `${agent.walletAddress.slice(0, 6)}...${agent.walletAddress.slice(-4)}` : "—"}
                  </div>
                  <div className="text-white font-mono font-bold">{agent.reputation}</div>
                  <div>
                    <button
                      onClick={() => handleToggleVerified(agent.id, agent.isVerified)}
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                        agent.isVerified
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                      }`}
                    >
                      {agent.isVerified ? "Yes" : "No"}
                    </button>
                  </div>
                  <div className="text-zinc-500 text-xs font-mono">
                    {new Date(agent.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/agent/${encodeURIComponent(agent.name)}`}
                      className="px-2 py-1 text-[10px] font-mono uppercase border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => setDeleteModal({ id: agent.id, name: agent.name })}
                      className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {agentsTotalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                <PaginationBtn onClick={() => setAgentsPage(1)} disabled={agentsPage === 1}>
                  <ChevronsLeft size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setAgentsPage(p => p - 1)} disabled={agentsPage === 1}>
                  <ChevronLeft size={14} />
                </PaginationBtn>
                <span className="px-4 py-2 text-xs font-mono text-zinc-400">
                  Page {agentsPage} of {agentsTotalPages}
                </span>
                <PaginationBtn onClick={() => setAgentsPage(p => p + 1)} disabled={agentsPage === agentsTotalPages}>
                  <ChevronRight size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setAgentsPage(agentsTotalPages)} disabled={agentsPage === agentsTotalPages}>
                  <ChevronsRight size={14} />
                </PaginationBtn>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                Showing {(agentsPage - 1) * AGENTS_PER_PAGE + 1}–{Math.min(agentsPage * AGENTS_PER_PAGE, agentsTotal)} of {agentsTotal} agents
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && (
        <div className="space-y-3">
          {data?.recentActivity?.map((item: any) => (
            <div key={item.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                item.type === "TaskCreated" ? "bg-blue-500/10 text-blue-500" :
                item.type === "BidSubmitted" ? "bg-yellow-500/10 text-yellow-500" :
                item.type === "ProposalAccepted" ? "bg-emerald-500/10 text-emerald-500" :
                item.type === "AgentDeleted" ? "bg-red-500/10 text-red-500" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                {item.type === "TaskCreated" ? "T" : item.type === "BidSubmitted" ? "B" : item.type === "ProposalAccepted" ? "✓" : item.type === "AgentDeleted" ? "×" : "?"}
              </div>
              <div className="flex-1">
                <div className="text-sm text-white">{item.type.replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-[10px] text-zinc-600 font-mono">
                  {item.actorName || item.actorAddress?.slice(0, 10)} • {item.metadata?.taskTitle || item.metadata?.agentName || ""} • {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentActivity || data.recentActivity.length === 0) && (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">No activity yet</div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-zinc-800 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="text-red-500" size={20} />
              </div>
              <h3 className="text-lg font-bold font-mono uppercase">Delete Agent</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-2">
              Are you sure you want to delete <span className="text-white font-bold">{deleteModal.name}</span>?
            </p>
            <p className="text-zinc-600 text-xs mb-6 font-mono">
              This will permanently remove the agent and all their proposals. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAgent}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

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

function SortHeader({ label, field, current, order, onToggle }: { label: string; field: string; current: string; order: string; onToggle: (f: string) => void }) {
  const isActive = current === field;
  return (
    <button onClick={() => onToggle(field)} className={`flex items-center gap-1 hover:text-white transition-colors ${isActive ? "text-emerald-500" : ""}`}>
      {label}
      <ArrowUpDown size={10} className={isActive ? (order === "asc" ? "rotate-180" : "") : "opacity-40"} />
    </button>
  );
}

function PaginationBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 border border-zinc-800 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
