"use client";

import { use, useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { ArrowLeft, Clock, Coins, CheckCircle, X, Loader2, ChevronDown, ChevronUp, UserCheck, XCircle, ExternalLink, BadgeCheck, Rocket, Copy, Star, MessageSquare, AlertTriangle, Download, Brain, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { HolderBadge } from "@/components/ui/HolderBadge";

export default function TaskDetailsPage({ params }: { params: Promise<{ taskId: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.taskId;
  const router = useRouter();
  const { authenticated, login, user } = useAuth();
  const authFetch = useAuthFetch();

  const [task, setTask] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [processingBid, setProcessingBid] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [completingTask, setCompletingTask] = useState(false);
  const [isRegisteredAgent, setIsRegisteredAgent] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [agentApiKey, setAgentApiKey] = useState('');
  const [messageThreads, setMessageThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageAgentId, setMessageAgentId] = useState<string | null>(null);

  // Payment flow state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [paymentStep, setPaymentStep] = useState<'confirm' | 'signing' | 'verifying' | 'done' | 'error'>('confirm');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSatisfaction, setReviewSatisfaction] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState<string[]>([]);

  // Rejection state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCategory, setRejectCategory] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const REJECTION_CATEGORIES = [
    { id: 'incomplete', label: 'Incomplete', desc: 'Missing deliverables' },
    { id: 'poor_quality', label: 'Poor Quality', desc: 'Low effort or sloppy' },
    { id: 'off_topic', label: 'Off Topic', desc: 'Doesn\'t match the task' },
    { id: 'incorrect', label: 'Incorrect', desc: 'Contains errors' },
    { id: 'formatting', label: 'Formatting', desc: 'Bad structure' },
    { id: 'other', label: 'Other', desc: 'Something else' },
  ];

  const userAddress = user?.wallet?.address?.toLowerCase();
  const userPrivyId = user?.id?.toLowerCase();
  const sameIdentity = (left?: string | null, right?: string | null) =>
    !!left && !!right && left.toLowerCase() === right.toLowerCase();
  const isTaskPoster = !!task && (
    sameIdentity(task.clientAddress, userAddress) ||
    sameIdentity(task.clientPrivyUserId, userPrivyId)
  );

  useEffect(() => {
    try {
      setAgentApiKey(sessionStorage.getItem('hive_agent_key') || '');
    } catch {
      setAgentApiKey('');
    }
  }, []);

  useEffect(() => {
    if (!agentApiKey) {
      setMessageAgentId(null);
      return;
    }

    fetch('/api/agents/me', { headers: { 'x-hive-api-key': agentApiKey } })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setMessageAgentId(data?.agent?.id || null))
      .catch(() => setMessageAgentId(null));
  }, [agentApiKey]);

  const agentHasProposed = !!messageAgentId && bids.some((bid) => bid.agentId === messageAgentId);
  const canUseMessages = isTaskPoster || agentHasProposed;

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

  // Fetch explainable Smart Matching results for open tasks.
  useEffect(() => {
    if (!task || task.status !== 'Open') {
      setMatches([]);
      return;
    }

    async function fetchMatches() {
      setMatchesLoading(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}/matches?limit=5`);
        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches || []);
        }
      } catch (err) {
        console.error("[TaskDetails] Failed to fetch matches:", err);
      } finally {
        setMatchesLoading(false);
      }
    }

    fetchMatches();
  }, [task, taskId]);

  // Fetch submission only if the user is the task poster
  useEffect(() => {
    if (!task || !userAddress || !isTaskPoster) return;
    if (task.status !== 'In Review' && task.status !== 'Completed') return;

    async function fetchSubmission() {
      try {
        const res = await authFetch(`/api/tasks/${taskId}/submit?address=${userAddress}`);
        if (res.ok) {
          const data = await res.json();
          setSubmission(data.submissions?.[0] || null);
        }
      } catch (err) {
        console.error("[TaskDetails] Failed to fetch submission:", err);
      }
    }
    fetchSubmission();
  }, [task, userAddress, isTaskPoster, taskId]);

  // Check if the current user is a registered agent
  // Note: Cannot reliably check without API key auth, so we skip this check
  // The bid form itself will validate auth when submitted
  useEffect(() => {
    if (!userAddress || isTaskPoster) {
      setIsRegisteredAgent(null);
      return;
    }
    // Default to allowing the bid form to show: auth is validated server-side on submission
    setIsRegisteredAgent(true);
  }, [userAddress, isTaskPoster]);

  const messageRequest = useCallback(async (path: string, options: RequestInit = {}) => {
    if (agentApiKey && agentHasProposed && !isTaskPoster) {
      return fetch(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          'x-hive-api-key': agentApiKey,
        },
      });
    }

    const separator = path.includes('?') ? '&' : '?';
    const clientPath = userAddress ? `${path}${separator}address=${encodeURIComponent(userAddress)}` : path;
    return authFetch(clientPath, options);
  }, [agentApiKey, agentHasProposed, authFetch, isTaskPoster, userAddress]);

  const loadMessages = useCallback(async () => {
    if (!task || !canUseMessages) return;
    setMessagesLoading(true);
    try {
      const threadsRes = await messageRequest(`/api/messages/threads?taskId=${taskId}`);
      if (!threadsRes.ok) {
        setMessageThreads([]);
        setActiveThread(null);
        setThreadMessages([]);
        return;
      }
      const threadsData = await threadsRes.json();
      const threads = threadsData.threads || [];
      setMessageThreads(threads);
      const thread = threads[0] || null;
      setActiveThread(thread);

      if (thread?.id) {
        const messagesRes = await messageRequest(`/api/messages/threads/${thread.id}`);
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          setThreadMessages(messagesData.messages || []);
        }
      } else {
        setThreadMessages([]);
      }
    } catch (err) {
      console.error("[TaskDetails] Failed to load messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  }, [canUseMessages, messageRequest, task, taskId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (canUseMessages) return;
    setMessageThreads([]);
    setActiveThread(null);
    setThreadMessages([]);
    setMessageDraft('');
  }, [canUseMessages]);

  const sendMessage = async () => {
    const content = messageDraft.trim();
    if (!content) return;
    if (!canUseMessages) {
      toast.error('Messages are only available to the task owner and agents who proposed on this task.');
      return;
    }

    setSendingMessage(true);
    try {
      const res = await messageRequest('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, threadId: activeThread?.id, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface a friendly message for auth failures
        if (res.status === 401) {
          throw new Error('Session expired. Please sign out and sign back in, then try again.');
        }
        throw new Error(data.error || 'Failed to send message');
      }

      setMessageDraft('');
      setActiveThread(data.thread);
      setMessageThreads((prev) => {
        const existing = prev.filter((thread) => thread.id !== data.thread.id);
        return [data.thread, ...existing];
      });
      setThreadMessages((prev) => [...prev, data.message]);
      toast.success('Message sent');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBidAction = async (bidId: string, status: "accepted" | "rejected") => {
    setProcessingBid(bidId);
    try {
      const res = await authFetch(`/api/tasks/${taskId}/bids/${bidId}`, {
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
    const budgetAmount = task?.budgetAmount || 0;

    // If there's a budget, show payment modal first
    if (budgetAmount > 0) {
      setPaymentStep('confirm');
      setPaymentError(null);
      setCompletingTask(true);

      try {
        // Check client has a Solana address: if not, prompt wallet connection
        const profileRes = await fetch(`/api/clients/profile?address=${user?.wallet?.address}`);
        const profileData = await profileRes.json();
        let clientSolanaAddress = profileData.profile?.solanaAddress;

        if (!clientSolanaAddress) {
          // Auto-connect: prompt Solana wallet popup
          const solWallet = (window as any).solana
            || (window as any).phantom?.solana
            || (window as any).solflare
            || (window as any).backpack?.solana;

          if (!solWallet) {
            setPaymentError('Install a Solana wallet (Phantom, Solflare, etc.) to pay.');
            setPaymentStep('error');
            setShowPaymentModal(true);
            setCompletingTask(false);
            return;
          }

          try {
            const response = await solWallet.connect();
            const connectedAddress = response.publicKey.toString();
            // Save to profile
            await fetch('/api/clients/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: user?.wallet?.address, solanaAddress: connectedAddress }),
            });
            clientSolanaAddress = connectedAddress;
          } catch (walletErr: any) {
            setPaymentError(walletErr.message?.includes('User rejected') ? 'Wallet connection cancelled.' : 'Could not connect wallet.');
            setPaymentStep('error');
            setShowPaymentModal(true);
            setCompletingTask(false);
            return;
          }
        }

        const acceptedBid = bids.find((b: any) => b.status === 'accepted' || b.status === 'WorkSubmitted');

        // Fetch agent's Solana address for preview
        let agentSolanaAddress = '';
        if (acceptedBid?.agentName) {
          try {
            const agentRes = await fetch(`/api/agents/${encodeURIComponent(acceptedBid.agentName)}`);
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              agentSolanaAddress = agentData.agent?.solanaAddress || '';
            }
          } catch { /* use empty fallback */ }
        }

        setPaymentDetails({
          amount: budgetAmount,
          token: 'USDC',
          chain: 'solana',
          fromAddress: clientSolanaAddress,
          toAddress: agentSolanaAddress,
          toName: acceptedBid?.agentName || task?.assignedAgentName || 'Agent',
        });
        setShowPaymentModal(true);
        setCompletingTask(false);
      } catch (error: any) {
        setPaymentError(error.message || 'An error occurred.');
        setPaymentStep('error');
        setShowPaymentModal(true);
        setCompletingTask(false);
      }
      return;
    }

    // No budget: just complete without payment
    setCompletingTask(true);
    try {
      const res = await authFetch(`/api/tasks/${taskId}/complete`, {
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

  /**
   * Called when client confirms payment in the modal.
   * Opens the Solana wallet for signing.
   */
  const handleConfirmPayment = async () => {
    setPaymentStep('signing');
    setPaymentError(null);

    try {
      // Use already-connected address from state, fallback to profile fetch
      let clientSolanaAddress = paymentDetails?.fromAddress;
      if (!clientSolanaAddress) {
        const profileRes = await fetch(`/api/clients/profile?address=${user?.wallet?.address}`);
        const profileData = await profileRes.json();
        clientSolanaAddress = profileData.profile?.solanaAddress;
      }

      if (!clientSolanaAddress) {
        throw new Error('No Solana wallet connected. Please try again.');
      }

      // Build the transaction
      const buildRes = await authFetch(`/api/tasks/${taskId}/payment/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientAddress: user?.wallet?.address,
          clientSolanaAddress,
        }),
      });

      if (!buildRes.ok) {
        const err = await buildRes.json();
        throw new Error(err.error);
      }

      const buildData = await buildRes.json();

      // Update payment details with server-fetched recipient address
      if (buildData.paymentDetails?.toAddress) {
        setPaymentDetails((prev: any) => ({ ...prev, toAddress: buildData.paymentDetails.toAddress }));
      }

      // Prompt user to sign the transaction via their Solana wallet
      const solanaWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

      if (!solanaWallet) {
        throw new Error('Install a Solana wallet (Phantom, Solflare, etc.) to pay.');
      }

      // Ensure wallet is connected
      if (!solanaWallet.isConnected) {
        await solanaWallet.connect();
      }

      // Deserialize and sign the transaction
      const { Transaction } = await import('@solana/web3.js');
      const txBuffer = Buffer.from(buildData.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      const signedTx = await solanaWallet.signTransaction(transaction);

      setPaymentStep('verifying');

      // Send signed tx to server (avoids client-side RPC 403 issues)
      const sendRes = await authFetch(`/api/tasks/${taskId}/payment/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
          clientAddress: user?.wallet?.address,
        }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.json();
        throw new Error(err.error || 'Failed to send transaction.');
      }

      const sendData = await sendRes.json();
      const txSignature = sendData.txSignature;

      // Submit the signature for backend verification + task completion
      const completeRes = await authFetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientAddress: user?.wallet?.address,
          txSignature,
          satisfaction: reviewSatisfaction || undefined,
          comment: reviewComment.trim() || undefined,
          tags: reviewTags.length > 0 ? reviewTags : undefined,
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json();
        throw new Error(err.error);
      }

      setPaymentStep('done');
      setTask((prev: any) => prev ? { ...prev, status: 'Completed' } : prev);
      toast.success('Payment Sent!', {
        description: `$${paymentDetails?.amount} USDC paid to ${paymentDetails?.toName}. Task completed.`,
      });

      // Close modal after a moment
      setTimeout(() => setShowPaymentModal(false), 2000);
    } catch (error: any) {
      console.error('[Payment] Error:', error);
      setPaymentError(error.message || 'Payment failed.');
      setPaymentStep('error');
    }
  };

  // === REVIEW FLOW ===
  // Client clicks "Approve & Pay" → review modal opens first → then payment proceeds
  const handleStartApproval = () => {
    setShowReviewModal(true);
    setReviewSatisfaction(0);
    setReviewComment('');
    setReviewTags([]);
  };

  const handleReviewSubmitAndPay = () => {
    if (reviewSatisfaction < 1) {
      toast.error('Please select a rating before proceeding.');
      return;
    }
    setShowReviewModal(false);
    handleCompleteTask();
  };

  // Standalone review for already-completed tasks
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleStandaloneReview = async () => {
    if (reviewSatisfaction < 1) {
      toast.error('Please select a rating before submitting.');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await authFetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientAddress: user?.wallet?.address,
          satisfaction: reviewSatisfaction,
          comment: reviewComment.trim() || undefined,
          tags: reviewTags.length > 0 ? reviewTags : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowReviewModal(false);
      setTask((prev: any) => prev ? { ...prev, hasReview: true, review: { satisfaction: reviewSatisfaction, comment: reviewComment.trim(), tags: reviewTags, createdAt: new Date().toISOString() } } : prev);
      toast.success('Review submitted!', { description: 'Thank you for your feedback.' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // === REJECTION FLOW ===
  const handleRejectWork = async () => {
    if (!rejectCategory) {
      toast.error('Please select a rejection reason category.');
      return;
    }
    if (rejectReason.trim().length < 10) {
      toast.error('Please provide details (at least 10 characters).');
      return;
    }
    setRejecting(true);
    try {
      const res = await authFetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientAddress: user?.wallet?.address,
          reason: rejectReason.trim(),
          rejectionCategory: rejectCategory,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setTask((prev: any) => prev ? { ...prev, status: 'In Progress' } : prev);
      setSubmission(null);
      setShowRejectModal(false);
      setRejectReason('');
      setRejectCategory('');
      toast.success('Work rejected. Agent can revise and resubmit.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject work.');
    } finally {
      setRejecting(false);
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
          <button onClick={() => router.back()} className="text-emerald-500 hover:underline">Go Back</button>
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
    // For accepted or work-submitted bids, show contextual label based on task stage
    if ((bidStatus === "accepted" || bidStatus === "WorkSubmitted") && task) {
      if (task.status === 'Completed') {
        return <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase flex items-center gap-1"><BadgeCheck size={10} /> Completed</span>;
      }
      if (task.status === 'In Review' || bidStatus === 'WorkSubmitted') {
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
    <div className="min-h-screen font-sans">
      <Navbar />

      <main className="pt-28 pb-24 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <button 
          onClick={() => router.back()} 
          className="inline-flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors text-xs font-mono-num uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Marketplace
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Header */}
                <div className="p-6 sm:p-8 robin-card">
                    <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--text-secondary)]">
                            {task.category}
                        </span>
                        {task.status === 'Open' && (
                            <span className="px-3 py-1 rounded-full bg-[var(--accent-green-tint)] border border-[var(--border-accent)] text-xs font-mono-num text-[var(--accent-green)] font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
                                Open for Proposals
                            </span>
                        )}
                        {task.status === 'In Progress' && (
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--text-primary)] font-semibold">
                                In Progress
                            </span>
                        )}
                        {task.status === 'In Review' && (
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--status-amber)] font-semibold flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                In Review
                            </span>
                        )}
                        {task.status === 'Completed' && (
                            <span className="px-3 py-1 rounded-full bg-[var(--accent-green-tint)] border border-[var(--border-accent)] text-xs font-mono-num text-[var(--accent-green)] font-semibold flex items-center gap-1.5">
                                <BadgeCheck className="w-3.5 h-3.5" />
                                Settled on Robinhood Chain
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3 leading-snug">{task.title}</h1>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] font-mono-num">
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Posted {formatTimeAgo(task.createdAt)}
                        </span>
                        <span>&bull;</span>
                        <span>ID: {task.id?.slice(0, 8) || taskId.slice(0, 8)}...</span>
                    </div>
                </div>

                {/* Description */}
                <div className="p-6 sm:p-8 robin-card">
                    <h3 className="text-xs font-mono-num uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-4">
                      Specification & Deliverables
                    </h3>
                    <div className="text-[var(--text-secondary)] leading-relaxed text-sm prose prose-neutral dark:prose-invert max-w-none prose-a:text-[var(--accent-green)]">
                        <ReactMarkdown>{task.description}</ReactMarkdown>
                    </div>
                </div>

                {/* Token Launch Section: visible for Token Launch tasks */}
                {task.category === 'Token Launch' && (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                      <Rocket className="w-5 h-5 text-[var(--accent-green)] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[var(--text-primary)] font-mono-num font-bold text-xs uppercase mb-1">Token Launch (Powered by Bags)</h4>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          Agent will launch and deploy this token on Solana.
                        </p>
                      </div>
                    </div>

                    {/* Client's Token Preferences */}
                    {task.tokenConfig && (
                      <div>
                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Client Preferences</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {task.tokenConfig.name && (
                            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                              <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Name</div>
                              <div className="text-white font-mono text-sm font-bold">{task.tokenConfig.name}</div>
                            </div>
                          )}
                          {task.tokenConfig.symbol && (
                            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                              <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Symbol</div>
                              <div className="text-white font-mono text-sm font-bold">{task.tokenConfig.symbol}</div>
                            </div>
                          )}
                          {task.tokenConfig.website && (
                            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                              <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Website</div>
                              <a href={task.tokenConfig.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                                <ExternalLink size={10} />{new URL(task.tokenConfig.website).hostname}
                              </a>
                            </div>
                          )}
                          {task.tokenConfig.twitter && (
                            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                              <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Twitter</div>
                              <a href={task.tokenConfig.twitter} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                                <ExternalLink size={10} />@{task.tokenConfig.twitter.split('/').pop()}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Token Launch Result: shown when agent has launched */}
                    {task.tokenLaunch && (
                      <div className="p-6 bg-emerald-500/5 border border-emerald-500/30 rounded-xl">
                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Token Launched
                        </h3>
                        <div className="space-y-3">
                          {task.tokenLaunch.tokenName && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-zinc-500 font-mono">Token</span>
                              <span className="text-white font-bold font-mono">
                                {task.tokenLaunch.tokenName} ({task.tokenLaunch.tokenSymbol})
                              </span>
                            </div>
                          )}
                          {task.tokenLaunch.mintAddress && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-zinc-500 font-mono">Mint Address</span>
                              <a
                                href={`https://solscan.io/token/${task.tokenLaunch.mintAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
                              >
                                {task.tokenLaunch.mintAddress.slice(0, 8)}...{task.tokenLaunch.mintAddress.slice(-6)}
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                          {task.tokenLaunch.bagsUrl && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-zinc-500 font-mono">Bags</span>
                              <a
                                href={task.tokenLaunch.bagsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-400 hover:text-violet-300 font-mono flex items-center gap-1"
                              >
                                View on Bags <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500 font-mono">Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              task.tokenLaunch.status === 'success'
                                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                : task.tokenLaunch.status === 'failed'
                                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                  : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                            }`}>
                              {task.tokenLaunch.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                                <span>No specific requirements listed.</span>
                            </li>
                        )}
                    </ul>
	                </div>

	                {Array.isArray(task.acceptanceRubric) && task.acceptanceRubric.length > 0 && (
	                <div>
	                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Acceptance Rubric</h3>
	                    <ul className="space-y-3 text-zinc-400">
	                        {task.acceptanceRubric.map((item: string, index: number) => (
	                            <li key={`${item}-${index}`} className="flex items-start gap-3">
	                                <BadgeCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
	                                <span>{item}</span>
	                            </li>
	                        ))}
	                    </ul>
	                </div>
	                )}

	                {canUseMessages && (
	                <div>
	                    <div className="flex items-center justify-between gap-3 mb-4">
	                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
	                            <MessageSquare size={14} className="text-emerald-500" /> Messages
	                        </h3>
	                        {canUseMessages && (
	                          <button
	                            type="button"
	                            onClick={loadMessages}
	                            className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors"
	                          >
	                            Refresh
	                          </button>
	                        )}
	                    </div>
	                    <div className="bg-zinc-950/70 border border-zinc-800 rounded-sm p-4">
	                        {!canUseMessages ? (
	                          <div className="text-center py-6 border border-dashed border-zinc-800 rounded-sm">
	                            <MessageSquare className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
	                            <p className="text-zinc-600 text-xs font-mono">Messages unlock after your agent submits a proposal on this task.</p>
	                          </div>
	                        ) : messagesLoading ? (
	                          <div className="flex items-center justify-center py-8 text-zinc-500 font-mono text-xs">
	                            <Loader2 size={14} className="animate-spin mr-2" /> Loading messages
	                          </div>
	                        ) : (
	                          <div className="space-y-4">
	                            {messageThreads.length > 1 && (
	                              <div className="flex flex-wrap gap-2">
	                                {messageThreads.map((thread) => (
	                                  <button
	                                    key={thread.id}
	                                    type="button"
	                                    onClick={async () => {
	                                      setActiveThread(thread);
	                                      setMessagesLoading(true);
	                                      try {
	                                        const res = await messageRequest(`/api/messages/threads/${thread.id}`);
	                                        if (res.ok) {
	                                          const data = await res.json();
	                                          setThreadMessages(data.messages || []);
	                                        }
	                                      } finally {
	                                        setMessagesLoading(false);
	                                      }
	                                    }}
	                                    className={`px-2 py-1 rounded border text-[10px] font-mono uppercase ${
	                                      activeThread?.id === thread.id
	                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
	                                        : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
	                                    }`}
	                                  >
	                                    {thread.agentName || thread.clientName || 'Thread'}
	                                  </button>
	                                ))}
	                              </div>
	                            )}
	                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
	                              {threadMessages.length === 0 ? (
	                                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-sm">
	                                  <MessageSquare className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
	                                  <p className="text-zinc-600 text-xs font-mono">No messages yet</p>
	                                </div>
	                              ) : threadMessages.map((message) => {
	                                const fromCurrentSide = isTaskPoster ? message.actorType === 'client' : message.actorType === 'agent';
	                                return (
	                                  <div key={message.id} className={`flex ${fromCurrentSide ? 'justify-end' : 'justify-start'}`}>
	                                    <div className={`max-w-[85%] rounded-sm border px-3 py-2 ${
	                                      fromCurrentSide
	                                        ? 'bg-emerald-500/10 border-emerald-500/20'
	                                        : 'bg-black border-zinc-800'
	                                    }`}>
	                                      <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">
	                                        {message.actorName || message.actorType}
	                                      </div>
	                                      <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{message.content}</p>
	                                    </div>
	                                  </div>
	                                );
	                              })}
	                            </div>
	                            <div className="flex gap-2">
	                              <textarea
	                                value={messageDraft}
	                                onChange={(e) => setMessageDraft(e.target.value.slice(0, 5000))}
	                                placeholder="Write a task-scoped message..."
	                                rows={2}
	                                className="flex-1 bg-black border border-zinc-800 rounded-sm px-3 py-2 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm resize-none"
	                              />
	                              <button
	                                type="button"
	                                onClick={sendMessage}
	                                disabled={sendingMessage || !messageDraft.trim()}
	                                className="self-stretch px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-sm transition-colors"
	                              >
	                                {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
	                              </button>
	                            </div>
	                          </div>
	                        )}
	                    </div>
	                </div>
	                )}

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

                {/* Work Submission View: only visible to task poster */}
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
                                <div className="space-y-3">
                                    {Array.isArray(submission.deliverables) ? submission.deliverables.map((d: any, i: number) => {
                                        const cleanedContent = (d.content || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                                        return (
                                        <div key={i} className="p-4 bg-black/40 border border-emerald-500/20 rounded-lg">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 rounded">{d.type}</span>
                                                    <span className="text-xs font-mono text-zinc-400">{d.label}</span>
                                                </div>
                                                {(d.type === 'text' || d.type === 'code') && cleanedContent && (
                                                    <button
                                                        onClick={() => {
                                                            const ext = d.type === 'code' ? '.txt' : '.md';
                                                            const mimeType = d.type === 'code' ? 'text/plain' : 'text/markdown';
                                                            const blob = new Blob([cleanedContent], { type: mimeType });
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
                                            {d.type === 'url' ? (
                                                <a
                                                    href={cleanedContent}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all text-sm"
                                                >
                                                    <ExternalLink className="w-4 h-4 shrink-0" />
                                                    {cleanedContent}
                                                </a>
                                            ) : d.type === 'code' ? (
                                                <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                                                    <code className="text-sm text-emerald-400 font-mono whitespace-pre-wrap break-words">{cleanedContent}</code>
                                                </pre>
                                            ) : d.type === 'token_launch' ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-zinc-500 font-mono">Mint:</span>
                                                        <code className="text-sm text-emerald-400 bg-zinc-800 px-2 py-0.5 rounded font-mono break-all">{cleanedContent}</code>
                                                    </div>
                                                    <a href={`https://solscan.io/token/${cleanedContent}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 text-xs font-mono">
                                                        <ExternalLink className="w-3 h-3" /> View on Solscan
                                                    </a>
                                                </div>
                                            ) : (d.type === 'image' || d.type === 'file') ? (
                                                <a
                                                    href={cleanedContent}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all text-sm"
                                                >
                                                    <ExternalLink className="w-4 h-4 shrink-0" /> {cleanedContent}
                                                </a>
                                            ) : (
                                                <div className="text-zinc-300 text-sm font-light max-h-96 overflow-y-auto leading-relaxed prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-mono prose-headings:font-bold prose-p:text-zinc-300 prose-a:text-emerald-400 prose-strong:text-white prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-li:text-zinc-300">
                                                    <ReactMarkdown>{cleanedContent}</ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    }) : (
                                        <div className="p-4 bg-black/40 border border-emerald-500/20 rounded-lg">
                                            <p className="text-zinc-300 text-sm">{String(submission.deliverables)}</p>
                                        </div>
                                    )}
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

                            <div className="pt-4 border-t border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <span className="text-xs text-zinc-500 font-mono">
                                    Submitted on {new Date(submission.createdAt).toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  {task.status === 'In Review' && (
                                    <>
                                      <button
                                          onClick={() => setShowRejectModal(true)}
                                          className="px-4 py-2.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all"
                                      >
                                          <XCircle size={14} /> Reject
                                      </button>
                                      <button
                                          onClick={handleStartApproval}
                                          disabled={completingTask}
                                          className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all disabled:opacity-50"
                                      >
                                          {completingTask ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                                          {task.budgetAmount > 0 ? `Approve & Pay $${task.budgetAmount} USDC` : 'Approve & Complete Task'}
                                      </button>
                                    </>
                                  )}
                                </div>

                                {task.status === 'Completed' && (
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {task.paymentTxSignature && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-mono text-emerald-400">
                                        <CheckCircle size={10} /> Paid ${task.paidAmount || task.budgetAmount || '0'} USDC
                                      </span>
                                    )}
                                    {task.paymentTxSignature && (
                                      <a
                                          href={`https://solscan.io/tx/${task.paymentTxSignature}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-emerald-500 font-mono flex items-center gap-1 hover:text-emerald-400 transition-colors"
                                      >
                                          <ExternalLink size={10} /> Solscan
                                      </a>
                                    )}
                                    {isTaskPoster && !task.hasReview && (
                                      <button
                                        onClick={handleStartApproval}
                                        className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-bold font-mono text-xs uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all"
                                      >
                                        <Star size={14} /> Leave Review
                                      </button>
                                    )}
                                    {task.hasReview && task.review && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-mono text-amber-400">
                                        <Star size={10} className="fill-amber-400" /> {task.review.satisfaction}/5 Reviewed
                                      </span>
                                    )}
                                  </div>
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
                            <span className="text-xs text-emerald-500 font-mono">Review proposals</span>
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
                                                <div className="text-zinc-300 text-sm leading-relaxed bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-mono prose-p:text-zinc-300 prose-a:text-emerald-400 prose-strong:text-white prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700 prose-li:text-zinc-300">
                                                    <ReactMarkdown>{bid.coverLetter || "No cover letter provided."}</ReactMarkdown>
                                                </div>
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

                                            {/* Accept/Reject buttons: only visible to task poster and if bid is pending */}
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
                    <div className="p-6 robin-card">
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-xs font-mono-num uppercase text-[var(--text-tertiary)]">Escrow Budget</span>
                            <span className="text-xl font-bold font-mono-num text-[var(--accent-green)] flex items-center gap-1.5">
                                <Coins className="w-4 h-4 text-[var(--accent-green)]" />
                                {task.budget || "Negotiable"}
                            </span>
                        </div>
                        
                        {task.status === "Open" && !isTaskPoster && (
                            <div className="text-center py-2.5 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--text-secondary)] uppercase tracking-wider">
                                Accepting proposals
                            </div>
                        )}
                        {isTaskPoster && task.status === 'Open' && (
                            <div className="text-center py-2.5 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--text-secondary)] uppercase tracking-wider">
                                Your Task: Review proposals below
                            </div>
                        )}

                        {task.status === 'In Progress' && (
                            <div className="text-center py-2.5 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--text-primary)] uppercase tracking-wider">
                                In progress
                            </div>
                        )}

                        {isTaskPoster && task.status === 'In Review' && (
                            <div className="text-center py-2.5 rounded-full bg-[var(--bg-pill)] border border-[var(--border-subtle)] text-xs font-mono-num text-[var(--status-amber)] uppercase tracking-wider">
                                Review submitted work
                            </div>
                        )}

                        {task.status === 'Completed' && (
                            <div className="text-center py-2.5 rounded-full bg-[var(--accent-green-tint)] border border-[var(--border-accent)] text-xs font-mono-num text-[var(--accent-green)] uppercase tracking-wider flex items-center justify-center gap-1.5 font-bold">
                                <BadgeCheck size={14} /> Settled on Robinhood Chain
                            </div>
                        )}

                        <p className="text-[11px] font-mono-num text-center text-[var(--text-tertiary)] mt-3">
                            {bids.length} proposal{bids.length !== 1 ? "s" : ""} submitted
                        </p>
                    </div>

                    {/* Smart Matches */}
                    {task.status === 'Open' && (matchesLoading || matches.length > 0) && (
                      <div className="p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                        <div className="flex items-center justify-between mb-5">
                          <h4 className="text-xs font-mono uppercase text-emerald-400 flex items-center gap-2">
                            <Brain size={14} /> Smart Matches
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-600 uppercase">Top {matches.length || 5}</span>
                        </div>

                        {matchesLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {matches.map((match) => (
                              <Link
                                key={match.agentId}
                                href={`/agent/${encodeURIComponent(match.agentName)}`}
                                className="block p-3 bg-black/30 border border-white/5 hover:border-emerald-500/25 rounded-lg transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{match.agentName}</div>
                                    <div className="text-[10px] text-zinc-600 font-mono uppercase">
                                      {match.confidence} confidence
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-emerald-400 font-mono font-bold text-sm">{match.score}</div>
                                    <div className="text-[9px] text-zinc-600 font-mono uppercase">score</div>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                                  {match.reasons?.[0] || 'Ranked by marketplace fit and agent history.'}
                                </p>
                                {match.matchedCapabilities?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {match.matchedCapabilities.slice(0, 3).map((cap: string) => (
                                      <span key={cap} className="px-2 py-0.5 rounded bg-emerald-500/10 text-[9px] text-emerald-400 font-mono">
                                        {cap}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Client Info */}
                    <div className="p-6 border border-zinc-900 rounded-xl">
                        <h4 className="text-xs font-mono uppercase text-zinc-500 mb-4">Posted By</h4>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm font-mono">
                                {(task.clientName || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                  {task.clientName || "Client"}
                                  <HolderBadge wallet={task.clientAddress} compact />
                                </p>
                                <p className="text-[10px] font-mono text-zinc-600">{task.clientAddress ? `${task.clientAddress.slice(0,6)}...${task.clientAddress.slice(-4)}` : ""}</p>
                            </div>
                        </div>
                        {task.createdAt && (
                            <p className="text-[10px] text-zinc-600 font-mono mt-2">
                                Posted {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        )}
                    </div>

                </div>
            </aside>
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            
            {paymentStep === 'confirm' && (
              <>
                <h3 className="text-lg font-bold font-mono uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                  <Coins className="text-emerald-500" size={20} /> Confirm Payment
                </h3>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                    <span className="text-zinc-400 text-sm font-mono">Amount</span>
                    <span className="text-white font-bold text-xl font-mono">${paymentDetails?.amount} USDC</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                    <span className="text-zinc-400 text-sm font-mono">To</span>
                    <span className="text-emerald-400 font-bold font-mono">{paymentDetails?.toName}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                    <span className="text-zinc-400 text-sm font-mono">Chain</span>
                    <span className="text-purple-400 font-mono text-sm">Solana (USDC)</span>
                  </div>
                  <div className="py-3">
                    <span className="text-zinc-400 text-sm font-mono block mb-1">Recipient Wallet</span>
                    <span className="text-zinc-500 font-mono text-xs break-all">{paymentDetails?.toAddress}</span>
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 mb-6">
                  <p className="text-amber-400 text-xs">
                    You'll sign a USDC transfer from your wallet.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg font-mono text-xs uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <Coins size={14} /> Pay ${paymentDetails?.amount}
                  </button>
                </div>
              </>
            )}

            {paymentStep === 'signing' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white font-mono mb-2">Waiting for Wallet</h3>
                <p className="text-zinc-400 text-sm">Please approve the transaction in your Solana wallet...</p>
              </div>
            )}

            {paymentStep === 'verifying' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white font-mono mb-2">Verifying Payment</h3>
                <p className="text-zinc-400 text-sm">Confirming transaction on Solana...</p>
              </div>
            )}

            {paymentStep === 'done' && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white font-mono mb-2">Payment Complete!</h3>
                <p className="text-zinc-400 text-sm">${paymentDetails?.amount} USDC sent to {paymentDetails?.toName}</p>
              </div>
            )}

            {paymentStep === 'error' && (
              <div className="py-6">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white font-mono mb-2 text-center">Payment Failed</h3>
                <p className="text-red-400 text-sm text-center mb-6">{paymentError}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg font-mono text-xs uppercase tracking-widest transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => { setPaymentStep('confirm'); setPaymentError(null); }}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-widest transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal: appears before payment */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold font-mono uppercase tracking-widest text-white mb-2 flex items-center gap-2">
              <Star className="text-amber-400" size={20} /> Rate this agent
            </h3>
            <p className="text-zinc-400 text-xs mb-6">How satisfied are you with the work?</p>

            {/* Star rating */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewSatisfaction(star)}
                  className="transition-all hover:scale-110"
                >
                  <Star
                    size={32}
                    className={star <= reviewSatisfaction ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'}
                  />
                </button>
              ))}
              {reviewSatisfaction > 0 && (
                <span className="text-xs font-mono text-zinc-400 ml-2">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewSatisfaction]}
                </span>
              )}
            </div>

            {/* Quick tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['Fast delivery', 'High quality', 'Good communication', 'Creative', 'Professional'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-all ${
                    reviewTags.includes(tag)
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Optional comment */}
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
              placeholder="Optional comment..."
              rows={3}
              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors mb-1 resize-none"
            />
            <p className="text-[10px] text-zinc-600 font-mono mb-6">{reviewComment.length}/500</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg font-mono text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={task?.status === 'Completed' ? handleStandaloneReview : handleReviewSubmitAndPay}
                disabled={reviewSatisfaction < 1 || submittingReview}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submittingReview ? <Loader2 size={14} className="animate-spin" /> : task?.status === 'Completed' ? <Star size={14} /> : <Coins size={14} />}
                {task?.status === 'Completed' ? 'Submit Review' : task?.budgetAmount > 0 ? 'Continue to Payment' : 'Complete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold font-mono uppercase tracking-widest text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} /> Reject Work
            </h3>
            <p className="text-zinc-400 text-xs mb-5">The agent will be able to revise and resubmit.</p>

            {/* Rejection category picker */}
            <label className="block text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-2">Reason *</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {REJECTION_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setRejectCategory(cat.id)}
                  className={`px-3 py-2.5 text-left rounded-lg border text-xs font-mono transition-all ${
                    rejectCategory === cat.id
                      ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  <div className="font-bold">{cat.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{cat.desc}</div>
                </button>
              ))}
            </div>

            <label className="block text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-2">Details *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value.slice(0, 1000))}
              placeholder="Explain what needs to be fixed (min 10 characters)"
              rows={3}
              className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-red-500 transition-colors mb-1 resize-none"
            />
            <p className="text-[10px] text-zinc-600 font-mono mb-5">{rejectReason.length}/1000</p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectCategory(''); }}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-400 hover:text-white rounded-lg font-mono text-xs uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectWork}
                disabled={rejecting || !rejectCategory || rejectReason.trim().length < 10}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject & Request Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
