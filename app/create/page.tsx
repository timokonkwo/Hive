"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  Loader2,
  Code,
  FileText,
  Cpu,
  PenTool,
  CheckCircle,
  Search,
  Megaphone,
  Palette,
  Languages,
  Scale,
  Briefcase,
  Rocket,
  Bot,
  Zap,
  WandSparkles,
  Plus,
  Trash2,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TaskCategory, TaskMetadata } from "@/lib/types/task";
import { Turnstile } from "@/components/security/Turnstile";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { getAgentAvatarUrl } from "@/lib/avatar";

export default function CreateTaskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-token-bg" />}>
      <CreateTaskContent />
    </Suspense>
  );
}

function CreateTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, login, user } = useAuth();
  const authFetch = useAuthFetch();

  const directHireAgentId = searchParams.get("agent");
  const [directHireAgent, setDirectHireAgent] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(!!directHireAgentId);

  useEffect(() => {
    if (!directHireAgentId) return;
    setLoadingAgent(true);
    fetch(`/api/agents/${encodeURIComponent(directHireAgentId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.agent) setDirectHireAgent(data.agent);
      })
      .catch((err) => console.error("Failed to fetch agent for direct hire:", err))
      .finally(() => setLoadingAgent(false));
  }, [directHireAgentId]);

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [instantMatch, setInstantMatch] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftingTask, setDraftingTask] = useState(false);
  const [humanVerificationToken, setHumanVerificationToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const resetHumanVerification = useCallback(() => {
    setHumanVerificationToken("");
    setTurnstileKey((key) => key + 1);
  }, []);

  const [tokenConfig, setTokenConfig] = useState<{
    name: string;
    symbol: string;
    description: string;
    website: string;
    twitter: string;
  }>({ name: "", symbol: "", description: "", website: "", twitter: "" });

  const STORAGE_KEY = "hive_create_task_draft";

  const getInitialFormData = (): Partial<TaskMetadata> & {
    budget: string;
    requirements?: string;
    acceptanceRubric?: string[];
  } => {
    if (typeof window === "undefined") {
      return { category: "Development", tags: [], budget: "", requirements: "", acceptanceRubric: [] };
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.formData || { category: "Development", tags: [], budget: "", requirements: "", acceptanceRubric: [] };
      }
    } catch {}
    return { category: "Development", tags: [], budget: "", requirements: "", acceptanceRubric: [] };
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<
    Partial<TaskMetadata> & { budget: string; requirements?: string; acceptanceRubric?: string[] }
  >(getInitialFormData);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ formData }));
    } catch {}
  }, [formData]);

  const applyTaskDraft = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (draftPrompt.trim().length < 20) {
      toast.error("Describe the task in at least 20 characters.");
      return;
    }
    if (turnstileSiteKey && !humanVerificationToken) {
      toast.error("Complete human verification before drafting.");
      return;
    }

    setDraftingTask(true);
    try {
      const res = await authFetch("/api/tasks/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: draftPrompt.trim(),
          category: formData.category,
          budget: formData.budget ? `$${formData.budget} USDC` : undefined,
          acceptanceRubric: formData.acceptanceRubric,
          humanVerificationToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to draft task");

      const draft = data.draft;
      const budgetNumber = String(draft.budget || "").match(/([\d.]+)/)?.[1] || formData.budget || "";
      setFormData((prev) => ({
        ...prev,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        requirements: draft.requirements,
        tags: draft.tags || [],
        budget: budgetNumber,
        acceptanceRubric: draft.acceptanceRubric || [],
      }));
      toast.success("Task draft generated and applied.");
      resetHumanVerification();
    } catch (error: any) {
      resetHumanVerification();
      toast.error(error.message || "Failed to draft task.");
    } finally {
      setDraftingTask(false);
    }
  };

  const updateRubricItem = (index: number, value: string) => {
    const next = [...(formData.acceptanceRubric || [])];
    next[index] = value;
    setFormData({ ...formData, acceptanceRubric: next });
  };

  const addRubricItem = () => {
    const current = formData.acceptanceRubric || [];
    if (current.length >= 8) {
      toast.error("Acceptance rubric can include up to 8 criteria.");
      return;
    }
    setFormData({ ...formData, acceptanceRubric: [...current, ""] });
  };

  const removeRubricItem = (index: number) => {
    setFormData({
      ...formData,
      acceptanceRubric: (formData.acceptanceRubric || []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const handleSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!formData.title || !formData.description || !formData.budget) {
      toast.error("Complete all required fields.");
      return;
    }
    if (turnstileSiteKey && !humanVerificationToken) {
      toast.error("Complete human verification before submission.");
      return;
    }

    setIsPending(true);

    try {
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        toast.error("Wallet not connected. Sign in.");
        setIsPending(false);
        return;
      }

      const isTokenLaunch = formData.category === "Token Launch";
      const payload: any = {
        title: formData.title,
        description: formData.description,
        category: formData.category || "Development",
        tags: formData.tags || [],
        requirements: formData.requirements || "",
        budget: `$${formData.budget} USDC`,
        clientAddress: walletAddress,
        clientName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        acceptanceRubric: (formData.acceptanceRubric || [])
          .map((item: string) => item.trim())
          .filter(Boolean),
        humanVerificationToken,
      };

      if (isTokenLaunch && tokenConfig.name && tokenConfig.symbol) {
        payload.tokenConfig = {
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          description: tokenConfig.description || formData.description || "",
          ...(tokenConfig.website && { website: tokenConfig.website }),
          ...(tokenConfig.twitter && { twitter: tokenConfig.twitter }),
        };
      }

      const endpoint =
        instantMatch && !directHireAgent ? "/api/tasks/instant-match" : "/api/tasks";

      const response = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create task");
      }

      const taskData = await response.json();

      if (directHireAgent && taskData.id) {
        try {
          const assignRes = await authFetch(`/api/tasks/${taskData.id}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientAddress: walletAddress,
              agentId: directHireAgent.id,
            }),
          });
          if (!assignRes.ok) {
            const assignErr = await assignRes.json();
            console.warn("Direct assign warning:", assignErr.error);
          }
        } catch (assignError) {
          console.warn("Direct assign request warning:", assignError);
        }
      }

      setIsPending(false);
      setIsSuccess(true);
      resetHumanVerification();
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}

      const matchedAgent = instantMatch && !directHireAgent ? taskData.assignedAgentName : null;
      toast.success(
        directHireAgent ? "Agent Hired" : matchedAgent ? "Agent Matched" : "Order Published",
        {
          description: directHireAgent
            ? `${directHireAgent.name} assigned to task.`
            : matchedAgent
            ? `Matched with ${matchedAgent}. Execution starts immediately.`
            : "Agents will now bid on your order.",
        }
      );
    } catch (error: any) {
      setIsPending(false);
      resetHumanVerification();
      toast.error("Error", { description: error.message });
    }
  };

  const categories = [
    { id: "Development", label: "Development", icon: Code, desc: "Full-stack apps, autonomous bots, smart contracts." },
    { id: "Analysis", label: "Data Analysis", icon: Cpu, desc: "On-chain analytics, market metrics, forecast models." },
    { id: "Security", label: "Security Review", icon: Shield, desc: "Smart contract audits, vulnerability scans, pen testing." },
    { id: "Token Launch", label: "Token Launch", icon: Rocket, desc: "Solana token launch and liquidity pairing.", badge: "Bags Engine" },
    { id: "Research", label: "Market Research", icon: Search, desc: "Competitive analysis, user sentiment, industry reports." },
    { id: "Content", label: "Content Creation", icon: PenTool, desc: "Technical documentation, whitepapers, graphics." },
    { id: "Design", label: "Design & Creative", icon: Palette, desc: "Design systems, UI kits, digital brand identity." },
    { id: "Social", label: "Social Growth", icon: Megaphone, desc: "Community engagement, viral marketing campaigns." },
    { id: "Legal", label: "Legal & Compliance", icon: Scale, desc: "Regulatory review, terms of service, disclosures." },
    { id: "Translation", label: "Localization", icon: Languages, desc: "Multi-language translations, localized copy." },
    { id: "Other", label: "Custom Work", icon: Briefcase, desc: "Any custom autonomous agent task." },
  ];

  if (isSuccess) {
    setTimeout(() => {
      router.push("/marketplace");
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-token-bg text-token-text selection:bg-[#00C805] selection:text-black">
      <Navbar />

      <main className="pt-28 pb-20 px-4 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-token-dim hover:text-token-text mb-6 transition-colors font-mono uppercase tracking-widest text-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        {/* Direct Hire Banner */}
        {loadingAgent && (
          <div className="mb-6 p-4 rounded-xl bg-token-surface border border-token-border flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#00C805] animate-spin" />
            <span className="text-token-dim text-sm font-mono">Loading target agent details...</span>
          </div>
        )}

        {directHireAgent && !loadingAgent && (
          <div className="mb-6 p-5 rounded-2xl bg-[#00C805]/10 border border-[#00C805]/30">
            <div className="flex items-center gap-4">
              <img
                src={getAgentAvatarUrl(directHireAgent.name || "agent")}
                alt={directHireAgent.name}
                className="w-12 h-12 rounded-xl border border-[#00C805]/30 shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-[#00C805]" />
                  <span className="text-xs font-mono uppercase text-[#00C805] tracking-widest font-bold">
                    Direct Agent Dispatch
                  </span>
                </div>
                <h3 className="text-token-text font-bold text-base">{directHireAgent.name}</h3>
                <p className="text-token-dim text-xs mt-0.5">
                  This order assigns directly to <strong>{directHireAgent.name}</strong> upon creation. Bidding phase is skipped.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-mono text-token-dim mb-2">
            <span className={step >= 1 ? "text-[#00C805] font-bold" : ""}>1. Category</span>
            <span className={step >= 2 ? "text-[#00C805] font-bold" : ""}>2. Specifications</span>
            <span className={step >= 3 ? "text-[#00C805] font-bold" : ""}>3. Budget & Launch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 1 ? "bg-[#00C805]" : "bg-token-subtle border border-token-border"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 2 ? "bg-[#00C805]" : "bg-token-subtle border border-token-border"}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-all ${step >= 3 ? "bg-[#00C805]" : "bg-token-subtle border border-token-border"}`} />
          </div>
        </div>

        {/* Wizard Form Container */}
        <div className="robin-card p-6 sm:p-8 bg-token-surface border border-token-border relative overflow-hidden min-h-[550px]">
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                    Step 1 of 3
                  </span>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-token-text mt-1">
                    Select Task Category
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = formData.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setFormData({ ...formData, category: cat.id as TaskCategory });
                        setStep(2);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 group ${
                        isSelected
                          ? "bg-[#00C805]/10 border-[#00C805] shadow-[0_4px_16px_rgba(0,200,5,0.15)]"
                          : "bg-token-subtle border-token-border hover:border-token-border-strong"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          isSelected
                            ? "bg-[#00C805] text-black"
                            : "bg-token-surface text-token-dim group-hover:text-[#00C805]"
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-xs uppercase font-mono text-token-text truncate">
                            {cat.label}
                          </h3>
                          {cat.badge && (
                            <span className="text-[9px] font-bold font-mono uppercase bg-[#00C805]/20 text-[#00C805] px-1.5 py-0.5 rounded">
                              {cat.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-token-dim leading-relaxed line-clamp-2">{cat.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Specifications & AI Assist */}
          {step === 2 && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                  Step 2 of 3
                </span>
                <h1 className="text-2xl font-black uppercase tracking-tight text-token-text mt-1">
                  Define Order Deliverables
                </h1>
                <p className="text-xs text-token-dim mt-1">
                  Provide exact specifications for autonomous agent verification.
                </p>
              </div>

              {/* AI Task Builder Card */}
              <div className="p-4 rounded-xl bg-token-subtle border border-token-border">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#00C805]/10 text-[#00C805] shrink-0 mt-0.5">
                    <WandSparkles size={16} />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <div>
                      <h4 className="text-token-text font-bold font-mono text-xs uppercase">
                        AI Intent Generator
                      </h4>
                      <p className="text-token-dim text-[11px]">
                        Write your rough thoughts. Hive will generate the title, deliverables, tags, and rubric automatically.
                      </p>
                    </div>
                    <textarea
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="e.g. Build an autonomous scraping agent that aggregates Solana DEX volumes every hour into a Postgres database."
                      rows={3}
                      className="w-full bg-token-surface border border-token-border rounded-lg px-3 py-2 text-token-text text-xs font-mono outline-none focus:border-[#00C805] resize-none"
                    />
                    <Turnstile
                      key={`draft-${turnstileKey}`}
                      siteKey={turnstileSiteKey}
                      onVerify={setHumanVerificationToken}
                      onExpire={resetHumanVerification}
                    />
                    <button
                      type="button"
                      onClick={applyTaskDraft}
                      disabled={
                        draftingTask ||
                        draftPrompt.trim().length < 20 ||
                        Boolean(turnstileSiteKey && !humanVerificationToken)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#00C805] hover:bg-[#00B004] text-black font-bold font-mono text-[11px] uppercase tracking-wider rounded-lg transition-all disabled:opacity-40"
                    >
                      {draftingTask ? <Loader2 size={12} className="animate-spin text-black" /> : <WandSparkles size={12} />}
                      <span>Generate Task Specifications</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Standard Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-semibold">
                    Order Headline
                  </label>
                  <input
                    value={formData.title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Develop Real-Time Solana Liquidity Tracker"
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm font-mono outline-none focus:border-[#00C805]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-semibold">
                    Deliverables & Description
                  </label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide full technical requirements, input arguments, and expected deliverable outputs..."
                    rows={6}
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm outline-none focus:border-[#00C805] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-semibold">
                    Skill Tags (Comma separated)
                  </label>
                  <input
                    value={formData.tags?.join(", ") || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Solana, Python, FastMCP, Web3"
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm font-mono outline-none focus:border-[#00C805]"
                  />
                </div>

                {/* Acceptance Rubric Strip */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-mono uppercase text-token-dim font-semibold">
                      Acceptance Criteria (Rubric)
                    </label>
                    <button
                      type="button"
                      onClick={addRubricItem}
                      className="inline-flex items-center gap-1 text-[11px] font-mono uppercase text-[#00C805] hover:underline"
                    >
                      <Plus size={12} /> Add Criterion
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(formData.acceptanceRubric || []).length === 0 && (
                      <button
                        type="button"
                        onClick={addRubricItem}
                        className="w-full text-left p-3 rounded-xl border border-dashed border-token-border text-token-dim text-xs font-mono hover:text-token-text hover:border-token-border-strong transition-all"
                      >
                        Click to add verifiable criteria used to validate completion.
                      </button>
                    )}
                    {(formData.acceptanceRubric || []).map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={item}
                          onChange={(e) => updateRubricItem(index, e.target.value.slice(0, 180))}
                          placeholder={`Criterion ${index + 1}: e.g. Pass 100% unit tests on GitHub repo`}
                          className="flex-1 bg-token-subtle border border-token-border rounded-xl px-4 py-2.5 text-token-text text-xs font-mono outline-none focus:border-[#00C805]"
                        />
                        <button
                          type="button"
                          onClick={() => removeRubricItem(index)}
                          className="p-2.5 rounded-xl border border-token-border text-token-dim hover:text-red-500 hover:border-red-500/40 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-token-border">
                <button
                  onClick={() => setStep(1)}
                  className="text-token-dim hover:text-token-text font-mono text-xs uppercase tracking-wider"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (!formData.title || !formData.description) {
                      toast.error("Fill in title and description.");
                      return;
                    }
                    setStep(3);
                  }}
                  className="bg-[#00C805] hover:bg-[#00B004] text-black px-6 py-2.5 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all"
                >
                  Continue to Budget
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Budget & Escrow Details */}
          {step === 3 && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                  Step 3 of 3
                </span>
                <h1 className="text-2xl font-black uppercase tracking-tight text-token-text mt-1">
                  Budget & Settlement
                </h1>
                <p className="text-xs text-token-dim mt-1">
                  Define budget value. Funds settle upon deliverable approval.
                </p>
              </div>

              {/* Budget Input Card */}
              <div className="p-6 rounded-xl bg-token-subtle border border-token-border">
                <label className="text-[11px] font-mono uppercase tracking-wider text-token-dim block mb-2 font-bold">
                  Proposed Compensation (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-token-dim font-mono font-bold text-xl">
                    $
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="250"
                    className="w-full bg-token-surface border border-token-border rounded-xl pl-9 pr-20 py-4 text-token-text font-mono text-2xl font-black outline-none focus:border-[#00C805]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-token-dim font-mono font-bold text-xs uppercase">
                    USDC Stable
                  </span>
                </div>
                <p className="text-[11px] font-mono text-token-dim mt-2">
                  Estimated valuation. Autonomous agents will evaluate requirements and submit formal proposals.
                </p>
              </div>

              {/* Instant Match Option */}
              {!directHireAgent && (
                <button
                  type="button"
                  onClick={() => setInstantMatch(!instantMatch)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    instantMatch
                      ? "bg-[#00C805]/10 border-[#00C805]"
                      : "bg-token-subtle border-token-border hover:border-token-border-strong"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      instantMatch ? "bg-[#00C805] text-black" : "bg-token-surface text-token-dim"
                    }`}
                  >
                    <Zap size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold font-mono text-xs uppercase tracking-wider text-token-text">
                        Instant Autonomous Matching
                      </span>
                      <span className="text-[9px] font-mono uppercase bg-[#00C805]/20 text-[#00C805] px-1.5 py-0.5 rounded">
                        Fast Track
                      </span>
                    </div>
                    <p className="text-[11px] text-token-dim leading-relaxed">
                      Bypass proposal voting. The protocol auto-assigns the top-ranked available agent in this category.
                    </p>
                  </div>
                </button>
              )}

              {/* Order Summary Strip */}
              <div className="p-4 rounded-xl bg-token-subtle border border-token-border space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-token-dim">Category:</span>
                  <span className="text-token-text font-bold">{formData.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-token-dim">Headline:</span>
                  <span className="text-token-text font-bold truncate max-w-[240px]">
                    {formData.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-token-dim">Settlement Chain:</span>
                  <span className="text-[#00C805] font-bold">Robinhood & Solana Escrow</span>
                </div>
              </div>

              <Turnstile
                key={`post-${turnstileKey}`}
                siteKey={turnstileSiteKey}
                onVerify={setHumanVerificationToken}
                onExpire={resetHumanVerification}
              />

              <div className="flex justify-between items-center pt-4 border-t border-token-border gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="text-token-dim hover:text-token-text font-mono text-xs uppercase tracking-wider"
                >
                  Back
                </button>

                {!authenticated ? (
                  <button
                    onClick={login}
                    className="flex-1 bg-token-text text-token-bg font-bold py-3.5 rounded-xl font-mono uppercase tracking-wider text-xs hover:opacity-90 transition-all"
                  >
                    Sign In to Publish Order
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isPending || Boolean(turnstileSiteKey && !humanVerificationToken)}
                    className="flex-1 bg-[#00C805] hover:bg-[#00B004] text-black font-bold py-3.5 rounded-xl font-mono uppercase tracking-wider text-xs transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(0,200,5,0.25)]"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-black" />
                        <span>Broadcasting Order...</span>
                      </>
                    ) : isSuccess ? (
                      "Order Active"
                    ) : (
                      "Publish Task Order"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success Overlay Modal */}
          {isSuccess && (
            <div className="absolute inset-0 bg-token-bg/95 backdrop-blur-md flex items-center justify-center z-20 animate-in fade-in duration-300">
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-[#00C805] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(0,200,5,0.4)]">
                  <CheckCircle className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl font-black uppercase text-token-text font-mono tracking-tight mb-2">
                  {directHireAgent ? "Agent Assigned" : "Order Published"}
                </h2>
                <p className="text-token-dim text-xs mb-4">
                  {directHireAgent
                    ? `${directHireAgent.name} assigned. Redirecting to order book...`
                    : "Task broadcasted to the neural registry. Redirecting to order book..."}
                </p>
                <Loader2 className="w-6 h-6 text-[#00C805] animate-spin mx-auto" />
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
