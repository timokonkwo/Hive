"use client";
import { LaunchDialog } from "../tokenization/LaunchDialog";
import AnalyticsPage from '../analytics/AnalyticsPage';
import { Select } from '@/components/redesign/Select';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAdminAccess } from '../AdminAccess';
import { AppShell } from '../AppShell';
import { Toaster } from 'sonner';
import { useHiveTheme } from '../theme';
import { AdminNavigation, adminSections, type AdminTab } from './navigation';
import { TasksPanel, AgentsPanel } from './Records';
import { ConfirmDialog } from './ConfirmDialog';
import { useSearchParams, useRouter } from 'next/navigation';
import common from '../marketplace/marketplace.module.css';
import styles from './admin.module.css';
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import ReactMarkdown from "react-markdown";
import {
  RefreshCw, Loader2, Shield, Users, FileText, CheckCircle,
  Clock, ChevronRight, AlertTriangle, Inbox,
  Search, Trash2, ChevronLeft, ChevronsLeft, ChevronsRight,
  X, Bug, Lightbulb,
  ChevronDown, ExternalLink, Download, Edit3, Check, Map, Plus, ArrowRight, Coins
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";


const AGENTS_PER_PAGE = 20;
const TASKS_PER_PAGE = 20;
const STAKERS_PER_PAGE = 20;

const ROADMAP_ICONS = [
  'Briefcase', 'Bot', 'CreditCard', 'Trophy', 'Code', 'Server',
  'Globe', 'Coins', 'Rocket', 'BarChart3', 'FileText', 'Megaphone',
  'Twitter', 'Layers', 'Users', 'Zap', 'Shield', 'Star',
  'RefreshCw', 'MessageSquare', 'Brain', 'Smartphone', 'Plug',
  'Vote', 'CheckCircle', 'Clock', 'Link2',
];
const SUBMISSIONS_PER_PAGE = 15;

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  incomplete: 'Incomplete',
  poor_quality: 'Poor Quality',
  off_topic: 'Off Topic',
  incorrect: 'Incorrect',
  formatting: 'Formatting',
  other: 'Other',
};

export function AdminPage(){
 const {state,retry}=useAdminAccess(),{ready,authenticated,login,user}=useAuth(),{theme}=useHiveTheme();
 return <div className={common.page} data-hive-app data-admin-root><a href="#admin-main" className={common.skipLink}>Skip to Admin</a><AppShell area="Admin" page="Management"><main id="admin-main" tabIndex={-1} className={styles.main} data-admin-state={state}>
 <header className={styles.heading}><div><span className={styles.eyebrow}><Shield size={15} aria-hidden="true"/>Administration</span><h1>Admin</h1></div><Link href="/marketplace" className={styles.back}>Open marketplace<ArrowRight size={16}/></Link></header>
 {state==='allowed'?<AdminWorkspace key={user?.id}/>:<section className={styles.gate} role={state==='error'?'alert':'status'}><Shield size={28} aria-hidden="true"/><h2>{!ready||state==='loading'?'Checking access…':!authenticated?'Sign in to Admin':state==='denied'?'Admin access required':'Access could not be verified'}</h2><p>{!ready||state==='loading'?'':!authenticated?'Use your admin account.':state==='denied'?'This account does not have admin access.':'Try again to check your session.'}</p>{ready&&!authenticated?<button onClick={login}>Sign in</button>:state==='error'?<button onClick={retry}>Try again</button>:state==='denied'?<Link href="/dashboard">Back to My tasks</Link>:null}</section>}
 </main></AppShell><Toaster theme={theme} toastOptions={{style:{background:'var(--surface)',color:'var(--ink)',border:'1px solid var(--rule)'}}}/></div>;
}
function AdminWorkspace() {
  const { user } = useAuth();
  const params=useSearchParams(),router=useRouter();
  const current=params.get('section');
  const activeTab:AdminTab=adminSections.find(s=>s.id===current)?.id||'overview';
  const setActiveTab=(tab:AdminTab)=>router.push('/admin'+(tab==='overview'?'':'?section='+tab),{scroll:false});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin=true;
  const [confirmation,setConfirmation]=useState<{title:string;description:string;run:()=>Promise<void>}|null>(null),[confirmBusy,setConfirmBusy]=useState(false);
  const [requestError,setRequestError]=useState(''),[refreshVersion,setRefreshVersion]=useState(0);

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
  const [deleteType, setDeleteType] = useState<'agent' | 'task' | 'submission'>('agent');
  const [changingTaskStatus, setChangingTaskStatus] = useState<string | null>(null);

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
  const [claimingFees, setClaimingFees] = useState(false);
  const feeClaimBusy = useRef(false);
  const [feeClaimResult, setFeeClaimResult] = useState<{ message: string; transactions: Array<{ signature: string; confirmed: boolean }>; errors: string[] } | null>(null);
  const [tokenLaunchModal, setTokenLaunchModal] = useState<{ id: string; name: string } | null>(null);

  // Roadmap management state
  const [roadmapItems, setRoadmapItems] = useState<any[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapEditItem, setRoadmapEditItem] = useState<any>(null);
  const [roadmapForm, setRoadmapForm] = useState({ title: '', description: '', status: 'planned', date: '', tag: '', icon: '' });
  const [roadmapSaving, setRoadmapSaving] = useState(false);
  const [showRoadmapForm, setShowRoadmapForm] = useState(false);
  const [roadmapCollapsed, setRoadmapCollapsed] = useState<Record<string, boolean>>({ completed: true });

  // Staker management state
  const [stakers, setStakers] = useState<any[]>([]);
  const [stakersStats, setStakersStats] = useState<any>(null);
  const [stakersTotal, setStakersTotal] = useState(0);
  const [stakersPage, setStakersPage] = useState(1);
  const [stakersSearch, setStakersSearch] = useState("");
  const [stakersStatusFilter, setStakersStatusFilter] = useState("all");
  const [stakersLoading, setStakersLoading] = useState(false);
  const [stakeReconcileForm, setStakeReconcileForm] = useState({
    txSignature: "",
    solanaAddress: "",
    amountHive: "",
    stakerType: "",
    stakerId: "",
  });
  const [reconcilingStake, setReconcilingStake] = useState(false);

  // DAO management state
  const [daoData, setDaoData] = useState<any>(null);
  const [daoLoading, setDaoLoading] = useState(false);
  const [daoActionId, setDaoActionId] = useState<string | null>(null);
  const [daoReportStatus, setDaoReportStatus] = useState("all");
  const [daoDisputeStatus, setDaoDisputeStatus] = useState("active");

  const address = user?.wallet?.address;

  const baseRequest = useAuthFetch();
  const authFetch=useCallback(async(url:string,options:RequestInit={})=>{
    void refreshVersion;
    try{const res=await baseRequest(url,options);if(!res.ok){setRequestError(res.status===401?'Your session expired. Sign in again to continue.':res.status===403?'Admin access is no longer available for this account.':'The request failed. Try again.');}return res;}
    catch(error){setRequestError('The request could not be completed. Check your connection and try again.');throw error;}
  },[baseRequest,refreshVersion]);
  function refresh(){setRequestError('');setRefreshVersion(v=>v+1);}


  // Fetch overview data
  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/admin/stats?address=${user?.wallet?.address}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Admin fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, user?.wallet?.address, authFetch]);

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

      const res = await authFetch(`/api/admin/agents?${params.toString()}`);
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
  }, [isAdmin, address, agentsPage, agentsSort, agentsOrder, agentsSearch, agentsVerifiedFilter, authFetch]);

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

      const res = await authFetch(`/api/admin/tasks?${params.toString()}`);
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
  }, [isAdmin, address, tasksPage, tasksSort, tasksOrder, tasksSearch, tasksStatusFilter, authFetch]);

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
        const res = await authFetch(`/api/admin/tasks/${id}?address=${address}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* skip */ }
    }
    toast.success(`Deleted ${deleted} task${deleted !== 1 ? 's' : ''}.`);
    setSelectedTasks(new Set());
    setBulkDeleting(false);
    fetchTasks();
    // Refresh stats
    const statsRes = await authFetch(`/api/admin/stats?address=${address}`);
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
      const res = await authFetch(`/api/admin/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbackItems(data.feedback || []);
        setFeedbackTotal(data.total || 0);
      }
    } catch (err) { console.error("Feedback fetch error:", err); }
    finally { setFeedbackLoading(false); }
  }, [isAdmin, address, feedbackPage, feedbackTypeFilter, feedbackStatusFilter, authFetch]);

  useEffect(() => {
    if (activeTab === "feedback") fetchFeedback();
    if (activeTab === "tokens") {
      setTokenStatsLoading(true);
      authFetch(`/api/admin/token-stats?address=${user?.wallet?.address}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setTokenStats(data); })
        .catch(() => {})
        .finally(() => setTokenStatsLoading(false));
    }
    if (activeTab === "roadmap") {
      setRoadmapLoading(true);
      authFetch('/api/roadmap')
        .then(res => res.json())
        .then(data => { if (data.success) setRoadmapItems(data.items); })
        .catch(() => {})
        .finally(() => setRoadmapLoading(false));
    }
  }, [activeTab, fetchFeedback, authFetch]);

  useEffect(() => { setFeedbackPage(1); }, [feedbackTypeFilter, feedbackStatusFilter]);

  const fetchDaoData = useCallback(async () => {
    if (!isAdmin || !address) return;
    setDaoLoading(true);
    try {
      const params = new URLSearchParams({
        address,
        reportStatus: daoReportStatus,
        disputeStatus: daoDisputeStatus,
      });
      const res = await authFetch(`/api/admin/dao?${params.toString()}`);
      if (res.ok) {
        setDaoData(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to load DAO controls.");
      }
    } catch {
      toast.error("Failed to load DAO controls.");
    } finally {
      setDaoLoading(false);
    }
  }, [isAdmin, address, daoReportStatus, daoDisputeStatus, authFetch]);

  useEffect(() => {
    if (activeTab === "dao") fetchDaoData();
  }, [activeTab, fetchDaoData]);

  const runDaoAction = async (payload: Record<string, any>, label: string) => {
    if (!address) return;
    const targetId = payload.reportId || payload.disputeId || label;
    setDaoActionId(targetId);
    try {
      const res = await authFetch(`/api/admin/dao?address=${encodeURIComponent(address)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `${label} failed.`);
      }
      toast.success(label);
      fetchDaoData();
    } catch (error: any) {
      toast.error(error.message || `${label} failed.`);
    } finally {
      setDaoActionId(null);
    }
  };

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

      const res = await authFetch(`/api/admin/submissions?${params.toString()}`);
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
  }, [isAdmin, address, submissionsPage, submissionsSearch, submissionsStatusFilter, authFetch]);

  useEffect(() => {
    if (activeTab === "submissions") {
      const timeout = setTimeout(fetchSubmissions, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTab, fetchSubmissions]);

  useEffect(() => { setSubmissionsPage(1); }, [submissionsSearch, submissionsStatusFilter]);

  const fetchStakers = useCallback(async () => {
    if (!isAdmin || !address) return;
    setStakersLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(stakersPage),
        limit: String(STAKERS_PER_PAGE),
        address,
        status: stakersStatusFilter,
      });
      if (stakersSearch) params.set("search", stakersSearch);

      const res = await authFetch(`/api/admin/stakers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load stakers.");
      }
      setStakers(data.stakers || []);
      setStakersStats(data.stats || null);
      setStakersTotal(data.total || 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to load stakers.");
    } finally {
      setStakersLoading(false);
    }
  }, [isAdmin, address, stakersPage, stakersSearch, stakersStatusFilter, authFetch]);

  useEffect(() => {
    if (activeTab === "stakers") {
      const timeout = setTimeout(fetchStakers, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeTab, fetchStakers]);

  useEffect(() => { setStakersPage(1); }, [stakersSearch, stakersStatusFilter]);

  const handleReconcileStake = async () => {
    if (!stakeReconcileForm.txSignature.trim() || !stakeReconcileForm.solanaAddress.trim() || !stakeReconcileForm.amountHive.trim()) {
      toast.error("Transaction signature, wallet, and HIVE amount are required.");
      return;
    }

    setReconcilingStake(true);
    try {
      const body: Record<string, string> = {
        txSignature: stakeReconcileForm.txSignature.trim(),
        solanaAddress: stakeReconcileForm.solanaAddress.trim(),
        amountHive: stakeReconcileForm.amountHive.trim(),
      };
      if (stakeReconcileForm.stakerType) body.stakerType = stakeReconcileForm.stakerType;
      if (stakeReconcileForm.stakerId.trim()) body.stakerId = stakeReconcileForm.stakerId.trim();

      const res = await authFetch("/api/admin/stakers/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Stake reconciliation failed.");
      }
      toast.success(`Reconciled ${Number(data.stake?.addedAmount || 0).toLocaleString()} HIVE.`);
      setStakersSearch(stakeReconcileForm.solanaAddress.trim());
      setStakeReconcileForm({ txSignature: "", solanaAddress: "", amountHive: "", stakerType: "", stakerId: "" });
      fetchStakers();
    } catch (error: any) {
      toast.error(error.message || "Stake reconciliation failed.");
    } finally {
      setReconcilingStake(false);
    }
  };

  const updateFeedbackStatus = async (id: string, newStatus: string) => {
    if (!address) return;
    try {
      const res = await authFetch("/api/admin/feedback", {
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
        : deleteType === 'submission'
        ? `/api/admin/submissions/${deleteModal.id}?address=${address}`
        : `/api/admin/tasks/${deleteModal.id}?address=${address}`;
      
      const res = await authFetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        toast.success(`${deleteType === 'agent' ? 'Agent' : deleteType === 'submission' ? 'Submission' : 'Task'} "${deleteModal.name}" deleted.`);
        setDeleteModal(null);
        if (deleteType === 'agent') fetchAgents();
        if (deleteType === 'task') fetchTasks();
        if (deleteType === 'submission') fetchSubmissions();
        const statsRes = await authFetch(`/api/admin/stats?address=${address}`);
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

  const handleChangeTaskStatus = async (taskId: string, newStatus: string) => {
    if (!address) return;
    setChangingTaskStatus(taskId);
    try {
      const res = await authFetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Task status changed to ${newStatus}`);
        fetchTasks();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update status.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setChangingTaskStatus(null);
    }
  };

  const handleToggleVerified = async (agentId: string, currentlyVerified: boolean) => {
    if (!address) return;
    try {
      const res = await authFetch(`/api/admin/agents/${agentId}`, {
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
      const res = await authFetch(`/api/admin/agents/${agentId}`, {
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

  const stakersTotalPages = Math.ceil(stakersTotal / STAKERS_PER_PAGE);

  const stats = data?.stats || {};
  return (<div className={styles.workbench}><AdminNavigation active={activeTab} onChange={setActiveTab}/><div className={styles.content}>
    <div className={styles.sectionHeading}><h2>{adminSections.find(s=>s.id===activeTab)?.label}</h2><button onClick={refresh} aria-label="Refresh admin data"><RefreshCw size={17}/></button></div>
    {requestError&&<div role="alert" className={styles.error}><p>{requestError}</p><button onClick={refresh}>Try again</button></div>}
    {activeTab==='overview'&&<>{loading?<p role="status" className={styles.loading}>Loading overview…</p>:data?<dl className={styles.metrics}>{[['Tasks',stats.totalTasks],['Open',stats.openTasks],['In progress',stats.inProgressTasks],['Completed',stats.completedTasks],['Agents',stats.totalAgents],['Proposals',stats.totalBids]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==='number'?value.toLocaleString():'—'}</dd></div>)}</dl>:null}</>}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-6">
            <h3 className="text-sm font-semibold    text-[var(--muted)] mb-4">Recent Tasks</h3>
            <div className="space-y-3">
              {data?.recentTasks?.slice(0, 8).map((task: any) => (
                <Link key={task.id} href={`/marketplace/${task.id}`} className="block">
                  <div className="flex items-center justify-between p-3 bg-[var(--paper)] rounded hover:bg-[var(--paper)] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--ink)] font-medium truncate group-hover:text-[var(--accent-text)] transition-colors">{task.title}</div>
                      <div className="text-xs text-[var(--muted)] ">{task.category} • {task.status} • {task.proposalsCount || 0} proposals</div>
                    </div>
                    <ChevronRight size={14} className="text-[var(--muted)] shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-6">
            <h3 className="text-sm font-semibold    text-[var(--muted)] mb-4">Registered Agents</h3>
            <div className="space-y-3">
              {data?.recentAgents?.slice(0, 8).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 bg-[var(--paper)] rounded">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] text-xs font-semibold">
                    {(agent.name || "AG").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--ink)] font-medium truncate">{agent.name || "Unnamed"}</div>
                    <div className="text-xs text-[var(--muted)] ">{agent.walletAddress?.slice(0, 10)}... • Rep: {agent.reputation || 0}</div>
                  </div>
                </div>
              ))}
              {(!data?.recentAgents || data.recentAgents.length === 0) && (
                <div className="text-[var(--muted)] text-sm text-center py-4">No agents registered yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab==='tasks'&&<TasksPanel tasks={tasks} total={tasksTotal} loading={tasksLoading} search={tasksSearch} onSearch={setTasksSearch} status={tasksStatusFilter} onStatus={setTasksStatusFilter} page={tasksPage} onPage={setTasksPage} sort={tasksSort} order={tasksOrder} onSort={toggleTasksSort} selected={selectedTasks} onSelect={toggleTaskSelection} onSelectAll={toggleSelectAllTasks} onBulkDelete={()=>setConfirmation({title:`Delete ${selectedTasks.size} tasks?`,description:tasks.filter(t=>selectedTasks.has(t.id)).map(t=>t.title).join(', ')+'. This permanently removes these tasks and associated records.',run:handleBulkDelete})} bulkDeleting={bulkDeleting} changing={changingTaskStatus} onChangeStatus={handleChangeTaskStatus} onDelete={task=>{setDeleteType('task');setDeleteModal({id:task.id,name:task.title});}}/>}

      {activeTab==='agents'&&<AgentsPanel agents={agents} total={agentsTotal} loading={agentsLoading} search={agentsSearch} onSearch={setAgentsSearch} verified={agentsVerifiedFilter} onVerified={setAgentsVerifiedFilter} page={agentsPage} onPage={setAgentsPage} sort={agentsSort} order={agentsOrder} onSort={toggleSort} editing={editingRepAgent} value={repInputValue} onValue={setRepInputValue} onEdit={agent=>{setEditingRepAgent(agent?.id||null);setRepInputValue(String(agent?.reputation||0));}} onSave={handleSetReputation} onToggle={handleToggleVerified} onLaunch={agent=>setTokenLaunchModal({id:agent.id,name:agent.name})} onDelete={agent=>{setDeleteType('agent');setDeleteModal({id:agent.id,name:agent.name});}}/>}

      {/* ── Stakers Tab ── */}
      {activeTab === "stakers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Stakers" value={stakersStats?.totalStakers || 0} icon={<Users size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Active" value={stakersStats?.activeStakers || 0} icon={<CheckCircle size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Active HIVE" value={stakersStats?.totalActiveAmount || 0} icon={<Coins size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Locked HIVE" value={stakersStats?.totalLockedAmount || 0} icon={<Shield size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Slashed HIVE" value={stakersStats?.totalSlashedAmount || 0} icon={<AlertTriangle size={16} />} color="text-[var(--danger)]" />
          </div>

          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                <AdminField
                  label="Transaction"
                  value={stakeReconcileForm.txSignature}
                  onChange={(value) => setStakeReconcileForm((prev) => ({ ...prev, txSignature: value }))}
                  placeholder="Solana signature"
                />
                <AdminField
                  label="Wallet"
                  value={stakeReconcileForm.solanaAddress}
                  onChange={(value) => setStakeReconcileForm((prev) => ({ ...prev, solanaAddress: value }))}
                  placeholder="Staker Solana wallet"
                />
                <AdminField
                  label="Amount"
                  value={stakeReconcileForm.amountHive}
                  onChange={(value) => setStakeReconcileForm((prev) => ({ ...prev, amountHive: value }))}
                  placeholder="10000000"
                />
              </div>
              <button
                onClick={handleReconcileStake}
                disabled={reconcilingStake}
                className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--accent-ink)] text-[var(--accent-ink)] px-4 py-2.5 rounded-lg font-semibold text-xs   disabled:opacity-50"
              >
                {reconcilingStake ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Reconcile
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Select
                value={stakeReconcileForm.stakerType}
                onChange={(e) => setStakeReconcileForm((prev) => ({ ...prev, stakerType: e.target.value }))}
                className="bg-[var(--paper)] border border-[var(--rule)] rounded-lg px-3 py-2.5 text-xs text-[var(--muted)]  focus:border-[var(--rule)] "
              >
                <option value="">Auto-detect verified profile</option>
                <option value="client">Client</option>
                <option value="agent">Agent</option>
              </Select>
              <input
                value={stakeReconcileForm.stakerId}
                onChange={(e) => setStakeReconcileForm((prev) => ({ ...prev, stakerId: e.target.value }))}
                placeholder="Optional staker id for conflict resolution"
                className="bg-[var(--paper)] border border-[var(--rule)] rounded-lg px-3 py-2.5 text-xs text-[var(--muted)] placeholder-zinc-600  focus:border-[var(--rule)] "
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input aria-label="Stakers search"
                type="text"
                value={stakersSearch}
                onChange={(e) => setStakersSearch(e.target.value)}
                placeholder="Search by wallet, staker id, type, or status..."
                className="w-full bg-[var(--surface)] border border-[var(--rule)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--ink)] placeholder-zinc-600  focus:border-[var(--rule)] transition-colors "
              />
              {stakersSearch && (
                <button onClick={() => setStakersSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {["all", "active", "locked", "slashed", "none"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStakersStatusFilter(status)}
                  className={`px-3 py-2 text-xs    border rounded-lg transition-colors shrink-0 ${
                    stakersStatusFilter === status
                      ? "border-[var(--rule)] text-[var(--accent-text)] bg-[var(--soft)]"
                      : "border-[var(--rule)] text-[var(--muted)] hover:border-[var(--rule)]"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg overflow-hidden overflow-x-auto">
            <div className="hidden md:grid grid-cols-[1.1fr_90px_120px_120px_120px_100px_130px_90px] gap-4 px-4 py-3 bg-[var(--paper)] border-b border-[var(--rule)] text-xs    text-[var(--muted)] min-w-[980px]">
              <span>Staker</span>
              <span>Type</span>
              <span>Active</span>
              <span>Locked</span>
              <span>Slashed</span>
              <span>Tier</span>
              <span>Updated</span>
              <span>Last Tx</span>
            </div>

            {stakersLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--accent-text)] animate-spin" />
              </div>
            ) : stakers.length === 0 ? (
              <div className="py-12 text-center text-[var(--muted)] text-sm ">No stakers found</div>
            ) : (
              stakers.map((staker) => (
                <div key={staker.id} className="grid grid-cols-[1.1fr_90px_120px_120px_120px_100px_130px_90px] gap-4 px-4 py-3 border-b border-[var(--rule)] hover:bg-white/[0.02] transition-colors items-center text-sm min-w-[980px]">
                  <div className="min-w-0">
                    <div className="text-[var(--ink)] font-medium truncate">{staker.displayName || staker.solanaAddress || staker.stakerId}</div>
                    <div className="text-xs text-[var(--muted)]  truncate">
                      {staker.solanaAddress ? `${staker.solanaAddress.slice(0, 8)}...${staker.solanaAddress.slice(-6)}` : staker.stakerId}
                    </div>
                  </div>
                  <span className="text-xs   text-[var(--muted)]">{staker.stakerType}</span>
                  <span className="text-xs  text-[var(--accent-text)]">{(staker.activeAmount || 0).toLocaleString()} HIVE</span>
                  <span className="text-xs  text-[var(--accent-text)]">{(staker.lockedAmount || 0).toLocaleString()} HIVE</span>
                  <span className="text-xs  text-[var(--danger)]">{(staker.slashedAmount || 0).toLocaleString()} HIVE</span>
                  <span className="text-xs   text-[var(--muted)]">{staker.tierLabel}</span>
                  <span className="text-xs text-[var(--muted)] ">
                    {staker.updatedAt ? new Date(staker.updatedAt).toLocaleString() : "—"}
                  </span>
                  <div>
                    {staker.lastStakeEvent?.txSignature ? (
                      <a
                        href={`https://solscan.io/tx/${staker.lastStakeEvent.txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs  text-[var(--accent-text)] hover:text-[var(--accent-text)]"
                      >
                        <ExternalLink size={10} /> View
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--muted)] ">—</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {stakersTotalPages > 1 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                <PaginationBtn onClick={() => setStakersPage(1)} disabled={stakersPage === 1}>
                  <ChevronsLeft size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setStakersPage(p => p - 1)} disabled={stakersPage === 1}>
                  <ChevronLeft size={14} />
                </PaginationBtn>
                <span className="px-4 py-2 text-xs  text-[var(--muted)]">
                  Page {stakersPage} of {stakersTotalPages}
                </span>
                <PaginationBtn onClick={() => setStakersPage(p => p + 1)} disabled={stakersPage === stakersTotalPages}>
                  <ChevronRight size={14} />
                </PaginationBtn>
                <PaginationBtn onClick={() => setStakersPage(stakersTotalPages)} disabled={stakersPage === stakersTotalPages}>
                  <ChevronsRight size={14} />
                </PaginationBtn>
              </div>
              <p className="text-xs    text-[var(--muted)]">
                Showing {(stakersPage - 1) * STAKERS_PER_PAGE + 1}–{Math.min(stakersPage * STAKERS_PER_PAGE, stakersTotal)} of {stakersTotal} stakers
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── DAO Tab ── */}
      {activeTab === "dao" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Submitted" value={daoData?.stats?.submittedReports || 0} icon={<Inbox size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Needs Evidence" value={daoData?.stats?.needsEvidenceReports || 0} icon={<FileText size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Escalated" value={daoData?.stats?.escalatedReports || 0} icon={<AlertTriangle size={16} />} color="text-[var(--danger)]" />
            <StatCard label="Active Votes" value={daoData?.stats?.activeDisputes || 0} icon={<Clock size={16} />} color="text-[var(--accent-text)]" />
            <StatCard label="Queued" value={daoData?.stats?.queuedDisputes || 0} icon={<CheckCircle size={16} />} color="text-[var(--accent-text)]" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold   tracking-wide">DAO Review Queue</h2>
              <p className="text-[var(--muted)] text-xs  mt-1">Triage reports before they become slashable governance votes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Dao report status"
                value={daoReportStatus}
                onChange={(e) => setDaoReportStatus(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink)] text-xs  px-3 py-2 rounded "
              >
                <option value="all">All Reports</option>
                <option value="submitted">Submitted</option>
                <option value="needs_evidence">Needs Evidence</option>
                <option value="rejected">Rejected</option>
                <option value="escalated">Escalated</option>
              </Select>
              <Select aria-label="Dao dispute status"
                value={daoDisputeStatus}
                onChange={(e) => setDaoDisputeStatus(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink)] text-xs  px-3 py-2 rounded "
              >
                <option value="active">Active Disputes</option>
                <option value="queued">Queued</option>
                <option value="dismissed">Dismissed</option>
                <option value="slashed">Slashed</option>
                <option value="all">All Disputes</option>
              </Select>
              <button
                onClick={fetchDaoData}
                disabled={daoLoading}
                className="px-4 py-2 bg-[var(--soft)] hover:bg-[var(--soft)] text-[var(--muted)] rounded text-xs  transition-colors disabled:opacity-50"
              >
                {daoLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {daoLoading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-[var(--accent-text)] animate-spin mx-auto" /></div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <section className="space-y-3">
                <h3 className="text-xs    text-[var(--muted)] font-semibold">Reports</h3>
                {(daoData?.reports || []).length === 0 ? (
                  <div className="py-10 text-center text-[var(--muted)] border border-dashed border-[var(--rule)] rounded-lg  text-sm">No reports match this filter</div>
                ) : (
                  (daoData?.reports || []).map((report: any) => (
                    <div key={report.id} className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-lg space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[var(--ink)]">Tool: {report.toolId}</span>
                            <span className="text-xs   border border-[var(--rule)] rounded px-2 py-0.5 text-[var(--muted)]">{report.status}</span>
                            <span className="text-xs   border border-[var(--rule)] rounded px-2 py-0.5 text-[var(--muted)]">{report.category}</span>
                          </div>
                          <p className="text-xs  text-[var(--muted)] truncate mt-1">Provider: {report.providerAddress}</p>
                          <p className="text-xs text-[var(--muted)] mt-2 line-clamp-3">{report.reason}</p>
                        </div>
                        <div className="text-right text-xs  text-[var(--muted)] shrink-0">
                          <div>{(report.providerStake || 0).toLocaleString()} HIVE</div>
                          <div>{report.affectedParty ? "Affected" : report.watchdogEligible ? "Watchdog" : "Reporter"}</div>
                        </div>
                      </div>
                      {report.triageReason && (
                        <div className="text-xs text-[var(--accent-text)] bg-[var(--soft)] border border-[var(--rule)] rounded p-2">{report.triageReason}</div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={report.evidenceUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline ">
                          <ExternalLink size={10} /> Evidence
                        </a>
                        {report.status !== "escalated" && report.status !== "rejected" && (
                          <>
                            <button
                              onClick={() => runDaoAction({ action: "escalate_report", reportId: report.id }, "Report escalated")}
                              disabled={daoActionId === report.id}
                              className="px-3 py-1.5 bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded text-xs   disabled:opacity-50"
                            >
                              Escalate
                            </button>
                            <button
                              onClick={() => runDaoAction({ action: "request_evidence", reportId: report.id, reason: "More evidence required before DAO escalation." }, "Evidence requested")}
                              disabled={daoActionId === report.id}
                              className="px-3 py-1.5 bg-[var(--soft)] border border-[var(--rule)] text-[var(--accent-text)] hover:bg-[var(--soft)] rounded text-xs   disabled:opacity-50"
                            >
                              Request Evidence
                            </button>
                            <button
                              onClick={() => runDaoAction({ action: "reject_report", reportId: report.id, reason: "Rejected during admin triage." }, "Report rejected")}
                              disabled={daoActionId === report.id}
                              className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)] rounded text-xs   disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs    text-[var(--muted)] font-semibold">Formal Disputes</h3>
                {(daoData?.disputes || []).length === 0 ? (
                  <div className="py-10 text-center text-[var(--muted)] border border-dashed border-[var(--rule)] rounded-lg  text-sm">No disputes match this filter</div>
                ) : (
                  (daoData?.disputes || []).map((dispute: any) => {
                    const totalWeight = (dispute.votesForSlash || 0) + (dispute.votesAgainstSlash || 0);
                    const slashPct = totalWeight > 0 ? ((dispute.votesForSlash || 0) / totalWeight) * 100 : 0;
                    return (
                      <div key={dispute.id} className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-lg space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[var(--ink)]">Tool: {dispute.toolId}</span>
                              <span className="text-xs   border border-[var(--rule)] rounded px-2 py-0.5 text-[var(--muted)]">{dispute.phase || dispute.status}</span>
                            </div>
                            <p className="text-xs  text-[var(--muted)] truncate mt-1">Provider: {dispute.providerAddress}</p>
                            <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">{dispute.reason}</p>
                          </div>
                          <div className="text-right text-xs  text-[var(--muted)] shrink-0">
                            <div>{(dispute.stakedAmount || 0).toLocaleString()} HIVE at risk</div>
                            <div>{totalWeight.toLocaleString()} / {(dispute.quorumRequired || 0).toLocaleString()} quorum</div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs  text-[var(--muted)] mb-1">
                            <span>Slash share</span>
                            <span>{slashPct.toFixed(1)}% / {((dispute.slashThresholdBps || 6000) / 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-[var(--surface)] rounded overflow-hidden">
                            <div className="h-full bg-[var(--danger)] text-white" style={{ width: `${Math.min(100, slashPct)}%` }} />
                          </div>
                        </div>
                        {dispute.status === "active" && (
                          <div className="flex flex-wrap items-center gap-2">
                            {dispute.phase === "evidence" && (
                              <button
                                onClick={() => runDaoAction({ action: "start_voting", disputeId: dispute.id }, "Voting started")}
                                disabled={daoActionId === dispute.id}
                                className="px-3 py-1.5 bg-[var(--soft)] border border-[var(--rule)] text-[var(--accent-text)] hover:bg-[var(--soft)] rounded text-xs   disabled:opacity-50"
                              >
                                Start Voting
                              </button>
                            )}
                            <button
                              onClick={() => runDaoAction({ action: "extend_dispute", disputeId: dispute.id, hours: 24 }, "Dispute extended")}
                              disabled={daoActionId === dispute.id}
                              className="px-3 py-1.5 bg-[var(--soft)] border border-[var(--rule)] text-[var(--accent-text)] hover:bg-[var(--soft)] rounded text-xs   disabled:opacity-50"
                            >
                              Extend 24h
                            </button>
                            <button
                              onClick={() => runDaoAction({ action: "dismiss_dispute", disputeId: dispute.id, reason: "Dismissed during admin safety review." }, "Dispute dismissed")}
                              disabled={daoActionId === dispute.id}
                              className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)] rounded text-xs   disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && (
        <div className="space-y-3">
          {data?.recentActivity?.map((item: any) => (
            <div key={item.id} className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-lg flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                item.type === "TaskCreated" ? "bg-[var(--soft)] text-[var(--accent-text)]" :
                item.type === "BidSubmitted" ? "bg-[var(--soft)] text-[var(--accent-text)]" :
                (item.type === "ProposalAccepted" || item.type === "BidAccepted") ? "bg-[var(--soft)] text-[var(--accent-text)]" :
                item.type === "AgentDeleted" ? "bg-[var(--danger-soft)] text-[var(--danger)]" :
                "bg-[var(--surface)] text-[var(--muted)]"
              }`}>
                {item.type === "TaskCreated" ? "T" : item.type === "BidSubmitted" ? "B" : (item.type === "ProposalAccepted" || item.type === "BidAccepted") ? "✓" : item.type === "AgentDeleted" ? "×" : "?"}
              </div>
              <div className="flex-1">
                <div className="text-sm text-[var(--ink)]">{(item.type === "BidAccepted" ? "Proposal Accepted" : item.type).replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-xs text-[var(--muted)] ">
                  {(item.type === "BidAccepted" || item.type === "ProposalAccepted") ? (item.metadata?.agentName || item.actorName || '') : (item.actorName || item.actorAddress?.slice(0, 10))} • {item.metadata?.taskTitle || item.metadata?.agentName || ""} • {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recentActivity || data.recentActivity.length === 0) && (
            <div className="py-12 text-center text-[var(--muted)] border border-dashed border-[var(--rule)] rounded-lg">No activity yet</div>
          )}
        </div>
      )}

      {/* ── Feedback Tab ── */}
      {activeTab === "feedback" && (
        <div>
          <div className={styles.feedbackFilters}>
            <Select aria-label="Feedback type filter"
              value={feedbackTypeFilter}
              onChange={(e) => setFeedbackTypeFilter(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink)] text-xs  px-3 py-2 rounded-sm "
            >
              <option value="all">All Types</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Requests</option>
            </Select>
            <Select aria-label="Feedback status filter"
              value={feedbackStatusFilter}
              onChange={(e) => setFeedbackStatusFilter(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink)] text-xs  px-3 py-2 rounded-sm "
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </Select>
            <span className={styles.feedbackCount}>{feedbackTotal} total</span>
          </div>

          {feedbackLoading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-[var(--accent-text)] animate-spin mx-auto" /></div>
          ) : feedbackItems.length === 0 ? (
            <div className="py-12 text-center text-[var(--muted)] border border-dashed border-[var(--rule)] rounded-lg  text-sm">No feedback yet</div>
          ) : (
            <div className="space-y-3">
              {feedbackItems.map((item: any) => (
                <div key={item.id} className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-lg">
                  <div className={styles.feedbackRow}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === "bug" ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-[var(--soft)] text-[var(--accent-text)]"
                    }`}>
                      {item.type === "bug" ? <Bug size={14} /> : <Lightbulb size={14} />}
                    </div>
                    <div className={styles.feedbackBody}>
                      <div className={styles.feedbackTitle}>
                        <span className="text-sm font-semibold text-[var(--ink)]">{item.title}</span>
                        <span className={`text-xs   px-1.5 py-0.5 rounded border ${
                          item.status === "open" ? "bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]" :
                          item.status === "reviewed" ? "bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]" :
                          item.status === "resolved" ? "bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]" :
                          "bg-[var(--surface)] text-[var(--muted)] border-[var(--rule)]"
                        }`}>{item.status}</span>
                      </div>
                      <p className={styles.feedbackDescription}>{item.description}</p>
                      <div className={styles.feedbackMeta}>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        {item.contactInfo && <span>Contact: {item.contactInfo}</span>}
                      </div>
                    </div>
                    <div className={styles.feedbackStatus}><Select
                      aria-label={`Status for ${item.title}`}
                      value={item.status}
                      onChange={(e) => updateFeedbackStatus(item.id, e.target.value)}
                      className="bg-[var(--surface)] border border-[var(--rule)] text-[var(--muted)] text-xs  px-2 py-1 rounded-sm  shrink-0"
                    >
                      <option value="open">Open</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </Select></div>
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
              <span className="text-xs  text-[var(--muted)]">Page {feedbackPage} of {Math.ceil(feedbackTotal / 20)}</span>
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
              <div className="bg-[var(--surface)] border border-[var(--rule)] p-3 rounded-lg text-center">
                <div className="text-xl font-semibold  text-[var(--ink)]">{submissionsStats.totalSubmissions}</div>
                <div className="text-xs text-[var(--muted)]  ">Total</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--rule)] p-3 rounded-lg text-center">
                <div className="text-xl font-semibold  text-[var(--accent-text)]">{submissionsStats.submittedCount}</div>
                <div className="text-xs text-[var(--muted)]  ">Awaiting Review</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--rule)] p-3 rounded-lg text-center">
                <div className="text-xl font-semibold  text-[var(--accent-text)]">{submissionsStats.approvedCount}</div>
                <div className="text-xs text-[var(--muted)]  ">Approved</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--rule)] p-3 rounded-lg text-center">
                <div className="text-xl font-semibold  text-[var(--danger)]">{submissionsStats.rejectedCount}</div>
                <div className="text-xs text-[var(--muted)]  ">Rejected</div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--rule)] p-3 rounded-lg text-center">
                <div className="text-xl font-semibold  text-[var(--accent-text)]">{submissionsStats.rejectionRate}%</div>
                <div className="text-xs text-[var(--muted)]  ">Rejection Rate</div>
              </div>
            </div>
          )}

          {/* Rejection Insights */}
          {submissionsStats?.rejectionsByCategory && Object.keys(submissionsStats.rejectionsByCategory).length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-4 mb-6">
              <h4 className="text-xs font-semibold    text-[var(--muted)] mb-3">Rejection Reasons Breakdown</h4>
              <div className="space-y-2">
                {(() => {
                  const cats = submissionsStats.rejectionsByCategory;
                  const total = Object.values(cats).reduce((s: number, c: any) => s + c, 0) as number;
                  return Object.entries(cats)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([cat, count]: [string, any]) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs  text-[var(--muted)] w-24 shrink-0">{REJECTION_CATEGORY_LABELS[cat] || cat}</span>
                        <div className="flex-1 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--danger-soft)] rounded-full transition-all"
                            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs  text-[var(--muted)] w-12 text-right">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input aria-label="Submissions search"
                type="text"
                value={submissionsSearch}
                onChange={(e) => setSubmissionsSearch(e.target.value)}
                placeholder="Search by agent or summary..."
                className="w-full bg-[var(--surface)] border border-[var(--rule)] rounded pl-9 pr-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)] transition-colors"
              />
              {submissionsSearch && (
                <button onClick={() => setSubmissionsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {["all", "Submitted", "Rejected", "Approved"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSubmissionsStatusFilter(s)}
                  className={`px-3 py-2 text-xs    border rounded transition-colors ${
                    submissionsStatusFilter === s
                      ? "border-[var(--rule)] text-[var(--accent-text)] bg-[var(--soft)]"
                      : "border-[var(--rule)] text-[var(--muted)] hover:text-[var(--muted)]"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Submissions Table */}
          {submissionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--muted)]" /></div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-[var(--muted)] border border-dashed border-[var(--rule)] rounded-lg  text-sm">No submissions found</div>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub: any) => (
                <div key={sub.id} className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-[var(--surface)] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/agent/${encodeURIComponent(sub.agentName)}`} onClick={(e) => e.stopPropagation()} className="text-sm  text-[var(--accent-text)] hover:underline">{sub.agentName}</Link>
                        <span className="text-[var(--muted)]">→</span>
                        <Link href={`/marketplace/${sub.taskId}`} onClick={(e) => e.stopPropagation()} className="text-sm text-[var(--ink)] hover:text-[var(--accent-text)] truncate transition-colors">{sub.taskTitle}</Link>
                      </div>
                      <div className="text-xs text-[var(--muted)] ">
                        {sub.deliverableCount} deliverable{sub.deliverableCount !== 1 ? 's' : ''} • {new Date(sub.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sub.rejectionCategory && (
                        <span className="px-2 py-0.5 rounded text-xs  font-semibold  bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]">
                          {REJECTION_CATEGORY_LABELS[sub.rejectionCategory] || sub.rejectionCategory}
                        </span>
                      )}
                      <SubmissionStatusBadge status={sub.status} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteType('submission'); setDeleteModal({ id: sub.id, name: `${sub.agentName}'s submission on "${sub.taskTitle}"` }); }}
                        className="p-1 text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded transition-colors"
                        title="Delete submission" aria-label="Delete submission"
                      >
                        <Trash2 size={12} />
                      </button>
                      <ChevronDown size={14} className={`text-[var(--muted)] transition-transform ${expandedSubmission === sub.id ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expandedSubmission === sub.id && (
                    <div className="border-t border-[var(--rule)] p-4 space-y-3">
                      <div>
                        <div className="text-xs font-semibold    text-[var(--muted)] mb-1">Summary</div>
                        <p className="text-sm text-[var(--muted)] leading-relaxed">{sub.summary}</p>
                      </div>
                      {sub.deliverables?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold    text-[var(--muted)] mb-2">Deliverables ({sub.deliverableCount})</div>
                          <div className="space-y-3">
                            {sub.deliverables.map((d: any, i: number) => (
                              <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-lg">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs    text-[var(--accent-text)] bg-[var(--soft)] px-2 py-0.5 rounded">{d.type}</span>
                                    <span className="text-xs  text-[var(--muted)]">{d.label}</span>
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
                                      className="flex items-center gap-1 text-xs  text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors px-2 py-1 border border-[var(--rule)] hover:border-[var(--rule)] rounded"
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
                        <div className="bg-[var(--danger-soft)] border border-[var(--danger)] rounded p-3">
                          <div className="text-xs font-semibold    text-[var(--danger)] mb-1">Rejection Details</div>
                          <p className="text-sm text-[var(--danger)]">{sub.rejectionReason}</p>
                        </div>
                      )}
                      {sub.reportUri && (
                        <div>
                          <a href={sub.reportUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline ">
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
              <span className="text-xs  text-[var(--muted)]">Page {submissionsPage} of {Math.ceil(submissionsTotal / SUBMISSIONS_PER_PAGE)}</span>
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
      {tokenLaunchModal && <LaunchDialog agentId={tokenLaunchModal.id} role="admin" request={authFetch} close={() => { setTokenLaunchModal(null); void fetchAgents(); }} />}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <ConfirmDialog label="Delete record" onClose={()=>{if(!(deleting))setDeleteModal(null);}}>
          <div >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
                <Trash2 className="text-[var(--danger)]" size={20} />
              </div>
              <h3 className="text-lg font-semibold  ">Delete {deleteType === 'agent' ? 'Agent' : deleteType === 'submission' ? 'Submission' : 'Task'}</h3>
            </div>
            <p className="text-[var(--muted)] text-sm mb-2">
              Are you sure you want to delete <span className="text-[var(--ink)] font-semibold">{deleteModal.name}</span>?
            </p>
            <p className="text-[var(--muted)] text-xs mb-6 ">
              {deleteType === 'submission'
                ? 'This will delete the submission and revert the task to In Progress.'
                : `This will permanently remove the ${deleteType} and all associated data. This action cannot be undone.`}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 border border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--rule)] text-xs    rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-[var(--danger)] text-white hover:bg-[var(--danger)] text-white text-xs font-semibold    rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {/* ── Tokens Tab ── */}
      {activeTab === "tokens" && (
        <div>
          {tokenStatsLoading ? (
            <div className="py-20 text-center"><Loader2 className="w-6 h-6 text-[var(--accent-text)] animate-spin mx-auto" /></div>
          ) : tokenStats ? (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--surface)] border border-[var(--rule)] p-4 rounded-lg text-center">
                  <div className="text-2xl font-semibold  text-[var(--accent-text)]">{tokenStats.stats.totalLaunched}</div>
                  <div className="text-xs text-[var(--muted)]   mt-1">Tokens Launched</div>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--rule)] p-4 rounded-lg text-center">
                  <div className="text-2xl font-semibold  text-[var(--accent-text)]">{tokenStats.stats.totalQueued}</div>
                  <div className="text-xs text-[var(--muted)]   mt-1">Queued</div>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--rule)] p-4 rounded-lg text-center">
                  <div className="text-2xl font-semibold  text-[var(--danger)]">{tokenStats.stats.totalFailed}</div>
                  <div className="text-xs text-[var(--muted)]   mt-1">Failed</div>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--rule)] p-4 rounded-lg text-center">
                  <div className="text-2xl font-semibold  text-[var(--accent-text)]">
                    {tokenStats.stats.walletBalance !== null ? `${tokenStats.stats.walletBalance} SOL` : 'N/A'}
                  </div>
                  <div className="text-xs text-[var(--muted)]   mt-1">Wallet Balance</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-[var(--muted)]">
                <span>Solana: {tokenStats.stats.byChain?.solana ?? tokenStats.stats.totalLaunched}</span>
                <span>Robinhood: {tokenStats.stats.byChain?.robinhood ?? 0}</span>
                <span>This month: {tokenStats.stats.launchesThisMonth}</span>
                <span>Today: {tokenStats.stats.launchesToday}</span>
              </div>

              {/* Revenue Breakdown */}
              <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg overflow-hidden">
                <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs    text-[var(--accent-text)] font-semibold">Solana creator fees</h3>
                    <p className="text-xs text-[var(--muted)]  mt-1">
                      Fees earned by the Solana launch wallet.
                      {tokenStats.stats.walletAddress && (
                        <span className="ml-2 text-[var(--muted)]">Wallet: {tokenStats.stats.walletAddress.slice(0, 6)}...{tokenStats.stats.walletAddress.slice(-4)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (feeClaimBusy.current) return;
                      feeClaimBusy.current = true;
                      setClaimingFees(true);
                      setFeeClaimResult(null);
                      try {
                        const res = await authFetch('/api/admin/token-stats', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'claim-fees', adminAddress: user?.wallet?.address }),
                        });
                        const data = await res.json();
                        setFeeClaimResult({ message: data.message || data.error || 'Claim failed', transactions: data.transactions || [], errors: data.errors || [] });
                        if (res.ok) {
                          if (data.failed) toast.error(data.message);
                          else toast.success(data.message || 'Fees claimed');
                          // Refetch token stats to update revenue section
                          authFetch(`/api/admin/token-stats?address=${user?.wallet?.address}`)
                            .then(r => r.ok ? r.json() : null)
                            .then(d => { if (d) setTokenStats(d); })
                            .catch(() => {});
                        } else {
                          toast.error(data.error || 'Claim failed');
                        }
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        feeClaimBusy.current = false;
                        setClaimingFees(false);
                      }
                    }}
                    disabled={claimingFees}
                    className={styles.tokenPrimary}
                  >
                    {claimingFees ? <Loader2 size={14} className="animate-spin" /> : null}
                    Claim Fees
                  </button>
                </div>

                {feeClaimResult && <div role="status" className="p-4 text-sm space-y-2">
                  <p>{feeClaimResult.message}</p>
                  {feeClaimResult.transactions.map((tx, index) => <a key={tx.signature} className={styles.rowActions} href={`https://solscan.io/tx/${encodeURIComponent(tx.signature)}`} target="_blank" rel="noopener noreferrer">{tx.confirmed ? 'Confirmed claim' : 'Check transaction'} {index + 1}<ExternalLink size={14}/></a>)}
                  {feeClaimResult.errors.map(error => <p key={error} className="text-[var(--danger)] break-words">{error}</p>)}
                </div>}
                {tokenStats.revenue?.error && <p role="alert" className="p-4 text-sm text-[var(--danger)]">{tokenStats.revenue.error}</p>}
                {/* Revenue Summary Cards */}
                <div className="grid grid-cols-3 divide-x divide-zinc-800 border-b border-[var(--rule)]">
                  <div className="p-4 text-center">
                    <div className="text-xl font-semibold  text-[var(--accent-text)]">
                      {tokenStats.revenue?.totalLifetimeFees?.toFixed(4) || '0'} SOL
                    </div>
                    <div className="text-xs text-[var(--muted)]   mt-1">Total Lifetime Fees</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-semibold  text-[var(--accent-text)]">
                      {tokenStats.revenue?.totalClaimable?.toFixed(4) || '0'} SOL
                    </div>
                    <div className="text-xs text-[var(--muted)]   mt-1">Claimable Now</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xl font-semibold  text-[var(--accent-text)]">
                      {tokenStats.revenue?.claimablePositions || 0}
                    </div>
                    <div className="text-xs text-[var(--muted)]   mt-1">Fee Positions</div>
                  </div>
                </div>

                {/* Per-Token Fee Breakdown */}
                {tokenStats.revenue?.perTokenFees?.length > 0 && (
                  <div className="p-4">
                    <h4 className="text-xs    text-[var(--muted)] font-semibold mb-3">Per-Token Breakdown</h4>
                    <div className="space-y-1.5">
                      {tokenStats.revenue.perTokenFees.map((token: any) => (
                        <div key={token.mintAddress} className="flex items-center justify-between p-2 bg-[var(--paper)] rounded hover:bg-[var(--paper)] transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[var(--accent-text)] text-xs  font-semibold w-16 shrink-0">${token.symbol}</span>
                            <span className="text-[var(--muted)] text-sm truncate">{token.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-sm  font-semibold ${token.lifetimeFees > 0 ? 'text-[var(--accent-text)]' : 'text-[var(--muted)]'}`}>
                              {token.lifetimeFees.toFixed(4)} SOL
                            </span>
                            <a
                              href={token.bagsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors "
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
                  <div className="p-6 text-center text-[var(--muted)] text-sm ">No token fee data available yet</div>
                )}
              </div>

              {/* Recent Launches */}
              <div>
                <h3 className="text-xs    text-[var(--muted)] font-semibold mb-4">Recent Launches</h3>
                {tokenStats.recentLaunches.length === 0 ? (
                  <div className="py-8 text-center text-[var(--muted)] text-sm ">No agent tokens launched yet</div>
                ) : (
                  <div className="space-y-2">
                    {tokenStats.recentLaunches.map((launch: any) => (
                      <div key={launch.id} className="bg-[var(--paper)] border border-[var(--rule)] rounded p-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--ink)] text-sm font-medium">{launch.agentName}</span>
                            <span className="text-[var(--accent-text)] text-xs ">${launch.tokenSymbol}</span>
                            <span className={`px-1.5 py-0.5 text-xs font-semibold  rounded border ${
                              launch.status === 'launched' ? 'bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]'
                              : launch.status === 'failed' ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]'
                              : 'bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]'
                            }`}>{launch.status} · {launch.chain || 'Solana'}</span>
                          </div>
                          {launch.mintAddress && (
                            <code className="text-xs text-[var(--muted)] ">{launch.mintAddress.slice(0, 12)}...{launch.mintAddress.slice(-8)}</code>
                          )}
                          {launch.error && (
                            <p className="text-xs text-[var(--danger)]  mt-1">{launch.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[var(--muted)] ">
                            {new Date(launch.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(launch.tradeUrl || launch.bagsUrl) && (
                            <a href={launch.tradeUrl || launch.bagsUrl} aria-label={`Trade ${launch.tokenSymbol || launch.agentName} on ${launch.chain === 'Robinhood' ? 'Pons' : 'Bags'}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors">
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
            <div className="py-12 text-center text-[var(--muted)] text-sm ">Failed to load token stats</div>
          )}
        </div>
      )}

      {/* ── Roadmap Tab ── */}
      {activeTab === "roadmap" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold    text-[var(--muted)] flex items-center gap-2">
              <Map size={14} /> Roadmap Management
            </h3>
            <button
              onClick={() => {
                setRoadmapEditItem(null);
                setRoadmapForm({ title: '', description: '', status: 'planned', date: '', tag: '', icon: '' });
                setShowRoadmapForm(true);
              }}
              className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent)] text-[var(--accent-ink)] font-semibold  text-xs   rounded-sm transition-colors flex items-center gap-2"
            >
              <Plus size={12} /> Add Item
            </button>
          </div>

          {/* Add/Edit Form */}
          {showRoadmapForm && (
            <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-6 mb-6">
              <h4 className="text-xs    text-[var(--muted)] font-semibold mb-4">
                {roadmapEditItem ? 'Edit Item' : 'New Roadmap Item'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  value={roadmapForm.title}
                  onChange={e => setRoadmapForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  className="bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)]"
                />
                <Select
                  value={roadmapForm.status}
                  onChange={e => setRoadmapForm(f => ({ ...f, status: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)]"
                >
                  <option value="completed">Completed</option>
                  <option value="in-progress">In Progress</option>
                  <option value="planned">Planned</option>
                </Select>
                <input
                  value={roadmapForm.date}
                  onChange={e => setRoadmapForm(f => ({ ...f, date: e.target.value }))}
                  placeholder="Date (e.g. Q2 2026)"
                  className="bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)]"
                />
                <input
                  value={roadmapForm.tag}
                  onChange={e => setRoadmapForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="Tag (optional, e.g. npm)"
                  className="bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)]"
                />
                <Select
                  value={roadmapForm.icon}
                  onChange={e => setRoadmapForm(f => ({ ...f, icon: e.target.value }))}
                  className="bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)]"
                >
                  <option value="">Select icon...</option>
                  {ROADMAP_ICONS.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </Select>
              </div>
              <textarea
                value={roadmapForm.description}
                onChange={e => setRoadmapForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                rows={3}
                className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded px-3 py-2 text-sm text-[var(--ink)]   focus:border-[var(--rule)] mb-4 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!roadmapForm.title || !roadmapForm.description) {
                      toast.error('Title and description are required');
                      return;
                    }
                    setRoadmapSaving(true);
                    try {
                      const method = roadmapEditItem ? 'PUT' : 'POST';
                      const body = roadmapEditItem
                        ? { id: roadmapEditItem.id, ...roadmapForm }
                        : roadmapForm;
                      const res = await authFetch('/api/roadmap', {
                        method,
                        headers: { 'Content-Type': 'application/json', 'x-wallet-address': address || '' },
                        body: JSON.stringify(body),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        toast.success(roadmapEditItem ? 'Item updated' : 'Item added');
                        setShowRoadmapForm(false);
                        setRoadmapEditItem(null);
                        // Refresh
                        const refreshRes = await authFetch('/api/roadmap');
                        const refreshData = await refreshRes.json();
                        if (refreshData.success) setRoadmapItems(refreshData.items);
                      } else {
                        toast.error(data.error || 'Failed to save');
                      }
                    } catch { toast.error('Failed to save'); }
                    finally { setRoadmapSaving(false); }
                  }}
                  disabled={roadmapSaving}
                  className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent)] text-[var(--accent-ink)] font-semibold  text-xs   rounded-sm transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {roadmapSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {roadmapEditItem ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowRoadmapForm(false); setRoadmapEditItem(null); }}
                  className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--surface)] text-[var(--muted)]  text-xs  rounded-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {roadmapLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--muted)]" size={20} /></div>
          ) : roadmapItems.length === 0 ? (
            <div className="text-center py-16">
              <Map size={32} className="mx-auto text-[var(--muted)] mb-4" />
              <p className="text-[var(--muted)]  text-sm">No roadmap items yet. Use the Add Item button above.</p>
            </div>
          ) : (
            <>
              {(['completed', 'in-progress', 'planned'] as const).map(status => {
                const statusItems = roadmapItems.filter(i => i.status === status);
                const statusConfig = {
                  completed: { label: 'Completed', color: 'text-[var(--accent-text)]', border: 'border-[var(--rule)]', bg: 'bg-[var(--soft)]' },
                  'in-progress': { label: 'In Progress', color: 'text-[var(--accent-text)]', border: 'border-[var(--rule)]', bg: 'bg-[var(--soft)]' },
                  planned: { label: 'Planned', color: 'text-[var(--accent-text)]', border: 'border-[var(--rule)]', bg: 'bg-[var(--soft)]' },
                }[status];
                return (
                  <div key={status} className="mb-8">
                    <button
                      onClick={() => setRoadmapCollapsed(prev => ({ ...prev, [status]: !prev[status] }))}
                      className="flex items-center gap-3 mb-3 w-full text-left group"
                    >
                      <ChevronRight size={14} className={`text-[var(--muted)] transition-transform ${roadmapCollapsed[status] ? '' : 'rotate-90'}`} />
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs    font-semibold ${statusConfig.bg} ${statusConfig.border} ${statusConfig.color} border`}>
                        {statusConfig.label}
                      </span>
                      <span className="text-xs  text-[var(--muted)]">{statusItems.length} items</span>
                    </button>
                    {roadmapCollapsed[status] ? null : statusItems.length === 0 ? (
                      <div className="py-4 text-center text-[var(--muted)] text-xs ">No items</div>
                    ) : (
                      <div className="space-y-2">
                        {statusItems.map(item => (
                          <div key={item.id} className="bg-[var(--paper)] border border-[var(--rule)] rounded p-3 flex items-center justify-between gap-3 group hover:border-[var(--rule)] transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[var(--ink)] text-sm font-medium">{item.title}</span>
                                {item.tag && <span className="text-xs  text-[var(--accent-text)] bg-[var(--soft)] px-1.5 py-0.5 rounded ">{item.tag}</span>}
                                {item.icon && <span className="text-xs  text-[var(--muted)]">{item.icon}</span>}
                              </div>
                              <p className="text-[var(--muted)] text-xs  mt-0.5 line-clamp-1">{item.description}</p>
                              {item.date && <span className="text-xs  text-[var(--muted)]">{item.date}</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0  transition-opacity">
                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setRoadmapEditItem(item);
                                  setRoadmapForm({
                                    title: item.title,
                                    description: item.description,
                                    status: item.status,
                                    date: item.date || '',
                                    tag: item.tag || '',
                                    icon: item.icon || '',
                                  });
                                  setShowRoadmapForm(true);
                                }}
                                className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors" title="Edit" aria-label="Edit"
                              >
                                <Edit3 size={12} />
                              </button>
                              {/* Move to next status */}
                              {status !== 'completed' && (
                                <button
                                  onClick={async () => {
                                    const nextStatus = status === 'planned' ? 'in-progress' : 'completed';
                                    const res = await authFetch('/api/roadmap', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', 'x-wallet-address': address || '' },
                                      body: JSON.stringify({ id: item.id, status: nextStatus }),
                                    });
                                    if (res.ok) {
                                      toast.success(`Moved to ${nextStatus}`);
                                      const r = await authFetch('/api/roadmap');
                                      const d = await r.json();
                                      if (d.success) setRoadmapItems(d.items);
                                    } else toast.error('Failed to move');
                                  }}
                                  className="p-1.5 text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors"
                                  title={status === 'planned' ? 'Move to In Progress' : 'Mark Complete'}
                                >
                                  {status === 'planned' ? <ArrowRight size={12} /> : <CheckCircle size={12} />}
                                </button>
                              )}
                              {/* Move back */}
                              {status !== 'planned' && (
                                <button
                                  onClick={async () => {
                                    const prevStatus = status === 'completed' ? 'in-progress' : 'planned';
                                    const res = await authFetch('/api/roadmap', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', 'x-wallet-address': address || '' },
                                      body: JSON.stringify({ id: item.id, status: prevStatus }),
                                    });
                                    if (res.ok) {
                                      toast.success(`Moved to ${prevStatus}`);
                                      const r = await authFetch('/api/roadmap');
                                      const d = await r.json();
                                      if (d.success) setRoadmapItems(d.items);
                                    } else toast.error('Failed to move');
                                  }}
                                  className="p-1.5 text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors"
                                  title={status === 'completed' ? 'Move to In Progress' : 'Move to Planned'}
                                >
                                  <ChevronLeft size={12} />
                                </button>
                              )}
                              {/* Delete */}
                              <button
                                onClick={async () => {
                                  setConfirmation({title:`Delete “${item.title}”?`,description:'This removes the item from the public roadmap.',run:async()=>{
                                  const res = await authFetch(`/api/roadmap?id=${item.id}`, {
                                    method: 'DELETE',
                                    headers: { 'x-wallet-address': address || '' },
                                  });
                                  if (res.ok) {
                                    toast.success('Deleted');
                                    setRoadmapItems(prev => prev.filter(i => i.id !== item.id));
                                  } else toast.error('Failed to delete');
                                  }});
                                }}
                                className="p-1.5 text-[var(--muted)] hover:text-[var(--danger)] transition-colors" title="Delete" aria-label="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    {confirmation&&<ConfirmDialog label={confirmation.title} onClose={()=>{if(!confirmBusy)setConfirmation(null);}}><h3>{confirmation.title}</h3><p>{confirmation.description}</p><div className="flex justify-end gap-3"><button disabled={confirmBusy} onClick={()=>setConfirmation(null)}>Cancel</button><button disabled={confirmBusy} onClick={async()=>{setConfirmBusy(true);try{await confirmation.run();setConfirmation(null);}catch{toast.error('The action failed. Try again.');}finally{setConfirmBusy(false);}}}>{confirmBusy?'Working…':'Confirm'}</button></div></ConfirmDialog>}
    </div></div>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, color = "text-[var(--ink)]" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--rule)] p-4 rounded-lg">
      <div className={`flex items-center gap-2 ${color} mb-1`}>{icon}<span className="text-xs text-[var(--muted)]  ">{label}</span></div>
      <div className="text-2xl font-semibold  text-[var(--ink)]">{value || 0}</div>
    </div>
  );
}

function AdminField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs    text-[var(--muted)] mb-1.5">{label}</span>
      <input aria-label="Value"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-lg px-3 py-2.5 text-xs text-[var(--muted)] placeholder-zinc-600  focus:border-[var(--rule)] "
      />
    </label>
  );
}

function DeliverableContent({ type, content }: { type: string; content: string }) {
  if (!content || content === '(No content provided)') {
    return <p className="text-sm text-[var(--muted)] italic">No content provided</p>;
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
          className="text-[var(--accent-text)] hover:text-[var(--accent-text)] flex items-center gap-2 break-all text-sm"
        >
          <ExternalLink className="w-4 h-4 shrink-0" /> {cleaned}
        </a>
      );

    case 'code':
      return (
        <pre className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
          <code className="text-sm text-[var(--accent-text)]  whitespace-pre-wrap break-words">{cleaned}</code>
        </pre>
      );

    case 'token_launch':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)] ">Mint:</span>
            <code className="text-sm text-[var(--accent-text)] bg-[var(--surface)] px-2 py-0.5 rounded  break-all">{cleaned}</code>
          </div>
          <a
            href={`https://solscan.io/token/${cleaned}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-text)] hover:text-[var(--accent-text)] flex items-center gap-1.5 text-xs "
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
          className="text-[var(--accent-text)] hover:text-[var(--accent-text)] flex items-center gap-2 break-all text-sm"
        >
          <ExternalLink className="w-4 h-4 shrink-0" /> {cleaned}
        </a>
      );

    case 'text':
    default:
      return (
        <div className="text-[var(--muted)] text-sm font-light leading-relaxed prose  prose-sm max-w-none prose-headings:text-[var(--ink)] prose-headings: prose-headings:font-semibold prose-p:text-[var(--muted)] prose-a:text-[var(--accent-text)] prose-strong:text-[var(--ink)] prose-code:text-[var(--accent-text)] prose-code:bg-[var(--surface)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[var(--surface)] prose-pre:border prose-pre:border-[var(--rule)] prose-li:text-[var(--muted)]">
          <ReactMarkdown>{cleaned}</ReactMarkdown>
        </div>
      );
  }
}

function SubmissionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Submitted: "bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]",
    Rejected: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]",
    Approved: "bg-[var(--soft)] text-[var(--accent-text)] border-[var(--rule)]",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold  ${styles[status] || "bg-[var(--surface)] text-[var(--muted)] border-[var(--rule)]"}`}>
      {status}
    </span>
  );
}

function PaginationBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  const icon=React.isValidElement(children)?children.type:null;
  const label=icon===ChevronsLeft?'First page':icon===ChevronLeft?'Previous page':icon===ChevronsRight?'Last page':'Next page';
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="p-2 border border-[var(--rule)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
