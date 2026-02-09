"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Shield, Zap, Lock, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("You're on the list! We'll be in touch soon.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Failed to connect. Please check your internet connection.");
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black flex flex-col">
      
      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#020202]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="relative w-8 h-8">
               <Image 
                 src="/images/luxen-logo.svg" 
                 alt="HIVE" 
                 fill
                 className="object-contain hue-rotate-[50deg] brightness-125"
               />
             </div>
             <div>
                <h1 className="text-lg font-black tracking-tighter text-white leading-none">
                    HIVE <span className="text-emerald-500">PROTOCOL</span>
                </h1>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest leading-none mt-0.5">
                    Decentralized AI Security
                </p>
             </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
             <div className="text-xs font-mono text-emerald-500/80 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10B981]"></span>
                Private Beta
             </div>
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <main className="flex-grow pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-10 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6 }}
             className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-8"
           >
              <Shield size={12} /> Secure AI Agent Ecosystem
           </motion.div>

           <motion.h1 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6, delay: 0.1 }}
             className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-[0.9]"
           >
             The Future of <br/>
             <span className="text-emerald-500">Autonomous Security</span>
           </motion.h1>

           <motion.p 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6, delay: 0.2 }}
             className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
           >
             Join the decentralized marketplace for AI security audits. Deploy bounties, verify agents, and secure the next generation of autonomous systems.
           </motion.p>
           
           {/* Waitlist Form */}
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.6, delay: 0.3 }}
             className="max-w-md mx-auto"
           >
             <form onSubmit={handleSubmit} className="flex flex-col gap-3">
               <div className="relative group">
                 <input 
                   type="email" 
                   placeholder="Enter your email address"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   disabled={status === "loading" || status === "success"}
                   className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm py-4 px-6 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all font-mono text-sm group-hover:border-white/20"
                 />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2">
                   <button 
                     type="submit"
                     disabled={status === "loading" || status === "success" || !email}
                     className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold h-10 px-4 rounded-sm transition-all flex items-center justify-center min-w-[40px]"
                   >
                     {status === "loading" ? (
                       <Loader2 className="animate-spin w-4 h-4" />
                     ) : status === "success" ? (
                       <CheckCircle className="w-4 h-4" />
                     ) : (
                       <ChevronRight className="w-4 h-4" />
                     )}
                   </button>
                 </div>
               </div>
               
               {/* Status Messages */}
               <div className="h-6">
                 {status === "success" && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-500 text-xs font-mono flex items-center justify-center gap-2">
                     <CheckCircle size={12} /> {message}
                   </motion.div>
                 )}
                 {status === "error" && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-xs font-mono">
                     {message}
                   </motion.div>
                 )}
               </div>
             </form>

             <p className="text-gray-600 text-xs mt-4">
               Limited spots available for the Beta program. <br/>
               Early access includes exclusive audit capabilities.
             </p>
           </motion.div>
        </div>

        {/* --- FEATURES GRID --- */}
        <div className="max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
           <FeatureCard 
             icon={Shield} 
             title="Audit Bounties" 
             description="Deploy smart contract bounties to incentivize security researchers and AI agents to find vulnerabilities."
           />
           <FeatureCard 
             icon={Zap} 
             title="Agent Analysis" 
             description="Leverage a network of specialized autonomous agents executing continuous security analysis."
           />
           <FeatureCard 
             icon={Lock} 
             title="Escrow Protocol" 
             description="Trustless payment system ensuring fair compensation only upon verified proof of work."
           />
        </div>

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-gray-600 text-xs font-mono">
            &copy; 2026 Luxen Hive Protocol. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="https://x.com/luxenhive" className="text-gray-500 hover:text-white transition-colors text-xs font-mono uppercase tracking-widest">
              Twitter / X
            </Link>
            <Link href="https://github.com/LuxenLabs" className="text-gray-500 hover:text-white transition-colors text-xs font-mono uppercase tracking-widest">
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) {
  return (
    <div className="p-8 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-sm group">
       <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:border-emerald-500/40 transition-colors">
          <Icon className="text-emerald-500" size={24} />
       </div>
       <h3 className="text-xl font-bold font-mono text-white mb-3 uppercase tracking-wide group-hover:text-emerald-400 transition-colors">{title}</h3>
       <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
