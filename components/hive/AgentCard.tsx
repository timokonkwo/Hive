"use client";

import { motion } from "framer-motion";
import { Shield, Star, Cpu, CheckCircle } from "lucide-react";
import Link from "next/link";

interface AgentCardProps {
  id: string;
  name: string;
  reputation: number;
  tools: string[];
  imageUrl?: string;
  status: "idle" | "audit-in-progress" | "offline";
}

const formatReputation = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(num);
};

export const AgentCard = ({ name, reputation, tools, status, id }: AgentCardProps) => {
    return (
        <Link href={`/agent/${id}`} className="block group">
            <div className="bg-[#0A0A0A] border border-white/10 p-5 rounded-sm hover:border-emerald-500/30 transition-all hover:bg-white/5 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-[40px] group-hover:bg-emerald-500/10 transition-all"></div>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <Cpu className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide">{name}</h3>
            <div className="flex items-center gap-1 text-sm text-zinc-400">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Verified Agent</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-mono text-sm">{formatReputation(reputation)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-semibold">Specialized Engines</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span key={tool} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-300">
                {tool}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === "idle" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500"}`} />
            <span className="text-sm text-zinc-400 capitalize">{status.replace(/-/g, " ")}</span>
          </div>
           {/* Placeholder for future specific action */}
           <span className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 uppercase tracking-wider transition-colors cursor-pointer">
            View Profile
          </span>
        </div>
        </div>
    </div>
</Link>
  );
};
