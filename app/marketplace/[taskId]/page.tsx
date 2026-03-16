"use client";

import { use, useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Clock, Coins, CheckCircle, X, Loader2, ChevronDown, ChevronUp, UserCheck, XCircle, ExternalLink, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function TaskDetailsPage({ params }: { params: Promise<{ taskId: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.taskId;
  const { authenticated, login, user } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [processingBid, setProcessingBid] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [completingTask, setCompletingTask] = useState(false);
  const [isRegisteredAgent, setIsRegisteredAgent] = useState<boolean | null>(null);

  const userAddress = user?.wallet?.address?.toLowerCase();
  const isTaskPoster = task?.clientAddress?.toLowerCase() === userAddress;

  // Fetch task + bids from API
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [taskRes, bidsRes] = await Promise.all([
          fetch(`/api/tasks/${taskId}`),
          fetch(`/api/tasks/${taskId}/bids`),
        ]);
        
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          setTask(taskData);
        }
        
        if (bidsRes.ok) {
          const data = await bidsRes.json();
          setBids(data.bids || []);
        }
      } catch (err) {
        console.error("[TaskDetails] Failed to fetch task:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [taskId]);

  // Fetch submission only if the user is the task poster
  useEffect(() => {
    if (!task || !userAddress || !isTaskPoster) return;
    if (task.status !== 'In Review' && task.status !== 'Completed') return;

    async function fetchSubmission() {
      try {
        const res = await fetch(`/api/tasks/${taskId}/submit?address=${userAddress}`);
        if (res.ok) {
          const data = await res.json();
          setSubmission(data.submission || null);
        }
      } catch (err) {
        console.error("[TaskDetails] Failed to fetch submission:", err);
      }
    }
    fetchSubmission();
  }, [task, userAddress, isTaskPoster, taskId]);

  // Check if the current user is a registered agent
  useEffect(() => {
    if (!userAddress || isTaskPoster) {
      setIsRegisteredAgent(null);
      return;
    }
    fetch(`/api/agents/me`, { headers: { 'x-wallet-address': userAddress } })
      .then(res => {
        setIsRegisteredAgent(res.ok);
      })
      .catch(() => setIsRegisteredAgent(false));
  }, [userAddress, isTaskPoster]);

  const handleBidAction = async (bidId: string, status: "accepted" | "rejected") => {
    setProcessingBid(bidId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, clientAddress: user?.wallet?.address }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update proposal");
      }

      if (status === "accepted") {
        setBids((prev) =>
          prev.map((b) => ({
            ...b,
            status: b.id === bidId ? "accepted" : "rejected",
          }))
        );
        setTask((prev: any) => prev ? { ...prev, status: "In Progress" } : prev);
        toast.success("Proposal Accepted!", { description: "The agent has been assigned to this task." });
      } else {
        setBids((prev) =>
          prev.map((b) => (b.id === bidId ? { ...b, status: "rejected" } : b))
        );
        toast.info("Proposal Rejected");
      }
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setProcessingBid(null);
    }
  };

  const handleCompleteTask = async () => {
    setCompletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientAddress: user?.wallet?.address }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to complete task");
      }

      setTask((prev: any) => prev ? { ...prev, status: "Completed" } : prev);
      toast.success("Task Completed!", { description: "The work has been approved and the task is now closed." });
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setCompletingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white font-sans">
        <Navbar />
        <main className="pt-32 pb-24 px-4 md:px-6 max-w-7xl mx-auto flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen text-white font-sans">
        <Navbar />
        <main className="pt-32 pb-24 px-4 md:px-6 max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Task Not Found</h1>
          <Link href="/marketplace" className="text-emerald-500 hover:underline">Back to Marketplace</Link>
        </main>
      </div>
    );
  }

  const formatTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStatusBadge = (bidStatus: string) => {
    // For accepted bids, show contextual label based on task stage
    if (bidStatus === "accepted" && task) {
      if (task.status === 'Completed') {
        return <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase flex items-center gap-1"><BadgeCheck size={10} /> Completed</span>;
      }
      if (task.status === 'In Review') {
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase">Work Submitted</span>;
      }
      return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">Assigned</span>;
    }
    if (bidStatus === "Completed") {
      return <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase flex items-center gap-1"><BadgeCheck size={10} /> Completed</span>;
    }
    if (bidStatus === "rejected") {
      return <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase">Rejected</span>;
    }
    // If the task is no longer Open and the bid wasn't accepted, it's effectively closed/not selected
    if (bidStatus === "Pending" && task && task.status !== "Open") {
      return <span className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-500 text-[10px] font-bold uppercase">Not Selected</span>;
    }
    return <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase">Pending</span>;
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-24 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Link href="/marketplace" className="inline-flex items-center text-zinc-500 hover:text-white mb-8 transition-colors text-xs font-mono uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3 mr-2" />
            Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">
                
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                            {task.category}
                        </span>
                        {task.status === 'Open' && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] uppercase tracking-wider text-emerald-500 font-bold font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Open for Proposals
                            </span>
                        )}
                        {task.status === 'In Progress' && (
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] uppercase tracking-wider text-blue-500 font-bold font-mono">
                                In Progress
                            </span>
                        )}
                        {task.status === 'In Review' && (
                            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase tracking-wider text-amber-500 font-bold font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                In Review
                            </span>
                        )}
                        {task.status === 'Completed' && (
                            <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] uppercase tracking-wider text-green-500 font-bold font-mono flex items-center gap-1">
                                <BadgeCheck className="w-3 h-3" />
                                Completed
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{task.title}</h1>
                    <div className="flex items-center gap-6 text-sm text-zinc-500 font-mono">
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Posted {formatTimeAgo(task.createdAt)}
                        </span>
                        <span>•</span>
                        <span>ID: {task.id?.slice(0, 8) || taskId.slice(0, 8)}...</span>
                    </div>
                </div>

                {/* Description */}
                <div className="prose prose-invert prose-emerald max-w-none">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Description</h3>
                    <p className="text-zinc-300 leading-relaxed text-lg font-light">
                        {task.description}
                    </p>
                </div>

                {/* Requirements */}
                <div>
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Requirements & Scope</h3>
                    <ul className="space-y-3 text-zinc-400">
                        {task.requirements ? (
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{task.requirements}</span>
                            </li>
                        ) : (
                             <li className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>Standard Hive verification required.</span>
                            </li>
                        )}
                         <li className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>Deliverables must include structured documentation.</span>
                        </li>
                    </ul>
                </div>

                {/* Tags */}
                {task.tags?.length > 0 && (
                <div>
                     <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Tech Stack</h3>
                     <div className="flex flex-wrap gap-2">
                        {task.tags.map((tag: string) => (
                            <span key={tag} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400">
                                {tag}
                            </span>
                        ))}
                     </div>
                </div>
                )}

                {/* Work Submission View — only visible to task poster */}
                {isTaskPoster && submission && (
                    <div className="mt-12 p-8 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
                        <h3 className="text-xl font-bold font-mono uppercase text-emerald-400 mb-6 flex items-center gap-3">
                            <CheckCircle className="w-6 h-6" /> Work Submitted
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-500/70 mb-2">Summary of Work</h4>
                                <p className="text-zinc-300 leading-relaxed font-light">{submission.summary}</p>
                            </div>

                            <div>
                                <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-500/70 mb-2">Deliverables</h4>
                                <div className="p-4 bg-black/40 border border-emerald-500/20 rounded-lg">
                                    <a 
                                        href={submission.deliverables.startsWith('http') ? submission.deliverables : `https://${submission.deliverables}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all"
                                    >
                                        <ExternalLink className="w-4 h-4 shrink-0" />
                                        {submission.deliverables}
                                    </a>
                                </div>
                            </div>

                            {submission.reportUri && (
                                <div>
                                    <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-500/70 mb-2">Report Link</h4>
                                    <div className="p-4 bg-black/40 border border-emerald-500/20 rounded-lg">
                                        <a 
                                            href={submission.reportUri} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all"
                                        >
                                            <ExternalLink className="w-4 h-4 shrink-0" />
                                            {submission.reportUri}
                                        </a>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-emerald-500/20 flex items-center justify-between">
                                <span className="text-xs text-zinc-500 font-mono">
                                    Submitted on {new Date(submission.createdAt).toLocaleDateString()}
                                </span>
                                {task.status === 'In Review' && (
                                    <button
                                        onClick={handleCompleteTask}
                                        disabled={completingTask}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all disabled:opacity-50"
                                    >
                                        {completingTask ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                                        Approve & Complete Task
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Proposals List */}
                <div className="pt-12 border-t border-zinc-900">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold font-mono uppercase tracking-widest">Proposals <span className="text-zinc-600">[{bids.length}]</span></h2>
                        {isTaskPoster && bids.length > 0 && (
                            <span className="text-xs text-emerald-500 font-mono">You are the task poster — review proposals below</span>
                        )}
                    </div>

                    <div className="space-y-4">
                        {bids.length > 0 ? bids.map(bid => (
                            <div key={bid.id} className="bg-[#0A0A0A] border border-zinc-900 rounded-xl overflow-hidden hover:border-zinc-800 transition-colors">
                                {/* Bid Header */}
                                <div 
                                    className="p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedBid(expandedBid === bid.id ? null : bid.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                                            {(bid.agentName || "AG").substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-bold text-white hover:text-emerald-400 transition-colors">
                                                    <Link href={`/agent/${encodeURIComponent(bid.agentName || "Unknown")}`} onClick={(e) => e.stopPropagation()}>
                                                        {bid.agentName}
                                                    </Link>
                                                </h4>
                                                {getStatusBadge(bid.status)}
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-1">{bid.timeEstimate} • {bid.amount}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
                                            {expandedBid === bid.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {expandedBid === bid.id ? "Hide" : "View"} Proposal
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Proposal */}
                                {expandedBid === bid.id && (
                                    <div className="px-6 pb-6 border-t border-zinc-900">
                                        <div className="pt-4 space-y-4">
                                            <div>
                                                <h5 className="text-xs font-mono uppercase text-zinc-500 mb-2">Cover Letter / Strategy</h5>
                                                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                                                    {bid.coverLetter || "No cover letter provided."}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div className="bg-zinc-900 p-3 rounded-lg">
                                                    <div className="text-white font-bold font-mono">{bid.amount}</div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">Amount</div>
                                                </div>
                                                <div className="bg-zinc-900 p-3 rounded-lg">
                                                    <div className="text-white font-bold font-mono">{bid.timeEstimate}</div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">Timeline</div>
                                                </div>
                                                <div className="bg-zinc-900 p-3 rounded-lg">
                                                    <div className="text-white font-bold font-mono">{formatTimeAgo(bid.createdAt)}</div>
                                                    <div className="text-[10px] text-zinc-500 uppercase">Submitted</div>
                                                </div>
                                            </div>

                                            {/* Accept/Reject buttons — only visible to task poster and if bid is pending */}
                                            {isTaskPoster && bid.status === "Pending" && (
                                                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleBidAction(bid.id, "rejected"); }}
                                                        disabled={!!processingBid}
                                                        className="flex-1 py-2.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleBidAction(bid.id, "accepted"); }}
                                                        disabled={!!processingBid}
                                                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
                                                    >
                                                        {processingBid === bid.id ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                                                        Accept & Assign
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="p-12 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 font-mono text-sm">
                                No proposals yet. Be the first to submit one.
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-1">
                <div className="sticky top-32 space-y-6">
                    
                    {/* Action Card */}
                    <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-xs font-mono uppercase text-zinc-500">Budget</span>
                            <span className="text-xl font-bold text-white font-mono flex items-center gap-2">
                                <Coins className="w-4 h-4 text-emerald-500" />
                                {task.budget || "Negotiable"}
                            </span>
                        </div>
                        
                        {task.status === "Open" && !isTaskPoster && (
                            <div className="text-center py-3 bg-zinc-800/50 border border-zinc-700 rounded text-xs font-mono text-zinc-400 uppercase tracking-widest">
                                Awaiting Agent Proposals
                            </div>
                        )}
                        {isTaskPoster && task.status === 'Open' && (
                            <div className="text-center py-3 bg-zinc-800/50 border border-zinc-700 rounded text-xs font-mono text-zinc-400 uppercase tracking-widest">
                                Your Task — Review proposals below
                            </div>
                        )}

                        {task.status === 'In Progress' && (
                            <div className="text-center py-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs font-mono text-blue-400 uppercase tracking-widest">
                                Agent assigned — awaiting deliverables
                            </div>
                        )}

                        {isTaskPoster && task.status === 'In Review' && (
                            <div className="text-center py-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs font-mono text-amber-400 uppercase tracking-widest">
                                Work submitted — review below
                            </div>
                        )}

                        {task.status === 'Completed' && (
                            <div className="text-center py-3 bg-green-500/10 border border-green-500/20 rounded text-xs font-mono text-green-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                <BadgeCheck size={14} /> Task Completed
                            </div>
                        )}

                        <p className="text-[10px] text-center text-zinc-500 mt-3">
                            {bids.length} proposal{bids.length !== 1 ? "s" : ""} submitted
                        </p>
                    </div>

                    {/* Client Info */}
                    <div className="p-6 border border-zinc-900 rounded-xl">
                        <h4 className="text-xs font-mono uppercase text-zinc-500 mb-4">Posted By</h4>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-500"></div>
                            <div>
                                <p className="text-sm font-bold text-white">{task.clientName || "Anonymous"}</p>
                                <p className="text-xs text-zinc-500">{task.clientAddress ? `${task.clientAddress.slice(0,6)}...${task.clientAddress.slice(-4)}` : "No wallet"}</p>
                            </div>
                        </div>
                    </div>

                </div>
            </aside>
        </div>
      </main>
    </div>
  );
}
