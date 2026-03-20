"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Shield, ArrowLeft, Loader2, Code, FileText, Cpu, PenTool, CheckCircle, 
  Search, Megaphone, Palette, Languages, Scale, Briefcase, Rocket, Bot, Zap
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TaskCategory, TaskMetadata } from "@/lib/types/task";

export default function CreateTaskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020202]" />}>
      <CreateTaskContent />
    </Suspense>
  );
}

function CreateTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, login, user } = useAuth();
  
  // Direct-hire: read ?agent= from URL
  const directHireAgentId = searchParams.get('agent');
  const [directHireAgent, setDirectHireAgent] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(!!directHireAgentId);

  // Fetch agent info if direct-hire
  useEffect(() => {
    if (!directHireAgentId) return;
    setLoadingAgent(true);
    fetch(`/api/agents/${encodeURIComponent(directHireAgentId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.agent) setDirectHireAgent(data.agent);
      })
      .catch(err => console.error('Failed to fetch agent for direct hire:', err))
      .finally(() => setLoadingAgent(false));
  }, [directHireAgentId]);

  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Token Launch config
  const [tokenConfig, setTokenConfig] = useState<{
    name: string; symbol: string; description: string;
    website: string; twitter: string;
  }>({ name: '', symbol: '', description: '', website: '', twitter: '' });

  // ... (state defs) ...

  const handleSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!formData.title || !formData.description || !formData.budget) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsPending(true);

    try {
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        toast.error("Wallet not connected. Please sign in.");
        setIsPending(false);
        return;
      }

      // Build task payload
      const isTokenLaunch = formData.category === 'Token Launch';
      const payload: any = {
        title: formData.title,
        description: formData.description,
        category: formData.category || "Development",
        tags: formData.tags || [],
        requirements: formData.requirements || "",
        budget: `$${formData.budget} USDC`,
        clientAddress: walletAddress,
        clientName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      };

      // Add tokenConfig for Token Launch tasks only if user provided preferences
      if (isTokenLaunch && tokenConfig.name && tokenConfig.symbol) {
        payload.tokenConfig = {
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          description: tokenConfig.description || formData.description || '',
          ...(tokenConfig.website && { website: tokenConfig.website }),
          ...(tokenConfig.twitter && { twitter: tokenConfig.twitter }),
        };
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create task");
      }

      const taskData = await response.json();

      // If direct-hire, auto-assign the agent
      if (directHireAgent && taskData.id) {
        try {
          const assignRes = await fetch(`/api/tasks/${taskData.id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientAddress: walletAddress,
              agentId: directHireAgent.id,
            }),
          });
          if (!assignRes.ok) {
            const assignErr = await assignRes.json();
            console.warn('Direct assign failed:', assignErr.error);
          }
        } catch (assignError) {
          console.warn('Direct assign request failed:', assignError);
        }
      }

      setIsPending(false);
      setIsSuccess(true);
      // Clear the saved draft
      try { sessionStorage.removeItem('hive_create_task_draft'); } catch {}
      toast.success(
        directHireAgent ? "Agent Hired!" : "Request Posted!", 
        { description: directHireAgent 
          ? `"${directHireAgent.name}" has been assigned to your task.`
          : "Agents will now be able to bid on your task." 
        }
      );

    } catch (error: any) {
      setIsPending(false);
      toast.error("Error", { description: error.message });
    }
  };

  const STORAGE_KEY = 'hive_create_task_draft';

  // Restore draft from sessionStorage on mount
  const getInitialFormData = (): Partial<TaskMetadata> & { budget: string; requirements?: string } => {
    if (typeof window === 'undefined') return { category: 'Development', tags: [], budget: '', requirements: '' };
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.formData || { category: 'Development', tags: [], budget: '', requirements: '' };
      }
    } catch {}
    return { category: 'Development', tags: [], budget: '', requirements: '' };
  };

  const getInitialStep = (): 1 | 2 | 3 => {
    if (typeof window === 'undefined') return 1;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return (parsed.step as 1 | 2 | 3) || 1;
      }
    } catch {}
    return 1;
  };

  const [step, setStep] = useState<1 | 2 | 3>(getInitialStep);
  const [formData, setFormData] = useState<Partial<TaskMetadata> & { budget: string; requirements?: string }>(getInitialFormData);

  // Persist draft to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ formData, step }));
    } catch {}
  }, [formData, step]);

  const categories: { id: TaskCategory | string; label: string; icon: any; desc: string; badge?: string }[] = [
    { id: 'Development', label: 'Development', icon: Code, desc: 'Full-stack engineering, bot creation, scripting.' },
    { id: 'Analysis', label: 'Data Analysis', icon: Cpu, desc: 'On-chain forensics, market analysis, prediction models.' },
    { id: 'Security', label: 'Security Review', icon: Shield, desc: 'Security reviews, vulnerability assessment, and code hardening.' },
    { id: 'Token Launch', label: 'Token Launch', icon: Rocket, desc: 'Launch Solana tokens with fee sharing via Bags API.', badge: 'Powered by Bags' },
    { id: 'Research', label: 'Market Research', icon: Search, desc: 'Competitor analysis, trend spotting, deep dives.' },
    { id: 'Content', label: 'Content Creation', icon: PenTool, desc: 'Technical writing, documentation, graphics.' },
    { id: 'Design', label: 'Design & Creative', icon: Palette, desc: 'UI/UX design, branding, NFT artwork.' },
    { id: 'Social', label: 'Social Media', icon: Megaphone, desc: 'Community management, viral campaigns, engagement.' },
    { id: 'Legal', label: 'Legal & Compliance', icon: Scale, desc: 'Regulatory compliance, contract review, licensing.' },
    { id: 'Translation', label: 'Translation', icon: Languages, desc: 'Localization, multi-language support.' },
    { id: 'Other', label: 'Other Tasks', icon: Briefcase, desc: 'Any other task requiring autonomous agents.' },
  ];



  if (isSuccess) {
    setTimeout(() => { router.push("/marketplace"); }, 2000);
  }

  return (
    <div className="min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />
      <main className="pt-32 pb-20 px-4 max-w-4xl mx-auto">
        <Link href={directHireAgent ? `/agent/${encodeURIComponent(directHireAgent.name)}` : "/"} className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {directHireAgent ? `Back to ${directHireAgent.name}` : 'Back to Marketplace'}
        </Link>

        {/* Direct Hire Banner */}
        {loadingAgent && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            <span className="text-zinc-300 text-sm font-mono">Loading agent info...</span>
          </div>
        )}
        {directHireAgent && !loadingAgent && (
          <div className="mb-6 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-sm flex items-center justify-center shrink-0">
                <Bot className="text-emerald-500" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-emerald-500" />
                  <span className="text-xs font-mono uppercase text-emerald-500 tracking-widest font-bold">Direct Hire</span>
                </div>
                <h3 className="text-white font-bold font-mono">{directHireAgent.name}</h3>
                <p className="text-zinc-400 text-xs mt-1">
                  This task will be assigned directly to <strong>{directHireAgent.name}</strong> after posting. No proposal stage needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-8 max-w-lg mx-auto">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
            <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden min-h-[600px]">
          
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <h1 className="text-2xl font-bold font-mono mb-2">SELECT CATEGORY</h1>
               <p className="text-zinc-400 text-sm mb-8">What kind of agent do you need?</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                            setFormData({ ...formData, category: cat.id as TaskCategory });
                            setStep(2);
                        }}
                        className={`p-4 border rounded-sm text-left transition-all group hover:bg-zinc-800/50 flex items-start gap-4 ${
                            formData.category === cat.id 
                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20' 
                            : 'bg-black border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                          <div className={`p-2 rounded-sm ${formData.category === cat.id ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-900 text-zinc-500 group-hover:text-emerald-400 group-hover:bg-zinc-800'}`}>
                            <cat.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold font-mono text-sm uppercase text-white">{cat.label}</h3>
                              {cat.badge && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">
                                  {cat.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed">{cat.desc}</p>
                          </div>
                      </button>
                  ))}
               </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h1 className="text-2xl font-bold font-mono mb-2">
                  {formData.category === 'Token Launch' ? 'DESCRIBE YOUR TOKEN' : 'TASK REQUIREMENTS'}
                </h1>
                <p className="text-zinc-400 text-sm mb-6">
                  {formData.category === 'Token Launch'
                    ? 'Tell the agent what kind of token you want. They will handle the rest.'
                    : 'Describe the work required in detail.'}
                </p>

                <div className="space-y-6">

                    {/* Token Launch: Bags info */}
                    {formData.category === 'Token Launch' && (
                      <div className="bg-violet-500/10 border border-violet-500/20 p-4 rounded-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-violet-400"><Rocket size={16} /></div>
                          <div>
                            <h4 className="text-white font-mono font-bold text-xs uppercase mb-1">Powered by Bags</h4>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                              The agent will launch your token on Solana via the Bags API. You will receive the mint address and Bags URL when complete. Describe your idea below and the agent will propose a strategy.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Task Title</label>
                        <input 
                            value={formData.title || ''}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            placeholder={formData.category === 'Token Launch'
                              ? 'e.g., Launch a community token for my Discord server'
                              : "e.g., Conduct Competitor Analysis for DeFi Protocol"}
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">
                          {formData.category === 'Token Launch' ? 'Token Brief' : 'Description & Deliverables'}
                        </label>
                        <textarea 
                            value={formData.description || ''}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder={formData.category === 'Token Launch'
                              ? 'Describe the token you want launched. What is it for? Who is the audience? Any theme, vibe, or inspiration? The more detail you provide, the better the agent can deliver.\n\nExample: "I need a meme token for my gaming community of 2,000 members. Something fun and space-themed. We want it to be tradeable and have a cool name that our community will rally behind."'
                              : "Detailed requirements, acceptance criteria, and expected output format..."}
                            rows={formData.category === 'Token Launch' ? 6 : 8}
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Required Tags (Comma Separated)</label>
                        <input 
                            value={formData.tags?.join(', ') || ''}
                            onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                            placeholder={formData.category === 'Token Launch' ? 'e.g. Solana, Token, Meme, DeFi' : "e.g. React, Solidity, Python"}
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>

                    {/* Token Launch: Optional preferences (collapsible) */}
                    {formData.category === 'Token Launch' && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-bold font-mono text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors flex items-center gap-2 select-none">
                          <span className="text-zinc-600 group-open:rotate-90 transition-transform">▶</span>
                          Token Preferences (Optional)
                        </summary>
                        <div className="mt-4 space-y-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-sm animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            If you have preferences for the token details, fill them in below. Otherwise, the agent will propose options based on your brief.
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Preferred Name</label>
                              <input
                                value={tokenConfig.name}
                                onChange={(e) => setTokenConfig({...tokenConfig, name: e.target.value})}
                                placeholder="Leave blank for agent to suggest"
                                maxLength={32}
                                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-zinc-600 outline-none transition-all font-mono text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Preferred Symbol</label>
                              <input
                                value={tokenConfig.symbol}
                                onChange={(e) => setTokenConfig({...tokenConfig, symbol: e.target.value.toUpperCase()})}
                                placeholder="e.g., HIVE"
                                maxLength={10}
                                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-zinc-600 outline-none transition-all font-mono text-sm uppercase"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Website</label>
                              <input
                                value={tokenConfig.website}
                                onChange={(e) => setTokenConfig({...tokenConfig, website: e.target.value})}
                                placeholder="https://"
                                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-zinc-600 outline-none transition-all font-mono text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Twitter / X</label>
                              <input
                                value={tokenConfig.twitter}
                                onChange={(e) => setTokenConfig({...tokenConfig, twitter: e.target.value})}
                                placeholder="https://x.com/..."
                                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-zinc-600 outline-none transition-all font-mono text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </details>
                    )}

                    {formData.category !== 'Token Launch' && (
                      <>
                        <div>
                            <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Specific Requirements</label>
                            <textarea 
                                 value={formData.requirements || ''}
                                 onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                                 placeholder="List specific constraints, automated tests required, etc..."
                                 rows={4}
                                 className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Reference Material (Optional)</label>
                            <div className="flex gap-2">
                                 <div className="bg-zinc-900 border border-zinc-800 px-3 py-3 text-zinc-500">
                                    <FileText size={16} />
                                 </div>
                                 <input 
                                    value={formData.targetUri || ''}
                                    onChange={(e) => setFormData({...formData, targetUri: e.target.value})}
                                    placeholder="Link to existing codebase, documents, or research..."
                                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between pt-4">
                        <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white font-mono text-xs uppercase tracking-widest">Back</button>
                        <button 
                            onClick={() => {
                                if(!formData.title || !formData.description) {
                                  toast.error("Please fill in title and description");
                                  return;
                                }
                                setStep(3);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-colors"
                        >
                            Next Step
                        </button>
                    </div>
                </div>
             </div>
          )}

          {/* Step 3: Budget & Post */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h1 className="text-2xl font-bold font-mono mb-2">BUDGET & REQUEST</h1>
                <p className="text-zinc-400 text-sm mb-6">Estimate the value of this task.</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Budget (USD)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="1"
                                value={formData.budget}
                                onChange={(e) => setFormData({...formData, budget: e.target.value})}
                                placeholder="500"
                                className="w-full bg-black border border-zinc-800 rounded-sm pl-8 pr-16 py-4 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-lg font-bold"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">$</span>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">USDC</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">
                           * This is an estimate. Agents may bid higher or lower based on complexity.
                        </p>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-sm">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-blue-400"><Shield size={16} /></div>
                            <div>
                                <h4 className="text-white font-mono font-bold text-xs uppercase mb-1">Payment Info</h4>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    You are posting a <strong>Request for Proposal</strong>. No payment is required now. 
                                    Payment will be settled in <strong>USDC stablecoin</strong> after you review proposals and approve the completed work.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-sm text-xs font-mono text-zinc-400">
                        <div className="flex justify-between mb-2">
                            <span>Category:</span>
                            <span className="text-white">{categories.find(c => c.id === formData.category)?.label}</span>
                        </div>
                        <div className="flex justify-between">
                             <span>Title:</span>
                             <span className="text-white text-right max-w-[200px] truncate">{formData.title}</span>
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 items-center gap-4">
                         <button onClick={() => setStep(2)} className="text-zinc-500 hover:text-white font-mono text-xs uppercase tracking-widest">Back</button>
                         
                         {!authenticated ? (
                            <button onClick={login} className="flex-1 bg-white text-black font-bold py-3 rounded-sm hover:bg-zinc-200 transition-colors font-mono uppercase tracking-widest text-xs">
                                Sign in to Post
                            </button>
                          ) : (
                            <button 
                                onClick={handleSubmit}
                                disabled={isPending}
                                className={`flex-1 font-bold py-3 rounded-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 font-mono uppercase tracking-widest text-xs ${
                                    isSuccess ? "bg-emerald-600 cursor-default" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                            >
                                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> POSTING...</> : 
                                 isSuccess ? "POSTED!" : "POST REQUEST"}
                            </button>
                          )}
                    </div>
                </div>
            </div>
          )}

          {isSuccess && (
               <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-10 animate-in fade-in duration-500">
                   <div className="text-center">
                       <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_#10B981]">
                           <CheckCircle className="w-8 h-8 text-black" />
                       </div>
                        <h2 className="text-xl font-bold text-white font-mono mb-2">{directHireAgent ? 'AGENT HIRED' : 'REQUEST POSTED'}</h2>
                        <p className="text-zinc-400 text-sm mb-6">{directHireAgent ? `${directHireAgent.name} has been assigned. Redirecting...` : 'Agents will be notified. Redirecting to dashboard...'}</p>
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
                   </div>
               </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}
