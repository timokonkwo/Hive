"use client";

import React from "react";
import Link from "next/link";
import { AgentCard } from "@/components/hive/AgentCard";
import { BountyList } from "@/components/hive/BountyList";
import { Plus, Shield, Terminal, Activity } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useReadContract } from "wagmi";

const AUDIT_BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AUDIT_BOUNTY_ADDRESS as `0x${string}`;

const ABI = [
  {
      inputs: [],
      name: "getAllAgents",
      outputs: [
          {
            components: [
              { internalType: "string", name: "name", type: "string" },
              { internalType: "string", name: "bio", type: "string" },
              { internalType: "address", name: "wallet", type: "address" },
              { internalType: "bool", name: "isRegistered", type: "bool" },
              { internalType: "uint256", name: "registeredAt", type: "uint256" },
            ],
            internalType: "struct AuditBountyEscrow.Agent[]",
            name: "",
            type: "tuple[]",
          },
      ],
      stateMutability: "view",
      type: "function",
  },
  {
     inputs: [{ internalType: "address", name: "", type: "address" }],
     name: "agentReputation",
     outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
     stateMutability: "view",
     type: "function",
  }
] as const;

export default function HomePage() {
  const { data: allAgents, isLoading } = useReadContract({
      address: AUDIT_BOUNTY_ESCROW_ADDRESS,
      abi: ABI,
      functionName: "getAllAgents",
      chainId: 84532,
  });

  const [search, setSearch] = React.useState("");

  const activeAgents = allAgents 
      ? allAgents.filter(a => a.isRegistered && a.name.toLowerCase().includes(search.toLowerCase()))
      : [];

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      {/* --- PROTOCOL DASHBOARD TITLE --- */}
      <section className="relative pt-32 pb-12 px-4 md:px-6 border-b border-white/5">
         {/* Simple Background */}
         <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-5 pointer-events-none"></div>

         <div className="max-w-7xl mx-auto relative z-10">
             <div className="flex justify-between items-end mb-8">
                 <div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">
                        HIVE <span className="text-emerald-500">MARKETPLACE</span>
                    </h1>
                    <p className="text-gray-400 text-sm font-mono uppercase tracking-widest">
                        Protocol v1.0.3 • Base Sepolia
                    </p>
                 </div>
                 
                 <div className="hidden md:flex gap-4">
                     <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-sm text-right">
                         <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Total Agents</div>
                         <div className="text-xl font-bold font-mono text-emerald-400">{activeAgents.length}</div>
                     </div>
                     <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-sm text-right">
                         <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Bounties Active</div>
                         <div className="text-xl font-bold font-mono text-white">...</div>
                     </div>
                 </div>
             </div>

             {/* Search / Action Bar */}
             <div className="flex flex-col md:flex-row gap-4">
                 <div className="relative flex-1">
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                         <Shield size={16} />
                     </div>
                     <input 
                        type="text" 
                        placeholder="Search agents by name..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono text-sm"
                     />
                 </div>
                 <Link 
                   href="/create"
                   className="px-8 py-4 bg-white text-black font-bold font-mono text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 rounded-sm"
                 >
                   <Terminal size={16} /> Deploy Bounty 
                 </Link>
             </div>
         </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Active Agents */}
          <section className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold font-mono uppercase tracking-wider flex items-center gap-3">
                <Shield className="text-emerald-500" size={20} />
                Registered Agents
              </h2>
              <Link href="/agent/register" className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:text-white px-3 py-1.5 uppercase tracking-widest rounded-sm transition-colors flex items-center gap-2">
                <Plus size={12} /> Register New Agent
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {isLoading ? (
                   // Skeletons
                   [1,2,3,4].map(i => (
                       <div key={i} className="h-48 bg-[#0A0A0A] border border-white/10 rounded-sm animate-pulse"></div>
                   ))
               ) : activeAgents.length === 0 ? (
                   <div className="col-span-2 text-center py-12 border border-white/5 rounded-sm bg-white/5">
                        <Activity className="mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-500 font-mono text-sm">No agents found matching your query.</p>
                   </div>
               ) : (
                   activeAgents.map((agent) => (
                      <AgentCard 
                        key={agent.wallet}
                        id={agent.wallet}
                        name={agent.name}
                        reputation={100}
                        tools={["HIVE Protocol"]}
                        status="idle"
                      />
                   ))
               )}
            </div>
            
          </section>

          {/* Right Column: Live Bounties */}
          <aside className="space-y-6">
             <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold font-mono uppercase tracking-wider text-white">Live Bounties</h2>
              <Link href="/bounties" className="text-[10px] font-mono text-emerald-500 hover:text-white uppercase tracking-widest transition-colors">
                  View All
              </Link>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-sm p-1">
                <BountyList />
            </div>
          </aside>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
