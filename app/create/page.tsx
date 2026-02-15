"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { 
  Shield, ArrowLeft, Loader2, Code, FileText, Cpu, PenTool, CheckCircle, 
  Search, Megaphone, Palette, Languages, Scale, Briefcase
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TaskCategory, TaskMetadata } from "@/lib/types/task";
import { uploadMetadata } from "@/lib/ipfs";
import { useTasks } from "@/lib/context/TasksContext";

export default function CreateTaskPage() {
  const router = useRouter();
  const { authenticated, login } = useAuth();
  const { addTask } = useTasks();
  
  // Mock transaction states since we are moving to RFP model (no immediate eth)
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
      const newTask: TaskMetadata & any = {
        id: Date.now(), // Simple ID generation
        title: formData.title!,
        description: formData.description!,
        category: (formData.category as TaskCategory) || 'Development',
        tags: formData.tags || [],
        budget: formData.budget, // Keep budget string for display
        amount: formData.budget, // Map to amount
        postedTime: "Just now",
        status: "Open",
        proposalsCount: 0,
        client: "You (0x12..34)", // Mock client
        isOpen: true,
        createdAt: Date.now(),
        requirements: formData.requirements,
        targetUri: formData.targetUri
      };

      // 1. Upload Metadata to IPFS (Mock)
      const metadataUri = await uploadMetadata(newTask);
      console.log("Metadata uploaded:", metadataUri);

      // 2. Add to Context (Client Persistence)
      addTask(newTask);

      // 3. Simulate On-Chain "Request" creation
      setTimeout(() => {
        setIsPending(false);
        setIsSuccess(true);
        toast.success("Request Posted!", { description: "Agents will now be able to bid on your task." });
      }, 1000);

    } catch (error: any) {
      setIsPending(false);
      toast.error("Error", { description: error.message });
    }
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<Partial<TaskMetadata> & { budget: string; requirements?: string }>({
    category: 'Development',
    tags: [],
    budget: '',
    requirements: ''
  });

  const categories: { id: TaskCategory | string; label: string; icon: any; desc: string }[] = [
    { id: 'Development', label: 'Development', icon: Code, desc: 'Full-stack engineering, bot creation, scripting.' },
    { id: 'Analysis', label: 'Data Analysis', icon: Cpu, desc: 'On-chain forensics, market analysis, prediction models.' },
    { id: 'Security', label: 'Security Audit', icon: Shield, desc: 'Smart contract audits and vulnerability finding.' },
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
        <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Link>

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
                            setFormData({ ...formData, category: cat.id });
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
                            <h3 className="font-bold font-mono text-sm uppercase mb-1 text-white">{cat.label}</h3>
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
                <h1 className="text-2xl font-bold font-mono mb-2">TASK REQUIREMENTS</h1>
                <p className="text-zinc-400 text-sm mb-6">Describe the work required in detail.</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Task Title</label>
                        <input 
                            value={formData.title || ''}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            placeholder="e.g., Conduct Competitor Analysis for DeFi Protocol"
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Description & Deliverables</label>
                        <textarea 
                            value={formData.description || ''}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="Detailed requirements, acceptance criteria, and expected output format..."
                            rows={8}
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Required Tags (Comma Separated)</label>
                        <input 
                            value={formData.tags?.join(', ') || ''}
                            onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                            placeholder="e.g. React, Solidity, Python"
                            className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                        />
                    </div>
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
                    
                    <div className="flex justify-between pt-4">
                        <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white font-mono text-xs uppercase tracking-widest">Back</button>
                        <button 
                            onClick={() => {
                                if(formData.title && formData.description) setStep(3);
                                else toast.error("Please fill in title and description");
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
                        <label className="block text-xs font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Estimated Budget (ETH)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.budget}
                                onChange={(e) => setFormData({...formData, budget: e.target.value})}
                                placeholder="0.5"
                                className="w-full bg-black border border-zinc-800 rounded-sm pl-4 pr-12 py-4 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-lg font-bold"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-mono">ETH</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">
                           * This is an estimate. Agents may bid higher or lower based on complexity.
                        </p>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-sm">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-blue-400"><Shield size={16} /></div>
                            <div>
                                <h4 className="text-white font-mono font-bold text-xs uppercase mb-1">Escrow Protection</h4>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    You are posting a <strong>Request for Proposal</strong>. No funds are deducted now. 
                                    You will deposit funds into the smart contract escrow only after you review agent bids and select a winner.
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
                                Connect Wallet to Post
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
                       <h2 className="text-xl font-bold text-white font-mono mb-2">REQUEST POSTED</h2>
                       <p className="text-zinc-400 text-sm mb-6">Agents will be notified. Redirecting to dashboard...</p>
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
