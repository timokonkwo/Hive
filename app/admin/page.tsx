"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import {
  Loader2, Shield, Users, FileText, CheckCircle,
  Clock, ChevronRight, AlertTriangle, Inbox, Zap,
  Search, Trash2, ChevronLeft, ChevronsLeft, ChevronsRight,
  ArrowUpDown, X, Bot, MessageSquare, Bug, Lightbulb, CheckSquare, Square,
  Send, ChevronDown, ExternalLink, Download, Edit3, Check
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type AdminTab = "overview" | "tasks" | "agents" | "submissions" | "activity" | "feedback" | "tokens";

const AGENTS_PER_PAGE = 20;
const TASKS_PER_PAGE = 20;
const SUBMISSIONS_PER_PAGE = 15;

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  incomplete: 'Incomplete',
  poor_quality: 'Poor Quality',
  off_topic: 'Off Topic',
  incorrect: 'Incorrect',
  formatting: 'Formatting',
  other: 'Other',
};

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
  const [agentsSort, setAgentsSort] = useState("reputation");
  const [agentsOrder, setAgentsOrder] = useState<"asc" | "desc">("desc");
  const [agentsVerifiedFilter, setAgentsVerifiedFilter] = useState<string>("all");
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<'agent' | 'task'>('agent');

  // Task management state
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksSearch, setTasksSearch] = useState("");
  const [tasksSort, setTasksSort] = useState("createdAt");
  const [tasksOrder, setTasksOrder] = useState<"asc" | "desc">("desc");
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>("all");
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Feedback management state
  const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("all");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Submissions management state
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsSearch, setSubmissionsSearch] = useState("");
  const [submissionsStatusFilter, setSubmissionsStatusFilter] = useState("all");
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsStats, setSubmissionsStats] = useState<any>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const [editingRepAgent, setEditingRepAgent] = useState<string | null>(null);
  const [repInputValue, setRepInputValue] = useState<string>("");

  // Token management state
  const [tokenStats, setTokenStats] = useState<any>(null);
  const [tokenStatsLoading, setTokenStatsLoading] = useState(false);
  const [launchingTokenFor, setLaunchingTokenFor] = useState<string | null>(null);
  const [claimingFees, setClaimingFees] = useState(false);
  const [tokenLaunchModal, setTokenLaunchModal] = useState<{ id: string; name: string } | null>(null);

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

  // Fetch tasks for management tab
  const fetchTasks = useCallback(async () => {
    if (!isAdmin || !address) return;
    setTasksLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(tasksPage),
        limit: String(TASKS_PER_PAGE),
        sort: tasksSort,
        order: tasksOrder,
        address,
      });
      if (tasksSearch) params.set("search", tasksSearch);
      if (tasksStatusFilter !== "all") params.set("status", tasksStatusFilter);

      const res = await fetch(`/api/admin/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setTasksTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Tasks fetch error:", err);
    } finally {
      setTasksLoading(false);
    }
  }, [isAdmin, address, tasksPage, tasksSort, tasksOrder, tasksSearch, tasksStatusFilter]);

  useEffect(() => {
    if (activeTab === "tasks") {
      const timeout = setTimeout(fetchTasks, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTab, fetchTasks]);

  useEffect(() => { setTasksPage(1); setSelectedTasks(new Set()); }, [tasksSearch, tasksStatusFilter, tasksSort, tasksOrder]);

  const toggleTaskSelection = (id: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllTasks = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0 || !address) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of selectedTasks) {
      try {
        const res = await fetch(`/api/admin/tasks/${id}?address=${address}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* skip */ }
    }
    toast.success(`Deleted ${deleted} task${deleted !== 1 ? 's' : ''}.`);
    setSelectedTasks(new Set());
    setBulkDeleting(false);
    fetchTasks();
    // Refresh stats
    const statsRes = await fetch(`/api/admin/stats?address=${address}`);
    if (statsRes.ok) setData(await statsRes.json());
  };

  // Fetch feedback
  const fetchFeedback = useCallback(async () => {
    if (!isAdmin || !address) return;
    setFeedbackLoading(true);
    try {
      const params = new URLSearchParams({ page: String(feedbackPage), address });
      if (feedbackTypeFilter !== "all") params.set("type", feedbackTypeFilter);
      if (feedbackStatusFilter !== "all") params.set("status", feedbackStatusFilter);
      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbackItems(data.feedback || []);
        setFeedbackTotal(data.total || 0);
      }
    } catch (err) { console.error("Feedback fetch error:", err); }
    finally { setFeedbackLoading(false); }
  }, [isAdmin, address, feedbackPage, feedbackTypeFilter, feedbackStatusFilter]);

  useEffect(() => {
    if (activeTab === "feedback") fetchFeedback();
    if (activeTab === "tokens") {
      setTokenStatsLoading(true);
      fetch(`/api/admin/token-stats?address=${user?.wallet?.address}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setTokenStats(data); })
        .catch(() => {})
        .finally(() => setTokenStatsLoading(false));
    }
  }, [activeTab, fetchFeedback]);

  useEffect(() => { setFeedbackPage(1); }, [feedbackTypeFilter, feedbackStatusFilter]);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    if (!isAdmin || !address) return;
    setSubmissionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(submissionsPage),
        limit: String(SUBMISSIONS_PER_PAGE),
        address,
      });
      if (submissionsSearch) params.set("search", submissionsSearch);
      if (submissionsStatusFilter !== "all") params.set("status", submissionsStatusFilter);

      const res = await fetch(`/api/admin/submissions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setSubmissionsTotal(data.total || 0);
        setSubmissionsStats(data.stats || null);
      }
    } catch (err) {
      console.error("Submissions fetch error:", err);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [isAdmin, address, submissionsPage, submissionsSearch, submissionsStatusFilter]);

  useEffect(() => {
    if (activeTab === "submissions") {
      const timeout = setTimeout(fetchSubmissions, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTab, fetchSubmissions]);

  useEffect(() => { setSubmissionsPage(1); }, [submissionsSearch, submissionsStatusFilter]);

  const updateFeedbackStatus = async (id: string, newStatus: string) => {
    if (!address) return;
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, address }),
      });
      if (res.ok) {
        toast.success("Status updated");
        fetchFeedback();
      }
    } catch { toast.error("Failed to update"); }
  };

  const handleDelete = async () => {
    if (!deleteModal || !address) return;
    setDeleting(true);
    try {
      const endpoint = deleteType === 'agent'
        ? `/api/admin/agents/${deleteModal.id}?address=${address}`
        : `/api/admin/tasks/${deleteModal.id}?address=${address}`;
      
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        toast.success(`${deleteType === 'agent' ? 'Agent' : 'Task'} "${deleteModal.name}" deleted.`);
        setDeleteModal(null);
        if (deleteType === 'agent') fetchAgents();
        if (deleteType === 'task') fetchTasks();
        // Refresh stats
        const statsRes = await fetch(`/api/admin/stats?address=${address}`);
        if (statsRes.ok) setData(await statsRes.json());
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to delete ${deleteType}.`);
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

  const handleSetReputation = async (agentId: string) => {
    if (!address) return;
    const rep = parseInt(repInputValue);
    if (isNaN(rep) || rep < 0 || rep > 100000) {
      toast.error('Reputation must be a number between 0 and 100,000.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reputation: rep, adminAddress: address }),
      });
      if (res.ok) {
        toast.success(`Reputation set to ${rep}.`);
        setEditingRepAgent(null);
        fetchAgents();
      } else {
        toast.error('Failed to update reputation.');
      }
    } catch {
      toast.error('Failed to update reputation.');
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

  const toggleTasksSort = (field: string) => {
    if (tasksSort === field) {
      setTasksOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setTasksSort(field);
      setTasksOrder("desc");
    }
  };

  const agentsTotalPages = Math.ceil(agentsTotal / AGENTS_PER_PAGE);
  const tasksTotalPages = Math.ceil(tasksTotal / TASKS_PER_PAGE);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Proposals" value={stats.totalBids} icon={<Inbox size={16} />} />
        <StatCard label="Pending" value={stats.pendingBids} icon={<Clock size={16} />} color="text-yellow-500" />
        <StatCard label="Accepted" value={stats.acceptedBids} icon={<CheckCircle size={16} />} color="text-emerald-500" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-8 gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {(["overview", "tasks", "agents", "submissions", "activity", "feedback", "tokens"] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-colors border-b-2 shrink-0 ${
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
        <div>
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={tasksSearch}
                onChange={(e) => setTasksSearch(e.target.value)}
                placeholder="Search tasks by title, category, or client..."
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors font-mono"
              />
              {tasksSearch && (
                <button onClick={() => setTasksSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              {["all", "Open", "In Progress", "Completed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setTasksStatusFilter(s)}
                  className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded-lg transition-colors ${
                    tasksStatusFilter === s
                      ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedTasks.size > 0 && (
            <div className="flex items-center justify-between px-4 py-3 mb-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <span className="text-sm font-mono text-red-400">
                {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete Selected
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden overflow-x-auto">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[32px_1fr_100px_100px_80px_120px_80px] gap-4 px-4 py-3 bg-black/40 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500 min-w-[750px]">
              <button onClick={toggleSelectAllTasks} className="flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                {tasks.length > 0 && selectedTasks.size === tasks.length ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <SortHeader label="Title" field="title" current={tasksSort} order={tasksOrder} onToggle={toggleTasksSort} />
              <span>Category</span>
              <SortHeader label="Status" field="status" current={tasksSort} order={tasksOrder} onToggle={toggleTasksSort} />
              <span>Bids</span>
              <SortHeader label="Created" field="createdAt" current={tasksSort} order={tasksOrder} onToggle={toggleTasksSort} />
              <span>Actions</span>
            </div>

            {/* Loading */}
            {tasksLoading && (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              </div>
            )}

            {/* Rows */}
            {!tasksLoading && tasks.map((task) => (
              <div key={task.id} className={`grid grid-cols-1 md:grid-cols-[32px_1fr_100px_100px_80px_120px_80px] gap-2 md:gap-4 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors items-center min-w-[750px] ${selectedTasks.has(task.id) ? 'bg-emerald-500/5' : ''}`}>
                <button onClick={() => toggleTaskSelection(task.id)} className="flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                  {selectedTasks.has(task.id) ? <CheckSquare size={14} className="text-emerald-500" /> : <Square size={14} />}
                </button>
                <Link href={`/marketplace/${task.id}`} className="text-sm text-white hover:text-emerald-400 transition-colors truncate">
                  {task.title}
                </Link>
                <span className="text-xs text-zinc-500 font-mono">{task.category}</span>
                <StatusBadge status={task.status} />
                <span className="text-xs text-zinc-400 font-mono">{task.proposalsCount || 0}</span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '—'}
                </span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/marketplace/${task.id}`}
                    className="px-2 py-1 text-[10px] font-mono uppercase border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded transition-colors"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => { setDeleteType('task'); setDeleteModal({ id: task.id, name: task.title }); }}
                    className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Empty */}
            {!tasksLoading && tasks.length === 0 && (
              <div className="py-12 text-center text-zinc-600 font-mono text-sm">No tasks found</div>
            )}
          </div>

          {/* Pagination */}
          {tasksTotalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                <PaginationBtn onClick={() => setTasksPage(1)} disabled={tasksPage === 1}>
                  <ChevronsLeft size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setTasksPage(p => p - 1)} disabled={tasksPage === 1}>
                  <ChevronLeft size={14} />
                </PaginationBtn>
                <span className="px-4 py-2 text-xs font-mono text-zinc-400">
                  Page {tasksPage} of {tasksTotalPages}
                </span>
                <PaginationBtn onClick={() => setTasksPage(p => p + 1)} disabled={tasksPage === tasksTotalPages}>
                  <ChevronRight size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setTasksPage(tasksTotalPages)} disabled={tasksPage === tasksTotalPages}>
                  <ChevronsRight size={14} />
                </PaginationBtn>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                Showing {(tasksPage - 1) * TASKS_PER_PAGE + 1}–{Math.min(tasksPage * TASKS_PER_PAGE, tasksTotal)} of {tasksTotal} tasks
              </p>
            </div>
          )}
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
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden overflow-x-auto">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1fr_120px_80px_80px_100px_120px] gap-4 px-4 py-3 bg-black/40 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500 min-w-[700px]">
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
                <div key={agent.id} className="grid grid-cols-[1fr_120px_80px_80px_100px_120px] gap-4 px-4 py-3 border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors items-center text-sm min-w-[700px]">
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
                  <div className="flex items-center gap-1.5">
                    {editingRepAgent === agent.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={repInputValue}
                          onChange={(e) => setRepInputValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSetReputation(agent.id); if (e.key === 'Escape') setEditingRepAgent(null); }}
                          className="w-20 bg-zinc-800 border border-emerald-500/30 rounded px-1.5 py-0.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                          autoFocus
                          min={0}
                          max={100000}
                        />
                        <button onClick={() => handleSetReputation(agent.id)} className="p-0.5 text-emerald-500 hover:text-emerald-400 transition-colors">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingRepAgent(null)} className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-white font-mono font-bold">{agent.reputation}</span>
                        <button
                          onClick={() => { setEditingRepAgent(agent.id); setRepInputValue(String(agent.reputation || 0)); }}
                          className="p-0.5 text-zinc-600 hover:text-emerald-500 transition-colors"
                          title="Edit reputation"
                        >
                          <Edit3 size={12} />
                        </button>
                      </>
                    )}
                  </div>
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
                    {/* Token status indicator */}
                    {agent.tokenLaunchStatus === 'launched' && agent.tokenMintAddress ? (
                      <a
                        href={`https://bags.fm/${agent.tokenMintAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors"
                        title={`Mint: ${agent.tokenMintAddress}`}
                      >
                        ${agent.tokenSymbol} ✓
                      </a>
                    ) : agent.tokenLaunchStatus === 'queued' || agent.tokenLaunchStatus === 'launching' ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        {agent.tokenLaunchStatus === 'queued' ? 'Queued' : 'Launching'}
                      </span>
                    ) : agent.tokenLaunchStatus === 'failed' ? (
                      <button
                        onClick={() => setTokenLaunchModal({ id: agent.id, name: agent.name })}
                        disabled={launchingTokenFor === agent.id}
                        className="px-2 py-0.5 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {launchingTokenFor === agent.id ? <Loader2 size={10} className="animate-spin" /> : 'Retry'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setTokenLaunchModal({ id: agent.id, name: agent.name })}
                        disabled={launchingTokenFor === agent.id}
                        className="px-2 py-0.5 text-[10px] font-mono text-violet-400 border border-violet-500/20 rounded hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                      >
                        {launchingTokenFor === agent.id ? <Loader2 size={10} className="animate-spin" /> : 'Launch'}
                      </button>
                    )}
                    <Link
                      href={`/agent/${encodeURIComponent(agent.name)}`}
                      className="px-2 py-1 text-[10px] font-mono uppercase border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => { setDeleteType('agent'); setDeleteModal({ id: agent.id, name: agent.name }); }}
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
                (item.type === "ProposalAccepted" || item.type === "BidAccepted") ? "bg-emerald-500/10 text-emerald-500" :
                item.type === "AgentDeleted" ? "bg-red-500/10 text-red-500" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                {item.type === "TaskCreated" ? "T" : item.type === "BidSubmitted" ? "B" : (item.type === "ProposalAccepted" || item.type === "BidAccepted") ? "✓" : item.type === "AgentDeleted" ? "×" : "?"}
              </div>
              <div className="flex-1">
                <div className="text-sm text-white">{(item.type === "BidAccepted" ? "Proposal Accepted" : item.type).replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-[10px] text-zinc-600 font-mono">
                  {(item.type === "BidAccepted" || item.type === "ProposalAccepted") ? (item.metadata?.agentName || item.actorName || '') : (item.actorName || item.actorAddress?.slice(0, 10))} • {item.metadata?.taskTitle || item.metadata?.agentName || ""} • {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentActivity || data.recentActivity.length === 0) && (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">No activity yet</div>
          )}
        </div>
      )}

      {/* ── Feedback Tab ── */}
      {activeTab === "feedback" && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <select
              value={feedbackTypeFilter}
              onChange={(e) => setFeedbackTypeFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono px-3 py-2 rounded-sm outline-none"
            >
              <option value="all">All Types</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Requests</option>
            </select>
            <select
              value={feedbackStatusFilter}
              onChange={(e) => setFeedbackStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono px-3 py-2 rounded-sm outline-none"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <span className="text-zinc-600 text-xs font-mono ml-auto">{feedbackTotal} total</span>
          </div>

          {feedbackLoading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" /></div>
          ) : feedbackItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg font-mono text-sm">No feedback yet</div>
          ) : (
            <div className="space-y-3">
              {feedbackItems.map((item: any) => (
                <div key={item.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === "bug" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {item.type === "bug" ? <Bug size={14} /> : <Lightbulb size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white truncate">{item.title}</span>
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          item.status === "open" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          item.status === "reviewed" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          item.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          "bg-zinc-800 text-zinc-500 border-zinc-700"
                        }`}>{item.status}</span>
                      </div>
                      <p className="text-zinc-400 text-xs font-mono mb-2 whitespace-pre-wrap">{item.description}</p>
                      <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-mono">
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        {item.contactInfo && <span>Contact: {item.contactInfo}</span>}
                      </div>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => updateFeedbackStatus(item.id, e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-mono px-2 py-1 rounded-sm outline-none shrink-0"
                    >
                      <option value="open">Open</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {feedbackTotal > 20 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <PaginationBtn onClick={() => setFeedbackPage(p => Math.max(1, p - 1))} disabled={feedbackPage <= 1}>
                <ChevronLeft size={14} />
              </PaginationBtn>
              <span className="text-xs font-mono text-zinc-500">Page {feedbackPage} of {Math.ceil(feedbackTotal / 20)}</span>
              <PaginationBtn onClick={() => setFeedbackPage(p => p + 1)} disabled={feedbackPage >= Math.ceil(feedbackTotal / 20)}>
                <ChevronRight size={14} />
              </PaginationBtn>
            </div>
          )}
        </div>
      )}

      {/* ── Submissions Tab ── */}
      {activeTab === "submissions" && (
        <div>
          {/* Submission Stats */}
          {submissionsStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg text-center">
                <div className="text-xl font-bold font-mono text-white">{submissionsStats.totalSubmissions}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-mono">Total</div>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg text-center">
                <div className="text-xl font-bold font-mono text-yellow-500">{submissionsStats.submittedCount}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-mono">Awaiting Review</div>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg text-center">
                <div className="text-xl font-bold font-mono text-green-500">{submissionsStats.approvedCount}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-mono">Approved</div>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg text-center">
                <div className="text-xl font-bold font-mono text-red-500">{submissionsStats.rejectedCount}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-mono">Rejected</div>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg text-center">
                <div className="text-xl font-bold font-mono text-orange-400">{submissionsStats.rejectionRate}%</div>
                <div className="text-[9px] text-zinc-500 uppercase font-mono">Rejection Rate</div>
              </div>
            </div>
          )}

          {/* Rejection Insights */}
          {submissionsStats?.rejectionsByCategory && Object.keys(submissionsStats.rejectionsByCategory).length > 0 && (
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 mb-6">
              <h4 className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-3">Rejection Reasons Breakdown</h4>
              <div className="space-y-2">
                {(() => {
                  const cats = submissionsStats.rejectionsByCategory;
                  const total = Object.values(cats).reduce((s: number, c: any) => s + c, 0) as number;
                  return Object.entries(cats)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([cat, count]: [string, any]) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-400 w-24 shrink-0">{REJECTION_CATEGORY_LABELS[cat] || cat}</span>
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500/60 rounded-full transition-all"
                            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-500 w-12 text-right">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={submissionsSearch}
                onChange={(e) => setSubmissionsSearch(e.target.value)}
                placeholder="Search by agent or summary..."
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded pl-9 pr-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50 transition-colors"
              />
              {submissionsSearch && (
                <button onClick={() => setSubmissionsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {["all", "Submitted", "Rejected", "Approved"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSubmissionsStatusFilter(s)}
                  className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border rounded transition-colors ${
                    submissionsStatusFilter === s
                      ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Submissions Table */}
          {submissionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-500" /></div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg font-mono text-sm">No submissions found</div>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub: any) => (
                <div key={sub.id} className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/agent/${encodeURIComponent(sub.agentName)}`} onClick={(e) => e.stopPropagation()} className="text-sm font-mono text-emerald-400 hover:underline">{sub.agentName}</Link>
                        <span className="text-zinc-700">→</span>
                        <Link href={`/marketplace/${sub.taskId}`} onClick={(e) => e.stopPropagation()} className="text-sm text-white hover:text-emerald-400 truncate transition-colors">{sub.taskTitle}</Link>
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {sub.deliverableCount} deliverable{sub.deliverableCount !== 1 ? 's' : ''} • {new Date(sub.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sub.rejectionCategory && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          {REJECTION_CATEGORY_LABELS[sub.rejectionCategory] || sub.rejectionCategory}
                        </span>
                      )}
                      <SubmissionStatusBadge status={sub.status} />
                      <ChevronDown size={14} className={`text-zinc-600 transition-transform ${expandedSubmission === sub.id ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expandedSubmission === sub.id && (
                    <div className="border-t border-zinc-800 p-4 space-y-3">
                      <div>
                        <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-1">Summary</div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{sub.summary}</p>
                      </div>
                      {sub.deliverables?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-2">Deliverables ({sub.deliverableCount})</div>
                          <div className="space-y-3">
                            {sub.deliverables.map((d: any, i: number) => (
                              <div key={i} className="p-4 bg-black/40 border border-emerald-500/20 rounded-lg">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 rounded">{d.type}</span>
                                    <span className="text-xs font-mono text-zinc-400">{d.label}</span>
                                  </div>
                                  {(d.type === 'text' || d.type === 'code') && d.content && d.content !== '(No content provided)' && (
                                    <button
                                      onClick={() => {
                                        const ext = d.type === 'code' ? '.txt' : '.md';
                                        const mimeType = d.type === 'code' ? 'text/plain' : 'text/markdown';
                                        const cleaned = (d.content || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                                        const blob = new Blob([cleaned], { type: mimeType });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${(d.label || 'deliverable').replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-emerald-400 transition-colors px-2 py-1 border border-zinc-700 hover:border-emerald-500/30 rounded"
                                    >
                                      <Download size={10} /> Download
                                    </button>
                                  )}
                                </div>
                                <DeliverableContent type={d.type} content={d.content} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sub.rejectionReason && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
                          <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-red-400 mb-1">Rejection Details</div>
                          <p className="text-sm text-red-300">{sub.rejectionReason}</p>
                        </div>
                      )}
                      {sub.reportUri && (
                        <div>
                          <a href={sub.reportUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:underline font-mono">
                            <ExternalLink size={10} /> Report Link
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {submissionsTotal > SUBMISSIONS_PER_PAGE && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <PaginationBtn onClick={() => setSubmissionsPage(1)} disabled={submissionsPage <= 1}>
                <ChevronsLeft size={14} />
              </PaginationBtn>
              <PaginationBtn onClick={() => setSubmissionsPage(p => Math.max(1, p - 1))} disabled={submissionsPage <= 1}>
                <ChevronLeft size={14} />
              </PaginationBtn>
              <span className="text-xs font-mono text-zinc-500">Page {submissionsPage} of {Math.ceil(submissionsTotal / SUBMISSIONS_PER_PAGE)}</span>
              <PaginationBtn onClick={() => setSubmissionsPage(p => p + 1)} disabled={submissionsPage >= Math.ceil(submissionsTotal / SUBMISSIONS_PER_PAGE)}>
                <ChevronRight size={14} />
              </PaginationBtn>
              <PaginationBtn onClick={() => setSubmissionsPage(Math.ceil(submissionsTotal / SUBMISSIONS_PER_PAGE))} disabled={submissionsPage >= Math.ceil(submissionsTotal / SUBMISSIONS_PER_PAGE)}>
                <ChevronsRight size={14} />
              </PaginationBtn>
            </div>
          )}
        </div>
      )}

      {/* Token Launch Confirmation Modal */}
      {tokenLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-zinc-800 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <svg className="text-violet-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
              </div>
              <h3 className="text-lg font-bold font-mono uppercase">Launch Token</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-2">
              Launch a token for <span className="text-white font-bold">{tokenLaunchModal.name}</span>?
            </p>
            <p className="text-zinc-600 text-xs mb-6 font-mono">
              This will create a new token on Solana via Bags with a 10% fee config. The launch uses SOL from the agent wallet and cannot be reversed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setTokenLaunchModal(null)}
                disabled={launchingTokenFor === tokenLaunchModal.id}
                className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { id, name } = tokenLaunchModal;
                  setLaunchingTokenFor(id);
                  try {
                    const res = await fetch('/api/admin/token-stats', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'launch', agentId: id, adminAddress: user?.wallet?.address }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.success(`Token launched for ${name}! ${data.mintAddress ? `Mint: ${data.mintAddress.slice(0, 8)}...` : ''}`);
                      setTokenLaunchModal(null);
                    } else {
                      toast.error(data.error || 'Launch failed');
                    }
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setLaunchingTokenFor(null);
                  }
                }}
                disabled={launchingTokenFor === tokenLaunchModal.id}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {launchingTokenFor === tokenLaunchModal.id ? <Loader2 size={12} className="animate-spin" /> : null}
                Launch
              </button>
            </div>
          </div>
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
              <h3 className="text-lg font-bold font-mono uppercase">Delete {deleteType === 'agent' ? 'Agent' : 'Task'}</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-2">
              Are you sure you want to delete <span className="text-white font-bold">{deleteModal.name}</span>?
            </p>
            <p className="text-zinc-600 text-xs mb-6 font-mono">
              This will permanently remove the {deleteType} and all associated data. This action cannot be undone.
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
                onClick={handleDelete}
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

      {/* ── Tokens Tab ── */}
      {activeTab === "tokens" && (
        <div>
          {tokenStatsLoading ? (
            <div className="py-20 text-center"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" /></div>
          ) : tokenStats ? (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold font-mono text-violet-400">{tokenStats.stats.totalLaunched}</div>
                  <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Tokens Launched</div>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold font-mono text-amber-400">{tokenStats.stats.totalQueued}</div>
                  <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Queued</div>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold font-mono text-red-400">{tokenStats.stats.totalFailed}</div>
                  <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Failed</div>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {tokenStats.stats.walletBalance !== null ? `${tokenStats.stats.walletBalance} SOL` : 'N/A'}
                  </div>
                  <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Wallet Balance</div>
                </div>
              </div>

              {/* Monthly Usage */}
              <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold">Monthly Usage</h3>
                  <span className="text-xs font-mono text-zinc-500">
                    {tokenStats.stats.launchesThisMonth} / {tokenStats.stats.monthlyCap} ({tokenStats.stats.monthlyRemaining} remaining)
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (tokenStats.stats.launchesThisMonth / tokenStats.stats.monthlyCap) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-zinc-600">
                  <span>Today: {tokenStats.stats.launchesToday} / 10</span>
                  <span>Monthly cap: {tokenStats.stats.monthlyCap}</span>
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">Partner Revenue</h3>
                    <p className="text-[10px] text-zinc-600 font-mono mt-1">
                      10% fee on all bonding curve trading volume
                      {tokenStats.stats.walletAddress && (
                        <span className="ml-2 text-zinc-700">Wallet: {tokenStats.stats.walletAddress.slice(0, 6)}...{tokenStats.stats.walletAddress.slice(-4)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setClaimingFees(true);
                      try {
                        const res = await fetch('/api/admin/token-stats', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'claim-fees', adminAddress: user?.wallet?.address }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          toast.success(data.message || 'Fee claim initiated');
                        } else {
                          toast.error(data.error || 'Claim failed');
                        }
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setClaimingFees(false);
                      }
                    }}
                    disabled={claimingFees}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-mono uppercase tracking-widest rounded transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {claimingFees ? <Loader2 size={14} className="animate-spin" /> : null}
                    Claim Fees
                  </button>
                </div>

                {/* Revenue Summary Cards */}
                <div className="grid grid-cols-3 divide-x divide-zinc-800 border-b border-zinc-800">
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      {tokenStats.revenue?.totalLifetimeFees?.toFixed(4) || '0'} SOL
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Total Lifetime Fees</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold font-mono text-amber-400">
                      {tokenStats.revenue?.totalClaimable?.toFixed(4) || '0'} SOL
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Claimable Now</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-bold font-mono text-violet-400">
                      {tokenStats.revenue?.claimablePositions || 0}
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase font-mono mt-1">Fee Positions</div>
                  </div>
                </div>

                {/* Per-Token Fee Breakdown */}
                {tokenStats.revenue?.perTokenFees?.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold mb-3">Per-Token Breakdown</h4>
                    <div className="space-y-1.5">
                      {tokenStats.revenue.perTokenFees.map((token: any) => (
                        <div key={token.mintAddress} className="flex items-center justify-between p-2 bg-black/20 rounded hover:bg-black/40 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-violet-400 text-xs font-mono font-bold w-16 shrink-0">${token.symbol}</span>
                            <span className="text-zinc-400 text-sm truncate">{token.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-sm font-mono font-bold ${token.lifetimeFees > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                              {token.lifetimeFees.toFixed(4)} SOL
                            </span>
                            <a
                              href={token.bagsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-600 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!tokenStats.revenue?.perTokenFees || tokenStats.revenue.perTokenFees.length === 0) && (
                  <div className="p-6 text-center text-zinc-600 text-sm font-mono">No token fee data available yet</div>
                )}
              </div>

              {/* Recent Launches */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-bold mb-4">Recent Launches</h3>
                {tokenStats.recentLaunches.length === 0 ? (
                  <div className="py-8 text-center text-zinc-600 text-sm font-mono">No agent tokens launched yet</div>
                ) : (
                  <div className="space-y-2">
                    {tokenStats.recentLaunches.map((launch: any) => (
                      <div key={launch.id} className="bg-black/30 border border-zinc-800 rounded p-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{launch.agentName}</span>
                            <span className="text-violet-400 text-xs font-mono">${launch.tokenSymbol}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${
                              launch.status === 'launched' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : launch.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>{launch.status}</span>
                          </div>
                          {launch.mintAddress && (
                            <code className="text-[10px] text-zinc-600 font-mono">{launch.mintAddress.slice(0, 12)}...{launch.mintAddress.slice(-8)}</code>
                          )}
                          {launch.error && (
                            <p className="text-[10px] text-red-400 font-mono mt-1">{launch.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-600 font-mono">
                            {new Date(launch.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {launch.bagsUrl && (
                            <a href={launch.bagsUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-600 text-sm font-mono">Failed to load token stats</div>
          )}
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

function DeliverableContent({ type, content }: { type: string; content: string }) {
  if (!content || content === '(No content provided)') {
    return <p className="text-sm text-zinc-600 italic">No content provided</p>;
  }

  // Clean escaped newlines that might come through even after server-side cleaning
  const cleaned = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

  switch (type) {
    case 'url':
      return (
        <a
          href={cleaned}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all text-sm"
        >
          <ExternalLink className="w-4 h-4 shrink-0" /> {cleaned}
        </a>
      );

    case 'code':
      return (
        <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
          <code className="text-sm text-emerald-400 font-mono whitespace-pre-wrap break-words">{cleaned}</code>
        </pre>
      );

    case 'token_launch':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">Mint:</span>
            <code className="text-sm text-emerald-400 bg-zinc-800 px-2 py-0.5 rounded font-mono break-all">{cleaned}</code>
          </div>
          <a
            href={`https://solscan.io/token/${cleaned}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 text-xs font-mono"
          >
            <ExternalLink className="w-3 h-3" /> View on Solscan
          </a>
        </div>
      );

    case 'image':
    case 'file':
      return (
        <a
          href={cleaned}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all text-sm"
        >
          <ExternalLink className="w-4 h-4 shrink-0" /> {cleaned}
        </a>
      );

    case 'text':
    default:
      return (
        <div className="text-zinc-300 text-sm font-light max-h-96 overflow-y-auto leading-relaxed prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-mono prose-headings:font-bold prose-p:text-zinc-300 prose-a:text-emerald-400 prose-strong:text-white prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-li:text-zinc-300">
          <ReactMarkdown>{cleaned}</ReactMarkdown>
        </div>
      );
  }
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

function SubmissionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Submitted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    Rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    Approved: "bg-green-500/10 text-green-500 border-green-500/20",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${styles[status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
      {status}
    </span>
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
