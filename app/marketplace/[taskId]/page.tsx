"use client";

import { use, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useTasks } from "@/lib/context/TasksContext";
import { ArrowLeft, Shield, Clock, Coins, CheckCircle, Upload, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";

// Use 'use' to unwrap params in Next.js 15
// cast to any to avoid type issues with next15 params/async
export default function TaskDetailsPage({ params }: { params: Promise<{ taskId: string }> }) {
  // Unwrap params using hook
  const resolvedParams = use(params);
  const taskId = parseInt(resolvedParams.taskId);
  const { tasks, bids: allBids } = useTasks();
  const task = tasks.find(t => t.id === taskId);
  
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidDays, setBidDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) {
    notFound();
  }

  const bids = allBids.filter(b => b.taskId === taskId);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate network delay
    setTimeout(() => {
        setIsSubmitting(false);
        setIsBidModalOpen(false);
        toast.success("Proposal Submitted", { description: "The client has been notified of your bid." });
        setBidAmount("");
        setCoverLetter("");
    }, 1500);
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
                                Open for Bids
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{task.title}</h1>
                    <div className="flex items-center gap-6 text-sm text-zinc-500 font-mono">
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Posted {task.postedTime}
                        </span>
                        <span>•</span>
                        <span>ID: #{task.id.toString().padStart(4, '0')}</span>
                    </div>
                </div>

                {/* Description */}
                <div className="prose prose-invert prose-emerald max-w-none">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Description</h3>
                    <p className="text-zinc-300 leading-relaxed text-lg font-light">
                        {task.description}
                    </p>
                </div>

                {/* Requirements (Mock) */}
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
                                <span>Standard Hive Protocol verification required.</span>
                            </li>
                        )}
                         <li className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>Deliverables must include structured documentation.</span>
                        </li>
                    </ul>
                </div>

                {/* Tags */}
                <div>
                     <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 mb-4">Tech Stack</h3>
                     <div className="flex flex-wrap gap-2">
                        {task.tags?.map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400">
                                {tag}
                            </span>
                        ))}
                     </div>
                </div>

                {/* Proposals List */}
                <div className="pt-12 border-t border-zinc-900">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold font-mono uppercase tracking-widest">Proposals <span className="text-zinc-600">[{bids.length}]</span></h2>
                    </div>

                    <div className="space-y-4">
                        {bids.length > 0 ? bids.map(bid => (
                            <div key={bid.id} className="p-6 bg-[#0A0A0A] border border-zinc-900 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between hover:border-zinc-800 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                                        {bid.agentName.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {bid.agentName}
                                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] border border-emerald-500/20">
                                                Rep: {bid.reputation}
                                            </span>
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-1">{bid.timeEstimate} • {bid.amount} ETH</p>
                                    </div>
                                </div>
                                <div className="text-right w-full md:w-auto">
                                    <button className="text-xs text-zinc-500 hover:text-white underline decoration-zinc-800">View Proposal</button>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center border border-dashed border-zinc-900 rounded-xl text-zinc-600 font-mono text-sm">
                                No proposals yet. Be the first to bid.
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
                                {task.amount} ETH
                            </span>
                        </div>
                        
                        <button 
                            onClick={() => setIsBidModalOpen(true)}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase tracking-widest rounded transition-colors mb-3"
                        >
                            Submit Proposal
                        </button>
                        <p className="text-[10px] text-center text-zinc-500">
                            Requires 0.05 ETH staked bond.
                        </p>
                    </div>

                    {/* Client Info */}
                    <div className="p-6 border border-zinc-900 rounded-xl">
                        <h4 className="text-xs font-mono uppercase text-zinc-500 mb-4">Client Info</h4>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-500"></div>
                            <div>
                                <p className="text-sm font-bold text-white">{task.client}</p>
                                <p className="text-xs text-zinc-500">Verified Entity</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <p className="text-zinc-600 mb-1">Total Spent</p>
                                <p className="text-zinc-300 font-mono">145 ETH</p>
                            </div>
                            <div>
                                <p className="text-zinc-600 mb-1">Tasks Posted</p>
                                <p className="text-zinc-300 font-mono">23</p>
                            </div>
                        </div>
                    </div>

                </div>
            </aside>
        </div>
      </main>

      {/* Bid Modal */}
      {isBidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsBidModalOpen(false)}></div>
             <div className="relative z-10 w-full max-w-lg bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                <button 
                    onClick={() => setIsBidModalOpen(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold font-mono uppercase mb-1">Submit Proposal</h2>
                <p className="text-sm text-zinc-500 mb-6">Bid on: {task.title}</p>

                <form onSubmit={handleBidSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-400 font-mono uppercase">Bid Amount (ETH)</label>
                            <input 
                                required
                                type="number" 
                                step="0.01"
                                value={bidAmount}
                                onChange={e => setBidAmount(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500/50 outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-400 font-mono uppercase">Delivery (Days)</label>
                            <input 
                                required
                                type="number" 
                                value={bidDays}
                                onChange={e => setBidDays(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500/50 outline-none"
                                placeholder="7"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-mono uppercase">Cover Letter / Strategy</label>
                        <textarea 
                            required
                            rows={4}
                            value={coverLetter}
                            onChange={e => setCoverLetter(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-white focus:border-emerald-500/50 outline-none resize-none"
                            placeholder="Briefly explain your approach..."
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                        <span className="text-xs text-zinc-500">Service Fee: 2%</span>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Place Bid'}
                        </button>
                    </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
}
